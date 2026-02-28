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

/**
 * Safely load collection metadata. Tries the bulk metadata() call first,
 * then falls back to individual standard OP-721 calls (name, symbol, totalSupply).
 */
async function loadMetadata(
    contract: ReturnType<typeof contractService.getNFTContract>,
): Promise<{
    name: string;
    symbol: string;
    icon: string;
    banner: string;
    description: string;
    website: string;
    totalSupply: bigint;
}> {
    // Try our custom metadata() first — it returns everything in one call
    try {
        const meta = await contract.metadata();
        return {
            name: meta.properties.name,
            symbol: meta.properties.symbol,
            icon: meta.properties.icon,
            banner: meta.properties.banner,
            description: meta.properties.description,
            website: meta.properties.website,
            totalSupply: meta.properties.totalSupply,
        };
    } catch {
        // External collection — fall back to standard OP-721 individual calls
    }

    const results = await Promise.allSettled([
        contract.name(),
        contract.symbol(),
        contract.totalSupply(),
    ]);

    return {
        name: results[0].status === 'fulfilled' ? results[0].value.properties.name : 'Unknown',
        symbol: results[1].status === 'fulfilled' ? results[1].value.properties.symbol : '???',
        icon: '',
        banner: '',
        description: '',
        website: '',
        totalSupply: results[2].status === 'fulfilled' ? results[2].value.properties.totalSupply : 0n,
    };
}

/**
 * Safely load custom (non-standard) fields. Returns defaults when the
 * contract doesn't implement these methods (e.g. external collections).
 */
async function loadCustomFields(
    contract: ReturnType<typeof contractService.getNFTContract>,
): Promise<{
    maxSupply: bigint;
    mintPrice: bigint;
    maxPerWallet: bigint;
    availableSupply: bigint;
    isMintingOpen: boolean;
}> {
    const results = await Promise.allSettled([
        contract.maxSupply(),
        contract.mintPrice(),
        contract.maxPerWallet(),
        contract.availableSupply(),
        contract.isMintingOpen(),
    ]);

    return {
        maxSupply: results[0].status === 'fulfilled' ? results[0].value.properties.maxSupply : 0n,
        mintPrice: results[1].status === 'fulfilled' ? results[1].value.properties.price : 0n,
        maxPerWallet: results[2].status === 'fulfilled' ? results[2].value.properties.maxPerWallet : 0n,
        availableSupply: results[3].status === 'fulfilled' ? results[3].value.properties.available : 0n,
        isMintingOpen: results[4].status === 'fulfilled' ? results[4].value.properties.isOpen : false,
    };
}

/**
 * Check approval status from both factory and registry.
 * Factory collections have status in the factory; external submissions are in the registry.
 */
async function loadApprovalStatus(
    address: string,
    network: Parameters<typeof contractService.getFactory>[0],
): Promise<{ approvalStatus: number; creatorHex: string }> {
    const factory = contractService.getFactory(network);
    let approvalStatus = 0;
    let creatorHex = '';

    // Try factory first
    try {
        const addrObj = Address.fromString(address);
        const [statusResult, creatorResult] = await Promise.all([
            factory.approvalStatus(addrObj),
            factory.collectionCreator(addrObj),
        ]);
        approvalStatus = Number(statusResult.properties.status);
        creatorHex = creatorResult.properties.creator.toHex();
    } catch {
        // Not in factory — try registry
    }

    // If factory returned no status (0 = not registered), check registry
    if (approvalStatus === 0) {
        try {
            const registry = contractService.getRegistry(network);
            const addrObj = Address.fromString(address);
            const [statusResult, submitterResult] = await Promise.allSettled([
                registry.submissionStatus(addrObj),
                registry.submissionSubmitter(addrObj),
            ]);
            if (statusResult.status === 'fulfilled') {
                approvalStatus = Number(statusResult.value.properties.status);
            }
            if (submitterResult.status === 'fulfilled') {
                creatorHex = submitterResult.value.properties.submitter.toHex();
            }
        } catch {
            // Registry not available
        }
    }

    return { approvalStatus, creatorHex };
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
                    // Full load — resilient to external collections
                    const [meta, custom, approval] = await Promise.all([
                        loadMetadata(contract),
                        loadCustomFields(contract),
                        loadApprovalStatus(address, network),
                    ]);

                    if (cancelled) return;

                    setCreator(approval.creatorHex || null);
                    setCollection({
                        address,
                        name: meta.name,
                        symbol: meta.symbol,
                        icon: meta.icon,
                        banner: meta.banner,
                        description: meta.description,
                        website: meta.website,
                        totalSupply: meta.totalSupply,
                        maxSupply: custom.maxSupply,
                        mintPrice: custom.mintPrice,
                        maxPerWallet: custom.maxPerWallet,
                        availableSupply: custom.availableSupply,
                        isMintingOpen: custom.isMintingOpen,
                        approvalStatus: approval.approvalStatus,
                    });
                } else {
                    // Poll refresh: try dynamic fields, ignore failures
                    const results = await Promise.allSettled([
                        contract.availableSupply(),
                        contract.isMintingOpen(),
                    ]);

                    if (cancelled) return;

                    setCollection((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            availableSupply:
                                results[0].status === 'fulfilled'
                                    ? results[0].value.properties.available
                                    : prev.availableSupply,
                            isMintingOpen:
                                results[1].status === 'fulfilled'
                                    ? results[1].value.properties.isOpen
                                    : prev.isMintingOpen,
                        };
                    });
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
