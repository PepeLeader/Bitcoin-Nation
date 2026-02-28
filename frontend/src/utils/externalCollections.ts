import { Address } from '@btc-vision/transaction';
import { type Network } from '@btc-vision/bitcoin';
import { contractService } from '../services/ContractService';

/**
 * Metadata fields for any OP-721 collection — standard or custom.
 */
export interface ExternalCollectionMeta {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly totalSupply: bigint;
    readonly maxSupply: bigint;
    readonly isMintingOpen: boolean;
}

/**
 * Load approved external collection addresses from the registry.
 * Returns hex addresses of submissions with approvalStatus === 2.
 */
export async function loadApprovedRegistryAddresses(
    network: Network,
): Promise<readonly string[]> {
    const registry = contractService.getRegistry(network);

    let count: bigint;
    try {
        const result = await registry.submissionCount();
        count = result.properties.count;
    } catch {
        return [];
    }

    const limit = count < 50n ? count : 50n;
    const addresses: string[] = [];

    for (let i = 0n; i < limit; i++) {
        try {
            const addrResult = await registry.submissionAtIndex(i);
            const addr = String(addrResult.properties.collectionAddress);

            const statusResult = await registry.submissionStatus(Address.fromString(addr));
            if (Number(statusResult.properties.status) === 2) {
                addresses.push(addr);
            }
        } catch {
            // Skip broken entries
        }
    }

    return addresses;
}

/**
 * Load all collection addresses from both Factory and Registry (approved only).
 * Returns deduplicated hex addresses.
 */
export async function loadAllCollectionAddresses(
    network: Network,
): Promise<readonly string[]> {
    const [factoryAddrs, registryAddrs] = await Promise.all([
        (async () => {
            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const limit = count < 50n ? count : 50n;
                const promises = Array.from({ length: Number(limit) }, (_, i) =>
                    factory.collectionAtIndex(BigInt(i))
                        .then((r) => String(r.properties.collectionAddress))
                        .catch(() => null),
                );
                return (await Promise.all(promises)).filter(
                    (a): a is string => a !== null,
                );
            } catch {
                return [];
            }
        })(),
        loadApprovedRegistryAddresses(network),
    ]);

    const seen = new Set(factoryAddrs);
    const merged = [...factoryAddrs];
    for (const addr of registryAddrs) {
        if (!seen.has(addr)) {
            seen.add(addr);
            merged.push(addr);
        }
    }
    return merged;
}

/**
 * Safely load basic metadata from any OP-721 contract.
 * Tries metadata() first, falls back to individual standard calls.
 */
export async function loadExternalCollectionMeta(
    addr: string,
    network: Network,
): Promise<ExternalCollectionMeta | null> {
    try {
        const contract = contractService.getNFTContract(addr, network);

        // Try bulk metadata() first
        let name = 'Unknown';
        let symbol = '???';
        let icon = '';
        let totalSupply = 0n;

        try {
            const meta = await contract.metadata();
            name = meta.properties.name;
            symbol = meta.properties.symbol;
            icon = meta.properties.icon;
            totalSupply = meta.properties.totalSupply;
        } catch {
            // Fallback to standard individual calls
            const results = await Promise.allSettled([
                contract.name(),
                contract.symbol(),
                contract.totalSupply(),
            ]);
            if (results[0].status === 'fulfilled') name = results[0].value.properties.name;
            if (results[1].status === 'fulfilled') symbol = results[1].value.properties.symbol;
            if (results[2].status === 'fulfilled') totalSupply = results[2].value.properties.totalSupply;
        }

        // Optional fields
        let maxSupply = 0n;
        let isMintingOpen = false;

        const custom = await Promise.allSettled([
            contract.maxSupply(),
            contract.isMintingOpen(),
        ]);
        if (custom[0].status === 'fulfilled') maxSupply = custom[0].value.properties.maxSupply;
        if (custom[1].status === 'fulfilled') isMintingOpen = custom[1].value.properties.isOpen;

        return { address: addr, name, symbol, icon, totalSupply, maxSupply, isMintingOpen };
    } catch {
        return null;
    }
}
