import type { Network } from '@btc-vision/bitcoin';
import { contractService } from '../services/ContractService';

interface CacheEntry {
    readonly holders: number;
    readonly timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export async function getHolderCount(
    collectionAddress: string,
    supply: number,
    network: Network,
): Promise<number> {
    if (supply <= 0) return 0;

    const key = collectionAddress;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.holders;
    }

    const nft = contractService.getNFTContract(collectionAddress, network);
    const cap = Math.min(supply, 200);
    // Query IDs 0..supply to handle both 0-based and 1-based token IDs
    const tokenIds = Array.from({ length: cap + 1 }, (_, j) => BigInt(j));
    const ownerResults = await Promise.all(
        tokenIds.map((id) => nft.ownerOf(id).catch(() => null)),
    );

    const uniqueOwners = new Set<string>();
    for (const result of ownerResults) {
        if (result) {
            uniqueOwners.add(String(result.properties.owner).toLowerCase());
        }
    }

    const holders = uniqueOwners.size;
    cache.set(key, { holders, timestamp: Date.now() });
    return holders;
}
