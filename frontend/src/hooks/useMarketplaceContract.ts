import { useState, useCallback } from 'react';
import type { TransactionParameters } from 'opnet';
import { TransactionOutputFlags } from 'opnet';
import { Address } from '@btc-vision/transaction';
import {
    address as btcAddress,
    toSatoshi,
    type PsbtOutputExtendedAddress,
} from '@btc-vision/bitcoin';
import { useWallet } from './useWallet';
import { contractService } from '../services/ContractService';
import type { GetListingResult, GetReservationResult } from '../../contracts-types/NFTMarketplace';

/**
 * Extracts the 32-byte tweaked public key from a P2TR bech32m address
 * and returns it as a big-endian bigint.
 */
function tweakedKeyFromP2tr(addr: string, network: Parameters<typeof btcAddress.toOutputScript>[1]): bigint {
    const script: Uint8Array = btcAddress.toOutputScript(addr, network);
    let result: bigint = 0n;
    for (let i: number = 2; i < 34; i++) {
        result = (result << 8n) | BigInt(script[i] ?? 0);
    }
    return result;
}

/**
 * Converts a bigint (u256 big-endian) to a 32-byte Uint8Array.
 */
function bigintToBytes32BE(n: bigint): Uint8Array {
    const hex = n.toString(16).padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/**
 * Constructs a P2TR scriptPubKey from a 32-byte tweaked public key.
 */
function tweakedKeyToScriptPubKey(tweakedKey: Uint8Array): Uint8Array {
    const script = new Uint8Array(34);
    script[0] = 0x51;
    script[1] = 0x20;
    script.set(tweakedKey, 2);
    return script;
}

/**
 * Derives a P2TR bech32 address from a 32-byte tweaked public key.
 */
function tweakedKeyToP2tr(tweakedKey: Uint8Array, network: Parameters<typeof btcAddress.fromOutputScript>[1]): string {
    const script = tweakedKeyToScriptPubKey(tweakedKey);
    return btcAddress.fromOutputScript(script, network);
}

export interface ListingData {
    readonly collection: string;
    readonly tokenId: bigint;
    readonly seller: string;
    readonly price: bigint;
    readonly sellerTweakedKey: bigint;
    readonly active: boolean;
}

export interface ReservationData {
    readonly listingId: bigint;
    readonly buyer: string;
    readonly expiryBlock: bigint;
    readonly active: boolean;
}

interface UseMarketplaceContractResult {
    // Read
    readonly getListingCount: () => Promise<bigint>;
    readonly getListing: (listingId: bigint) => Promise<ListingData>;
    readonly isCollectionApproved: (collectionAddress: string) => Promise<boolean>;
    readonly getReservation: (reservationId: bigint) => Promise<ReservationData>;
    readonly getReservationCount: () => Promise<bigint>;
    readonly isBlacklisted: () => Promise<boolean>;
    readonly getBlacklistExpiry: () => Promise<bigint>;
    // Write — Reservation flow
    readonly reserveListing: (listingId: bigint) => Promise<bigint>;
    readonly fulfillReservation: (reservationId: bigint) => Promise<void>;
    readonly cancelReservation: (reservationId: bigint) => Promise<void>;
    readonly expireReservation: (reservationId: bigint) => Promise<void>;
    // Write — Listing management
    readonly listNFT: (collectionAddress: string, tokenId: bigint, price: bigint) => Promise<bigint>;
    readonly delistNFT: (listingId: bigint) => Promise<void>;
    // Admin
    readonly approveMarketplaceCollection: (collectionAddress: string) => Promise<void>;
    readonly revokeMarketplaceCollection: (collectionAddress: string) => Promise<void>;
    readonly setPlatformFee: (newNumerator: bigint) => Promise<void>;
    // Approval helpers (calls NFT contract)
    readonly setApprovalForAll: (collectionAddress: string, approved: boolean) => Promise<void>;
    readonly checkApproval: (collectionAddress: string) => Promise<boolean>;
    // State
    readonly loading: boolean;
    readonly error: string | null;
}

const MAX_SATS_FOR_MARKETPLACE: bigint = 30_000n;
const DEFAULT_FEE_RATE: number = 10;
const FEE_DENOMINATOR: bigint = 1000n;

export function useMarketplaceContract(): UseMarketplaceContractResult {
    const { network, address: walletAddress, addressStr } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buildTxParams = useCallback(
        (maxSats: bigint, extraOutputs?: PsbtOutputExtendedAddress[]): TransactionParameters => {
            if (!addressStr) {
                throw new Error('Wallet not connected');
            }

            return {
                signer: null,
                mldsaSigner: null,
                refundTo: addressStr,
                maximumAllowedSatToSpend: maxSats,
                feeRate: DEFAULT_FEE_RATE,
                network,
                ...(extraOutputs ? { extraOutputs } : {}),
            };
        },
        [addressStr, network],
    );

    // ── Read methods ──────────────────────────────────────────────────

    const getListingCount = useCallback(async (): Promise<bigint> => {
        const marketplace = contractService.getMarketplace(network);
        const result = await marketplace.listingCount();
        return result.properties.count;
    }, [network]);

    const getListing = useCallback(async (listingId: bigint): Promise<ListingData> => {
        const marketplace = contractService.getMarketplace(network);
        const result: GetListingResult = await marketplace.getListing(listingId);
        return {
            collection: String(result.properties.collection),
            tokenId: result.properties.tokenId,
            seller: String(result.properties.seller),
            price: result.properties.price,
            sellerTweakedKey: result.properties.sellerTweakedKey,
            active: result.properties.active,
        };
    }, [network]);

    const isCollectionApproved = useCallback(async (collectionAddress: string): Promise<boolean> => {
        const marketplace = contractService.getMarketplace(network);
        const result = await marketplace.isCollectionApproved(Address.fromString(collectionAddress));
        return result.properties.approved;
    }, [network]);

    const getReservation = useCallback(async (reservationId: bigint): Promise<ReservationData> => {
        const marketplace = contractService.getMarketplace(network);
        const result: GetReservationResult = await marketplace.getReservation(reservationId);
        return {
            listingId: result.properties.listingId,
            buyer: String(result.properties.buyer),
            expiryBlock: result.properties.expiryBlock,
            active: result.properties.active,
        };
    }, [network]);

    const getReservationCount = useCallback(async (): Promise<bigint> => {
        const marketplace = contractService.getMarketplace(network);
        const result = await marketplace.reservationCount();
        return result.properties.count;
    }, [network]);

    const isBlacklisted = useCallback(async (): Promise<boolean> => {
        if (!walletAddress) return false;
        const marketplace = contractService.getMarketplace(network);
        const result = await marketplace.isBlacklisted(walletAddress);
        return result.properties.blacklisted;
    }, [network, walletAddress]);

    const getBlacklistExpiry = useCallback(async (): Promise<bigint> => {
        if (!walletAddress) return 0n;
        const marketplace = contractService.getMarketplace(network);
        const result = await marketplace.getBlacklistExpiry(walletAddress);
        return result.properties.blockNumber;
    }, [network, walletAddress]);

    // ── Write methods ─────────────────────────────────────────────────

    const listNFT = useCallback(
        async (collectionAddress: string, tokenId: bigint, price: bigint): Promise<bigint> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress || !addressStr) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const sellerTweakedKey = tweakedKeyFromP2tr(addressStr, network);

                const simulation = await marketplace.list(
                    Address.fromString(collectionAddress),
                    tokenId,
                    price,
                    sellerTweakedKey,
                );

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const listingId = simulation.properties.listingId;

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));

                return listingId;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to list NFT';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, addressStr, buildTxParams],
    );

    const delistNFT = useCallback(
        async (listingId: bigint): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const simulation = await marketplace.delist(listingId);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to delist NFT';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    // ── Reservation methods ───────────────────────────────────────────

    /**
     * Phase 1: Reserve a listing (no BTC sent, no risk).
     * Returns the reservationId.
     */
    const reserveListing = useCallback(
        async (listingId: bigint): Promise<bigint> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress || !addressStr) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const buyerTweakedKey = tweakedKeyFromP2tr(addressStr, network);

                const simulation = await marketplace.reserve(listingId, buyerTweakedKey);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const reservationId = simulation.properties.reservationId;

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));

                return reservationId;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to reserve listing';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, addressStr, buildTxParams],
    );

    /**
     * Phase 2: Fulfill a reservation (@payable — BTC sent here).
     * Builds extraOutputs for seller + treasury fee split.
     */
    const fulfillReservation = useCallback(
        async (reservationId: bigint): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress || !addressStr) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                // Load reservation → listing data + treasury info
                const reservationResult = await marketplace.getReservation(reservationId);
                const { listingId } = reservationResult.properties;

                const [listingResult, feeResult, treasuryTweakedResult] = await Promise.all([
                    marketplace.getListing(listingId),
                    marketplace.platformFeeNumerator(),
                    marketplace.treasuryTweakedKey(),
                ]);

                const { price, sellerTweakedKey } = listingResult.properties;
                const feeNumerator = feeResult.properties.numerator;
                const treasuryTweakedKeyVal = treasuryTweakedResult.properties.tweakedKey;

                // Calculate fee split
                const platformFee = (price * feeNumerator) / FEE_DENOMINATOR;
                const sellerProceeds = price - platformFee;

                // Convert tweaked keys to P2TR addresses
                const sellerTweakedBytes = bigintToBytes32BE(sellerTweakedKey);
                const treasuryTweakedBytes = bigintToBytes32BE(treasuryTweakedKeyVal);
                const sellerP2tr = tweakedKeyToP2tr(sellerTweakedBytes, network);
                const treasuryP2tr = tweakedKeyToP2tr(treasuryTweakedBytes, network);

                // Build extra outputs for fee split
                const extraOutputs: PsbtOutputExtendedAddress[] = [];
                const simOutputs: {
                    to: string;
                    value: bigint;
                    index: number;
                    flags: number;
                }[] = [];
                let outputIndex = 1;

                const sameRecipient = sellerP2tr === treasuryP2tr;

                if (sameRecipient && price > 0n) {
                    extraOutputs.push({ address: sellerP2tr, value: toSatoshi(price) });
                    simOutputs.push({
                        to: sellerP2tr,
                        value: price,
                        index: outputIndex++,
                        flags: TransactionOutputFlags.hasTo,
                    });
                } else {
                    if (sellerProceeds > 0n) {
                        extraOutputs.push({ address: sellerP2tr, value: toSatoshi(sellerProceeds) });
                        simOutputs.push({
                            to: sellerP2tr,
                            value: sellerProceeds,
                            index: outputIndex++,
                            flags: TransactionOutputFlags.hasTo,
                        });
                    }
                    if (platformFee > 0n) {
                        extraOutputs.push({ address: treasuryP2tr, value: toSatoshi(platformFee) });
                        simOutputs.push({
                            to: treasuryP2tr,
                            value: platformFee,
                            index: outputIndex++,
                            flags: TransactionOutputFlags.hasTo,
                        });
                    }
                }

                // Set transaction details BEFORE simulate
                if (simOutputs.length > 0) {
                    marketplace.setTransactionDetails({ inputs: [], outputs: simOutputs });
                }

                const simulation = await marketplace.fulfillReservation(reservationId);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const maxSats = price + MAX_SATS_FOR_MARKETPLACE;
                const txParams: TransactionParameters = {
                    ...buildTxParams(maxSats),
                    extraOutputs,
                };

                await simulation.sendTransaction(txParams);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to fulfill reservation';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, addressStr, buildTxParams],
    );

    /**
     * Cancel own reservation (no blacklist penalty).
     */
    const cancelReservation = useCallback(
        async (reservationId: bigint): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const simulation = await marketplace.cancelReservation(reservationId);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to cancel reservation';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    /**
     * Expire an expired reservation (permissionless cleanup).
     */
    const expireReservation = useCallback(
        async (reservationId: bigint): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const simulation = await marketplace.expireReservation(reservationId);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to expire reservation';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    // ── Admin methods ─────────────────────────────────────────────────

    const approveMarketplaceCollection = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const simulation = await marketplace.approveCollection(
                    Address.fromString(collectionAddress),
                );

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to approve collection';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    const revokeMarketplaceCollection = useCallback(
        async (collectionAddress: string): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const simulation = await marketplace.revokeCollection(
                    Address.fromString(collectionAddress),
                );

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to revoke collection';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    const setPlatformFee = useCallback(
        async (newNumerator: bigint): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const marketplace = contractService.getMarketplace(network);
                marketplace.setSender(walletAddress);

                const simulation = await marketplace.setPlatformFee(newNumerator);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to set platform fee';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    // ── Approval helpers (calls NFT contract) ─────────────────────────

    const setApprovalForAll = useCallback(
        async (collectionAddress: string, approved: boolean): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const nftContract = contractService.getNFTContract(collectionAddress, network);
                nftContract.setSender(walletAddress);

                const mktAddr = await contractService.getMarketplaceInternalAddress(network);

                const simulation = await nftContract.setApprovalForAll(
                    mktAddr,
                    approved,
                );

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                await simulation.sendTransaction(buildTxParams(MAX_SATS_FOR_MARKETPLACE));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to set approval';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    const checkApproval = useCallback(
        async (collectionAddress: string): Promise<boolean> => {
            if (!walletAddress) return false;

            const nftContract = contractService.getNFTContract(collectionAddress, network);
            const mktAddr = await contractService.getMarketplaceInternalAddress(network);

            const result = await nftContract.isApprovedForAll(
                walletAddress,
                mktAddr,
            );
            return result.properties.approved;
        },
        [network, walletAddress],
    );

    return {
        getListingCount,
        getListing,
        isCollectionApproved,
        getReservation,
        getReservationCount,
        isBlacklisted,
        getBlacklistExpiry,
        reserveListing,
        fulfillReservation,
        cancelReservation,
        expireReservation,
        listNFT,
        delistNFT,
        approveMarketplaceCollection,
        revokeMarketplaceCollection,
        setPlatformFee,
        setApprovalForAll,
        checkApproval,
        loading,
        error,
    };
}
