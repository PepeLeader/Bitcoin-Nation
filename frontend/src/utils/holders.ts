import type { Network } from '@btc-vision/bitcoin';
import { contractService } from '../services/ContractService';

interface CacheEntry {
    readonly holders: number;
    readonly timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/**
 * Count unique holders by probing ownerOf across a range of token IDs.
 *
 * Because OP-721 has no global tokenByIndex, we must guess token IDs.
 * We use max(totalSupply, maxSupply, 100) capped at 500 so we cover:
 *   - 0-based and 1-based sequential IDs
 *   - Gaps from burned tokens (totalSupply shrinks but IDs don't)
 *   - External collections with unknown starting IDs
 */
export async function getHolderCount(
    collectionAddress: string,
    supply: number,
    network: Network,
): Promise<number> {
    const key = collectionAddress;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.holders;
    }

    const nft = contractService.getNFTContract(collectionAddress, network);

    // Fetch totalSupply directly if caller value is 0
    let totalSupply = supply;
    if (totalSupply <= 0) {
        try {
            const result = await nft.totalSupply();
            totalSupply = Number(result.properties.totalSupply);
        } catch {
            // not available
        }
    }

    // Fetch maxSupply — covers burned-token gaps (IDs go up to maxSupply
    // even when totalSupply is lower due to burns)
    let maxSupply = 0;
    try {
        const result = await nft.maxSupply();
        maxSupply = Number(result.properties.maxSupply);
    } catch {
        // not available
    }

    // Determine scan range: whichever is largest of totalSupply, maxSupply, or 100
    // Cap at 500 to avoid excessive RPC calls
    const scanMax = Math.min(Math.max(totalSupply, maxSupply, 100), 500);

    // Query IDs 0..scanMax to handle all token ID schemes
    const tokenIds = Array.from({ length: scanMax + 1 }, (_, j) => BigInt(j));
    const ownerResults = await Promise.all(
        tokenIds.map((id) => nft.ownerOf(id).catch(() => null)),
    );

    const uniqueOwners = new Set<string>();
    for (const result of ownerResults) {
        if (result) {
            const owner = String(result.properties.owner).toLowerCase();
            // Skip zero address (burned tokens)
            if (owner !== '0x' + '0'.repeat(64)) {
                uniqueOwners.add(owner);
            }
        }
    }

    const holders = uniqueOwners.size;
    cache.set(key, { holders, timestamp: Date.now() });
    return holders;
}
