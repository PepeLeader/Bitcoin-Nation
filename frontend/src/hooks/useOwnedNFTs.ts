import { useState, useEffect } from 'react';
import { useWallet } from './useWallet';
import { contractService } from '../services/ContractService';
import type { NFTItem } from '../types/nft';

interface UseOwnedNFTsResult {
    readonly nfts: readonly NFTItem[];
    readonly loading: boolean;
    readonly error: string | null;
}

export function useOwnedNFTs(collectionAddress: string | undefined): UseOwnedNFTsResult {
    const { address, network, isConnected } = useWallet();
    const [nfts, setNfts] = useState<readonly NFTItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!collectionAddress || !address || !isConnected) {
            setNfts([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        void (async () => {
            try {
                const contract = contractService.getNFTContract(collectionAddress, network);
                const balanceResult = await contract.balanceOf(address);
                const balance = balanceResult.properties.balance;

                const items: NFTItem[] = [];
                const batchSize = 20;

                for (let i = 0n; i < balance && i < BigInt(batchSize); i++) {
                    if (cancelled) return;

                    const tokenIdResult = await contract.tokenOfOwnerByIndex(address, i);
                    const tokenId = tokenIdResult.properties.tokenId;
                    const uriResult = await contract.tokenURI(tokenId);

                    items.push({
                        tokenId,
                        owner: String(address),
                        uri: uriResult.properties.uri,
                        collectionAddress,
                    });
                }

                if (!cancelled) setNfts(items);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load NFTs');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [collectionAddress, address, network, isConnected]);

    return { nfts, loading, error };
}
