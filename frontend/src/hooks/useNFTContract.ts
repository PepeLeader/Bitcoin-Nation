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
import type { CollectionInfo } from '../types/nft';

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
 * Format: OP_1 (0x51) PUSH32 (0x20) <32-byte-tweaked-key>
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

interface UseNFTContractResult {
    readonly getCollectionInfo: (address: string) => Promise<CollectionInfo>;
    readonly mint: (
        address: string,
        quantity: bigint,
    ) => Promise<bigint>;
    readonly mintWithURI: (
        address: string,
        to: string,
        uri: string,
    ) => Promise<bigint>;
    readonly setMintingOpen: (
        address: string,
        open: boolean,
    ) => Promise<void>;
    readonly getTokenURI: (
        address: string,
        tokenId: bigint,
    ) => Promise<string>;
    readonly getOwnerOf: (
        address: string,
        tokenId: bigint,
    ) => Promise<string>;
    readonly transfer: (
        address: string,
        to: string,
        tokenId: bigint,
    ) => Promise<void>;
    readonly loading: boolean;
    readonly error: string | null;
}

const MAX_SATS_FOR_MINT: bigint = 50_000n;
const MAX_SATS_FOR_TRANSFER: bigint = 30_000n;
const DEFAULT_FEE_RATE: number = 10;

