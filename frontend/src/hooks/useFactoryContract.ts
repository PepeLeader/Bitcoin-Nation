import { useState, useCallback } from 'react';
import type { TransactionParameters } from 'opnet';
import { TransactionOutputFlags } from 'opnet';
import {
    address as btcAddress,
    toSatoshi,
    type PsbtOutputExtendedAddress,
} from '@btc-vision/bitcoin';
import { useWallet } from './useWallet';
import { contractService } from '../services/ContractService';
import { getAdminAddress } from '../config/contracts';

/**
 * Extracts the 32-byte tweaked public key from a P2TR bech32m address
 * and returns it as a big-endian bigint.
 * P2TR scriptPubKey: OP_1 (0x51) PUSH32 (0x20) <32-byte-tweaked-key>
 */
function tweakedKeyFromP2tr(addr: string, network: Parameters<typeof btcAddress.toOutputScript>[1]): bigint {
    const script: Uint8Array = btcAddress.toOutputScript(addr, network);
    let result: bigint = 0n;
    for (let i: number = 2; i < 34; i++) {
        result = (result << 8n) | BigInt(script[i] ?? 0);
    }
    return result;
}

interface CreateCollectionParams {
    readonly name: string;
    readonly symbol: string;
    readonly baseURI: string;
    readonly maxSupply: bigint;
    readonly mintPrice: bigint;
    readonly maxPerWallet: bigint;
    readonly banner: string;
    readonly icon: string;
    readonly website: string;
    readonly description: string;
}

interface UseFactoryContractResult {
    readonly createCollection: (params: CreateCollectionParams) => Promise<string>;
    readonly getCollectionCount: () => Promise<bigint>;
    readonly getCollectionAtIndex: (index: bigint) => Promise<string>;
    readonly loading: boolean;
    readonly error: string | null;
}

const CREATION_FEE_SATS: bigint = 100_000n;
const MAX_SATS_FOR_COLLECTION: bigint = 200_000n;

export function useFactoryContract(): UseFactoryContractResult {
    const { network, address: walletAddress, addressStr } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createCollection = useCallback(
        async (params: CreateCollectionParams): Promise<string> => {
            if (!addressStr) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const factory = contractService.getFactory(network);
                factory.setSender(walletAddress);

                // Build creation fee output to admin
                const adminBech32 = getAdminAddress(network);
                const extraOutputs: PsbtOutputExtendedAddress[] = [
                    { address: adminBech32, value: toSatoshi(CREATION_FEE_SATS) },
                ];

                // Set transaction details for contract output verification
                factory.setTransactionDetails({
                    inputs: [],
                    outputs: [{
                        to: adminBech32,
                        value: CREATION_FEE_SATS,
                        index: 1,
                        flags: TransactionOutputFlags.hasTo,
                    }],
                });

                const ownerTweakedKey: bigint = tweakedKeyFromP2tr(addressStr, network);

                const simulation = await factory.createCollection(
                    params.name,
                    params.symbol,
                    params.baseURI,
                    params.maxSupply,
                    params.mintPrice,
                    params.maxPerWallet,
                    params.banner,
                    params.icon,
                    params.website,
                    params.description,
                    ownerTweakedKey,
                );

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const collectionAddress: string = String(
                    simulation.properties.collectionAddress,
                );

                const txParams: TransactionParameters = {
                    signer: null,
                    mldsaSigner: null,
                    refundTo: addressStr,
                    maximumAllowedSatToSpend: MAX_SATS_FOR_COLLECTION,
                    network,
                    extraOutputs,
                };

                await simulation.sendTransaction(txParams);

                return collectionAddress;
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Failed to create collection';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, addressStr],
    );

    const getCollectionCount = useCallback(async (): Promise<bigint> => {
        const factory = contractService.getFactory(network);
        const result = await factory.collectionCount();
        return result.properties.count;
    }, [network]);

    const getCollectionAtIndex = useCallback(
        async (index: bigint): Promise<string> => {
            const factory = contractService.getFactory(network);
            const result = await factory.collectionAtIndex(index);
            return String(result.properties.collectionAddress);
        },
        [network],
    );

    return {
        createCollection,
        getCollectionCount,
        getCollectionAtIndex,
        loading,
        error,
    };
}
