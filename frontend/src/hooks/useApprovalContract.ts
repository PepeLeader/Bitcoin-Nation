import { useState, useCallback } from 'react';
import type { TransactionParameters } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { useWallet } from './useWallet';
import { contractService } from '../services/ContractService';

interface UseApprovalContractResult {
    readonly applyForMint: (collectionAddress: string) => Promise<void>;
    readonly approveCollection: (collectionAddress: string) => Promise<void>;
    readonly rejectCollection: (collectionAddress: string) => Promise<void>;
    readonly loading: boolean;
    readonly error: string | null;
}

const MAX_SATS: bigint = 30_000n;
const DEFAULT_FEE_RATE: number = 10;

export function useApprovalContract(): UseApprovalContractResult {
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

    const applyForMint = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const factory = contractService.getFactory(network);
                factory.setSender(walletAddress);
                const simulation = await factory.applyForMint(Address.fromString(collectionAddress));

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters = buildTxParams();
                const receipt = await simulation.sendTransaction(txParams);
                console.log('ApplyForMint TX:', receipt.transactionId);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Apply failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    const approveCollection = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const factory = contractService.getFactory(network);
                factory.setSender(walletAddress);
                const simulation = await factory.approveCollection(Address.fromString(collectionAddress));

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters = buildTxParams();
                const receipt = await simulation.sendTransaction(txParams);
                console.log('ApproveCollection TX:', receipt.transactionId);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Approve failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    const rejectCollection = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const factory = contractService.getFactory(network);
                factory.setSender(walletAddress);
                const simulation = await factory.rejectCollection(Address.fromString(collectionAddress));

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters = buildTxParams();
                const receipt = await simulation.sendTransaction(txParams);
                console.log('RejectCollection TX:', receipt.transactionId);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Reject failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    return {
        applyForMint,
        approveCollection,
        rejectCollection,
        loading,
        error,
    };
}
