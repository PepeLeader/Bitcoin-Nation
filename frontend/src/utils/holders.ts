import type { Network } from '@btc-vision/bitcoin';
import { contractService } from '../services/ContractService';

const STORAGE_KEY = 'bn_holder_counts';
const CACHE_TTL_MS = 30 * 60_000; // 30 minutes — holders don't change rapidly

interface HolderCache {
    [address: string]: { holders: number; ts: number };
}

function loadCache(): HolderCache {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as HolderCache;
    } catch {
        return {};
    }
}

function saveEntry(address: string, holders: number): void {
    try {
        const cache = loadCache();
        cache[address] = { holders, ts: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
        // localStorage full or unavailable
    }
}

function getCached(address: string): number | null {
    const cache = loadCache();
    const entry = cache[address];
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
        return entry.holders;
    }
    return null;
}

// Track in-flight scans to avoid duplicate work
const pending = new Map<string, Promise<number>>();

/**
 * Get holder count for a collection.
 *
 * Returns cached value instantly if available (<30 min old).
 * Otherwise runs a full ownerOf scan in batches of 500.
 * Deduplicates concurrent requests for the same collection.
 */
export function getHolderCount(
    collectionAddress: string,
    supply: number,
    network: Network,
): Promise<number> {
    // Return cached value instantly
    const cached = getCached(collectionAddress);
    if (cached !== null) return Promise.resolve(cached);

    // Deduplicate in-flight scans
    const inflight = pending.get(collectionAddress);
    if (inflight) return inflight;

    const promise = scanHolders(collectionAddress, supply, network).finally(() => {
        pending.delete(collectionAddress);
    });
    pending.set(collectionAddress, promise);
    return promise;
}

async function scanHolders(
    collectionAddress: string,
    supply: number,
    network: Network,
): Promise<number> {
    const nft = contractService.getNFTContract(collectionAddress, network);

    // Get totalSupply directly if caller value is 0
    let totalSupply = supply;
    if (totalSupply <= 0) {
        try {
            const result = await nft.totalSupply();
            totalSupply = Number(result.properties.totalSupply);
        } catch {
            // not available
        }
    }

    // Get maxSupply — covers fully-minted collections
    let maxSupply = 0;
    try {
        const result = await nft.maxSupply();
        maxSupply = Number(result.properties.maxSupply);
    } catch {
        // not available
    }

    const scanMax = Math.max(totalSupply, maxSupply);
    if (scanMax <= 0) {
        saveEntry(collectionAddress, 0);
        return 0;
    }

    // Batch ownerOf calls in chunks of 500
    const BATCH = 500;
    const uniqueOwners = new Set<string>();
    const zeroAddr = '0x' + '0'.repeat(64);

    for (let start = 0; start <= scanMax; start += BATCH) {
        const end = Math.min(start + BATCH, scanMax + 1);
        const batch = Array.from({ length: end - start }, (_, j) => BigInt(start + j));

        const results = await Promise.all(
            batch.map((id) => nft.ownerOf(id).catch(() => null)),
        );

        for (const result of results) {
            if (result) {
                const owner = String(result.properties.owner).toLowerCase();
                if (owner !== zeroAddr) {
                    uniqueOwners.add(owner);
                }
            }
        }
    }

    const holders = uniqueOwners.size;
    saveEntry(collectionAddress, holders);
    return holders;
}
