import { useState, useCallback } from 'react';
import type { TransactionParameters } from 'opnet';
import { TransactionOutputFlags } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { toSatoshi, type PsbtOutputExtendedAddress } from '@btc-vision/bitcoin';
import { useWallet } from './useWallet';
import { contractService } from '../services/ContractService';
import { providerService } from '../services/ProviderService';
import { getAdminAddress } from '../config/contracts';

interface UseRegistryContractResult {
    readonly submitCollection: (collectionAddress: string) => Promise<void>;
    readonly approveSubmission: (collectionAddress: string) => Promise<void>;
    readonly rejectSubmission: (collectionAddress: string) => Promise<void>;
    readonly loading: boolean;
    readonly error: string | null;
}

const MAX_SATS: bigint = 30_000n;
const SUBMISSION_FEE_SATS: bigint = 10_000n;
const DEFAULT_FEE_RATE: number = 10;

const BECH32_PREFIXES: readonly string[] = ['opt1', 'opr1', 'bc1', 'bcrt1', 'tb1'];

export function useRegistryContract(): UseRegistryContractResult {
    const { network, address: walletAddress, addressStr } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buildTxParams = useCallback((): TransactionParameters => {
        if (!addressStr) {
            throw new Error('Wallet not connected');
        }

        return {
            signer: null,
            mldsaSigner: null,
            refundTo: addressStr,
            maximumAllowedSatToSpend: MAX_SATS,
            feeRate: DEFAULT_FEE_RATE,
            network,
        };
    }, [addressStr, network]);

    const resolveAddress = useCallback(
        async (input: string): Promise<Address> => {
            const isBech32 = BECH32_PREFIXES.some((p) => input.startsWith(p));
            if (!isBech32) {
                return Address.fromString(input);
            }

            const provider = providerService.getProvider(network);
            return provider.getPublicKeyInfo(input, true);
        },
        [network],
    );

    const submitCollection = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress || !addressStr) {
                    throw new Error('Wallet not connected');
                }

                const registry = contractService.getRegistry(network);
                registry.setSender(walletAddress);

                // Build submission fee output to admin
                const adminBech32 = getAdminAddress(network);
                const extraOutputs: PsbtOutputExtendedAddress[] = [
                    { address: adminBech32, value: toSatoshi(SUBMISSION_FEE_SATS) },
                ];

                // Set transaction details BEFORE simulate so contract can verify the fee output
                registry.setTransactionDetails({
                    inputs: [],
                    outputs: [{
                        to: adminBech32,
                        value: SUBMISSION_FEE_SATS,
                        index: 1,
                        flags: TransactionOutputFlags.hasTo,
                    }],
                });

                const resolved = await resolveAddress(collectionAddress);
                const simulation = await registry.submitCollection(resolved);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters = {
                    signer: null,
                    mldsaSigner: null,
                    refundTo: addressStr,
                    maximumAllowedSatToSpend: MAX_SATS,
                    feeRate: DEFAULT_FEE_RATE,
                    network,
                    extraOutputs,
                };

                await simulation.sendTransaction(txParams);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Submission failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, addressStr, resolveAddress],
    );

    const approveSubmission = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const registry = contractService.getRegistry(network);
                registry.setSender(walletAddress);
                const resolved = await resolveAddress(collectionAddress);
                const simulation = await registry.approveSubmission(resolved);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters = buildTxParams();
                await simulation.sendTransaction(txParams);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Approve failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams, resolveAddress],
    );

    const rejectSubmission = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const registry = contractService.getRegistry(network);
                registry.setSender(walletAddress);
                const resolved = await resolveAddress(collectionAddress);
                const simulation = await registry.rejectSubmission(resolved);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters = buildTxParams();
                await simulation.sendTransaction(txParams);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Reject failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams, resolveAddress],
    );

    return {
        submitCollection,
        approveSubmission,
        rejectSubmission,
        loading,
        error,
    };
}