export function useNFTContract(): UseNFTContractResult {
    const { network, address: walletAddress, addressStr } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCollectionInfo = useCallback(
        async (address: string): Promise<CollectionInfo> => {
            const contract = contractService.getNFTContract(address, network);
            const factory = contractService.getFactory(network);

            const [
                metadataResult,
                maxSupplyResult,
                mintPriceResult,
                maxPerWalletResult,
                availableSupplyResult,
                isMintingOpenResult,
                statusResult,
            ] = await Promise.all([
                contract.metadata(),
                contract.maxSupply(),
                contract.mintPrice(),
                contract.maxPerWallet(),
                contract.availableSupply(),
                contract.isMintingOpen(),
                factory.approvalStatus(Address.fromString(address)),
            ]);

            return {
                address,
                name: metadataResult.properties.name,
                symbol: metadataResult.properties.symbol,
                icon: metadataResult.properties.icon,
                banner: metadataResult.properties.banner,
                description: metadataResult.properties.description,
                website: metadataResult.properties.website,
                totalSupply: metadataResult.properties.totalSupply,
                maxSupply: maxSupplyResult.properties.maxSupply,
                mintPrice: mintPriceResult.properties.price,
                maxPerWallet: maxPerWalletResult.properties.maxPerWallet,
                availableSupply: availableSupplyResult.properties.available,
                isMintingOpen: isMintingOpenResult.properties.isOpen,
                approvalStatus: Number(statusResult.properties.status),
            };
        },
        [network],
    );

    const buildTxParams = useCallback(
        (maxSats: bigint): TransactionParameters => {
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
            };
        },
        [addressStr, network],
    );

    const mint = useCallback(
        async (address: string, quantity: bigint): Promise<bigint> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress || !addressStr) {
                    throw new Error('Wallet not connected');
                }

                const contract = contractService.getNFTContract(address, network);
                contract.setSender(walletAddress);

                // Get mint price and tweaked keys for fee calculation + output verification
                const [mintPriceResult, treasuryTweakedResult, ownerTweakedResult] =
                    await Promise.all([
                        contract.mintPrice(),
                        contract.treasuryTweakedKey(),
                        contract.ownerTweakedKey(),
                    ]);

                const mintPrice = mintPriceResult.properties.price;
                const totalCost = mintPrice * quantity;
                const adminFee = totalCost * 10n / 100n;
                const creatorPayment = totalCost - adminFee;

                // Convert tweaked keys to P2TR addresses for real Bitcoin outputs
                const treasuryTweaked = bigintToBytes32BE(treasuryTweakedResult.properties.tweakedKey);
                const ownerTweaked = bigintToBytes32BE(ownerTweakedResult.properties.tweakedKey);
                const treasuryP2tr = tweakedKeyToP2tr(treasuryTweaked, network);
                const ownerP2tr = tweakedKeyToP2tr(ownerTweaked, network);

                // Build extra outputs for fee split
                const extraOutputs: PsbtOutputExtendedAddress[] = [];
                const simOutputs: {
                    to: string;
                    value: bigint;
                    index: number;
                    flags: number;
                }[] = [];
                let outputIndex = 1;

                const sameRecipient = treasuryP2tr === ownerP2tr;

                if (sameRecipient && totalCost > 0n) {
                    // Single output covers both admin fee + creator payment
                    extraOutputs.push({ address: treasuryP2tr, value: toSatoshi(totalCost) });
                    simOutputs.push({
                        to: treasuryP2tr,
                        value: totalCost,
                        index: outputIndex++,
                        flags: TransactionOutputFlags.hasTo,
                    });
                } else {
                    if (adminFee > 0n) {
                        extraOutputs.push({ address: treasuryP2tr, value: toSatoshi(adminFee) });
                        simOutputs.push({
                            to: treasuryP2tr,
                            value: adminFee,
                            index: outputIndex++,
                            flags: TransactionOutputFlags.hasTo,
                        });
                    }
                    if (creatorPayment > 0n) {
                        extraOutputs.push({ address: ownerP2tr, value: toSatoshi(creatorPayment) });
                        simOutputs.push({
                            to: ownerP2tr,
                            value: creatorPayment,
                            index: outputIndex++,
                            flags: TransactionOutputFlags.hasTo,
                        });
                    }
                }

                // Set transaction details with scriptPubKey for contract verification
                if (simOutputs.length > 0) {
                    contract.setTransactionDetails({ inputs: [], outputs: simOutputs });
                }

                const simulation = await contract.mint(quantity);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const firstTokenId = simulation.properties.firstTokenId;

                // Fresh supply check before sending irreversible BTC transaction
                const freshSupply = await contract.availableSupply();
                if (freshSupply.properties.available < quantity) {
                    throw new Error(
                        `Only ${freshSupply.properties.available.toString()} NFTs remaining — not enough for ${quantity.toString()}. Mint cancelled to protect your BTC.`,
                    );
                }

                const maxSats = totalCost + MAX_SATS_FOR_MINT;
                const txParams: TransactionParameters = {
                    ...buildTxParams(maxSats),
                    extraOutputs,
                };

                const receipt = await simulation.sendTransaction(txParams);
                console.log('Mint TX:', receipt.transactionId);

                return firstTokenId;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Mint failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, addressStr, buildTxParams],
    );

    const mintWithURI = useCallback(
        async (
            address: string,
            to: string,
            uri: string,
        ): Promise<bigint> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const contract = contractService.getNFTContract(
                    address,
                    network,
                );
                contract.setSender(walletAddress);
                const simulation = await contract.mintWithURI(
                    Address.fromString(to),
                    uri,
                );

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const tokenId: bigint = simulation.properties.tokenId;

                const txParams: TransactionParameters =
                    buildTxParams(MAX_SATS_FOR_MINT);
                const receipt =
                    await simulation.sendTransaction(txParams);
                console.log('MintWithURI TX:', receipt.transactionId);

                return tokenId;
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : 'Mint failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    const setMintingOpen = useCallback(
        async (address: string, open: boolean): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const contract = contractService.getNFTContract(
                    address,
                    network,
                );
                contract.setSender(walletAddress);
                const simulation = await contract.setMintingOpen(open);

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters =
                    buildTxParams(MAX_SATS_FOR_TRANSFER);
                const receipt =
                    await simulation.sendTransaction(txParams);
                console.log('SetMintingOpen TX:', receipt.transactionId);
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Failed to toggle minting';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    const getTokenURI = useCallback(
        async (address: string, tokenId: bigint): Promise<string> => {
            const contract = contractService.getNFTContract(
                address,
                network,
            );
            const result = await contract.tokenURI(tokenId);
            return result.properties.uri;
        },
        [network],
    );

    const getOwnerOf = useCallback(
        async (address: string, tokenId: bigint): Promise<string> => {
            const contract = contractService.getNFTContract(
                address,
                network,
            );
            const result = await contract.ownerOf(tokenId);
            return String(result.properties.owner);
        },
        [network],
    );

    const transfer = useCallback(
        async (
            address: string,
            to: string,
            tokenId: bigint,
        ): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                if (!walletAddress) {
                    throw new Error('Wallet not connected');
                }

                const contract = contractService.getNFTContract(
                    address,
                    network,
                );
                contract.setSender(walletAddress);
                const simulation = await contract.transfer(
                    Address.fromString(to),
                    tokenId,
                );

                if (simulation.revert) {
                    throw new Error(simulation.revert);
                }

                const txParams: TransactionParameters =
                    buildTxParams(MAX_SATS_FOR_TRANSFER);
                const receipt =
                    await simulation.sendTransaction(txParams);
                console.log('Transfer TX:', receipt.transactionId);
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Transfer failed';
                setError(msg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [network, walletAddress, buildTxParams],
    );

    return {
        getCollectionInfo,
        mint,
        mintWithURI,
        setMintingOpen,
        getTokenURI,
        getOwnerOf,
        transfer,
        loading,
        error,
    };
}
