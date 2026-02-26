import { useState, useEffect, useCallback } from 'react';
import { Address } from '@btc-vision/transaction';
import { useWallet } from './useWallet';
import { contractService } from '../services/ContractService';
import type { CollectionInfo } from '../types/nft';

interface UseCollectionDataOptions {
    readonly pollInterval?: number;
}

interface UseCollectionDataResult {
    readonly collection: CollectionInfo | null;
    readonly creator: string | null;
    readonly loading: boolean;
    readonly error: string | null;
    readonly refresh: () => void;
}

export function useCollectionData(
    address: string | undefined,
    options?: UseCollectionDataOptions,
): UseCollectionDataResult {
    const { network } = useWallet();
    const [collection, setCollection] = useState<CollectionInfo | null>(null);
    const [creator, setCreator] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    // Auto-poll supply at the configured interval
    useEffect(() => {
        if (!options?.pollInterval || !address) return;

        const timer = setInterval(() => {
            setRefreshKey((k) => k + 1);
        }, options.pollInterval);

        return () => clearInterval(timer);
    }, [address, options?.pollInterval]);

    useEffect(() => {
        if (!address) return;

        let cancelled = false;
        const isInitialLoad = refreshKey === 0 || !collection;
        if (isInitialLoad) setLoading(true);
        setError(null);

        void (async () => {
            try {
                const contract = contractService.getNFTContract(address, network);

                if (isInitialLoad) {
                    // Full load: fetch all 8 fields
                    const factory = contractService.getFactory(network);
                    const [metadataResult, maxSupplyResult, mintPriceResult, maxPerWalletResult, availableSupplyResult, isMintingOpenResult, statusResult, creatorResult] =
                        await Promise.all([
                            contract.metadata(),
                            contract.maxSupply(),
                            contract.mintPrice(),
                            contract.maxPerWallet(),
                            contract.availableSupply(),
                            contract.isMintingOpen(),
                            factory.approvalStatus(Address.fromString(address)),
                            factory.collectionCreator(Address.fromString(address)),
                        ]);

                    if (cancelled) return;

                    setCreator(creatorResult.properties.creator.toHex());
                    setCollection({
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
                    });
                } else {
                    // Poll refresh: only fetch the 2 fields that change
                    const [availableSupplyResult, isMintingOpenResult] = await Promise.all([
                        contract.availableSupply(),
                        contract.isMintingOpen(),
                    ]);

                    if (cancelled) return;

                    setCollection((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  availableSupply: availableSupplyResult.properties.available,
                                  isMintingOpen: isMintingOpenResult.properties.isOpen,
                              }
                            : prev,
                    );
                }
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load collection');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [address, network, refreshKey]);

    return { collection, creator, loading, error, refresh };
}
