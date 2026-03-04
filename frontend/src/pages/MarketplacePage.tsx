import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { providerService } from '../services/ProviderService';
import { ipfsService } from '../services/IPFSService';
import { volumeService } from '../services/VolumeService';
import { forumService } from '../services/ForumService';
import { getHolderCount } from '../utils/holders';
import { loadApprovedRegistryAddresses, loadExternalCollectionMeta } from '../utils/externalCollections';
import { generateCollectionIcon } from '../utils/tokenImage';
import { assignRankPoints, VOLUME_MAX, HOLDERS_MAX, ENGAGEMENT_MAX } from '../utils/ranking';

interface ActiveListing extends ListingData {
    readonly id: bigint;
}

interface CollectionSummary {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly listingCount: number;
    readonly floorPrice: bigint;
}

/** Fetch indices in parallel batches of BATCH_SIZE */
const BATCH_SIZE = 20;

async function fetchInBatches<T>(
    count: bigint,
    limit: bigint,
    fetcher: (i: bigint) => Promise<T | null>,
    cancelled: { current: boolean },
): Promise<T[]> {
    const results: T[] = [];
    const total = count < limit ? count : limit;
    for (let start = 0n; start < total; start += BigInt(BATCH_SIZE)) {
        if (cancelled.current) return results;
        const end = start + BigInt(BATCH_SIZE) < total ? start + BigInt(BATCH_SIZE) : total;
        const batch: Promise<T | null>[] = [];
        for (let i = start; i < end; i++) {
            batch.push(fetcher(i));
        }
        const batchResults = await Promise.all(batch);
        for (const r of batchResults) {
            if (r !== null) results.push(r);
        }
    }
    return results;
}

export function MarketplacePage(): React.JSX.Element {
    const { network, isConnected } = useWallet();
    const { getListingCount, getListing, getReservationCount, getReservation } = useMarketplaceContract();
    const [collections, setCollections] = useState<readonly CollectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const rankingBuilt = useRef(false);

    const loadCollections = useCallback(async (cancelled: { current: boolean }): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            // Phase 1: Fetch listings + reservations in parallel batches
            const countP = getListingCount();
            const resMetaP = Promise.all([
                getReservationCount(),
                providerService.getProvider(network).getBlockNumber(),
            ]);

            const [count, resMeta] = await Promise.all([countP, resMetaP]);
            const [resCount, currentBlock] = resMeta;

            // Fetch listings and reservations concurrently (both batched)
            const [activeListings, reservations] = await Promise.all([
                fetchInBatches<ActiveListing>(
                    count, 200n,
                    async (i) => {
                        try {
                            const listing = await getListing(i);
                            return listing.active ? { ...listing, id: i } : null;
                        } catch { return null; }
                    },
                    cancelled,
                ),
                fetchInBatches(
                    resCount, 500n,
                    async (i) => {
                        try {
                            const res = await getReservation(i);
                            return (res.active && res.expiryBlock > currentBlock)
                                ? res.listingId.toString()
                                : null;
                        } catch { return null; }
                    },
                    cancelled,
                ),
            ]);

            if (cancelled.current) return;

            const reservedIds = new Set(reservations);

            // Filter out reserved listings and group by collection
            const groupMap = new Map<string, ActiveListing[]>();
            for (const listing of activeListings) {
                if (reservedIds.has(listing.id.toString())) continue;
                let group = groupMap.get(listing.collection);
                if (!group) {
                    group = [];
                    groupMap.set(listing.collection, group);
                }
                group.push(listing);
            }

            // Phase 2: Resolve collection metadata in parallel for all groups
            const entries = Array.from(groupMap.entries());
            const metaResults = await Promise.all(
                entries.map(async ([address, listings]) => {
                    let name = 'Unknown';
                    let symbol = '???';
                    let icon = '';
                    try {
                        const contract = contractService.getNFTContract(address, network);
                        const meta = await contract.metadata();
                        name = meta.properties.name;
                        symbol = meta.properties.symbol;
                        icon = meta.properties.icon;
                    } catch { /* defaults */ }

                    const first = listings[0];
                    if (!first) return null;

                    const floorPrice = listings.reduce(
                        (min, l) => (l.price < min ? l.price : min),
                        first.price,
                    );

                    return { address, name, symbol, icon, listingCount: listings.length, floorPrice } as CollectionSummary;
                }),
            );

            if (cancelled.current) return;

            const summaries = metaResults.filter((s): s is CollectionSummary => s !== null);
            setCollections(summaries);
            setLoading(false);

            // Phase 3: Build ranking in background (non-blocking — UI is already visible)
            if (!rankingBuilt.current) {
                rankingBuilt.current = true;
                void buildRanking(summaries, cancelled);
            }
        } catch (err) {
            if (!cancelled.current) {
                setError(err instanceof Error ? err.message : 'Failed to load listings');
                setLoading(false);
            }
        }
    }, [network, getListingCount, getListing, getReservationCount, getReservation]);

    const buildRanking = useCallback(async (
        currentSummaries: readonly CollectionSummary[],
        cancelled: { current: boolean },
    ): Promise<void> => {
        try {
            const rankMap = new Map<string, number>();
            const factory = contractService.getFactory(network);
            const countResult = await factory.collectionCount();
            const fCount = countResult.properties.count;
            const fLimit = fCount < 20n ? fCount : 20n;

            const indexPromises: Promise<string | null>[] = [];
            for (let i = 0n; i < fLimit; i++) {
                indexPromises.push(
                    factory.collectionAtIndex(i)
                        .then((r) => String(r.properties.collectionAddress))
                        .catch(() => null),
                );
            }
            const allAddresses = (await Promise.all(indexPromises)).filter(
                (a): a is string => a !== null,
            );

            if (cancelled.current) return;

            const since = Date.now() - 604_800_000;
            const allData = await Promise.all(allAddresses.map(async (addr) => {
                try {
                    const nft = contractService.getNFTContract(addr, network);
                    const [meta, statusResult] = await Promise.all([
                        nft.metadata(),
                        factory.approvalStatus(Address.fromString(addr)),
                    ]);
                    if (Number(statusResult.properties.status) !== 2) return null;
                    const supply = Number(meta.properties.totalSupply);
                    const holders = await getHolderCount(addr, supply, network);
                    const vol = volumeService.getVolume(addr, since);
                    const forumEng = forumService.getEngagement(addr, since);
                    const saleCount = volumeService.getSaleCount(addr, since);
                    return { address: addr, volume: vol, holders, totalSupply: supply, engagement: forumEng + saleCount + supply };
                } catch { return null; }
            }));
            const approved = allData.filter((d): d is NonNullable<typeof d> => d !== null);

            // Also include approved external/registry collections
            const factorySet = new Set(allAddresses);
            try {
                const regAddrs = await loadApprovedRegistryAddresses(network);
                const extAddrs = regAddrs.filter((a) => !factorySet.has(a));
                const extData = await Promise.all(extAddrs.map(async (addr) => {
                    try {
                        const meta = await loadExternalCollectionMeta(addr, network);
                        if (!meta) return null;
                        const supply = Number(meta.totalSupply);
                        const holders = await getHolderCount(addr, supply, network);
                        const vol = volumeService.getVolume(addr, since);
                        const forumEng = forumService.getEngagement(addr, since);
                        const saleCount = volumeService.getSaleCount(addr, since);
                        return { address: addr, volume: vol, holders, totalSupply: supply, engagement: forumEng + saleCount + supply };
                    } catch { return null; }
                }));
                for (const d of extData) { if (d) approved.push(d); }
            } catch { /* registry not available */ }

            if (cancelled.current) return;

            const volPts = assignRankPoints(approved, (c) => Number(c.volume), VOLUME_MAX);
            const holPts = assignRankPoints(
                approved,
                (c) => (c.totalSupply > 0 ? c.holders / c.totalSupply : 0),
                HOLDERS_MAX,
            );
            const engPts = assignRankPoints(approved, (c) => c.engagement, ENGAGEMENT_MAX);

            const scored = approved.map((c, i) => {
                const vp = c.volume === 0n ? 0 : (volPts[i] ?? 0);
                return { address: c.address, score: vp + (holPts[i] ?? 0) + (engPts[i] ?? 0) };
            });
            scored.sort((a, b) => b.score - a.score);
            scored.forEach((s, i) => rankMap.set(s.address, i));

            // Re-sort current summaries by rank
            const sorted = [...currentSummaries].sort((a, b) => {
                const ra = rankMap.get(a.address) ?? Number.MAX_SAFE_INTEGER;
                const rb = rankMap.get(b.address) ?? Number.MAX_SAFE_INTEGER;
                return ra - rb;
            });

            if (!cancelled.current) setCollections(sorted);
        } catch {
            // Ranking failed — keep existing order
        }
    }, [network]);

    useEffect(() => {
        rankingBuilt.current = false;
        const cancelled = { current: false };
        void loadCollections(cancelled);
        return () => { cancelled.current = true; };
    }, [loadCollections]);

    function resolveCollectionIcon(col: CollectionSummary): string {
        return col.icon
            ? ipfsService.resolveIPFS(col.icon)
            : generateCollectionIcon(col.address);
    }

    function formatPrice(sats: bigint): string {
        if (sats >= 100_000_000n) {
            const btc = Number(sats) / 100_000_000;
            return `${btc.toFixed(8)} BTC`;
        }
        return `${sats.toLocaleString()} sats`;
    }

    return (
        <div className="marketplace-page">
            <div className="page-header">
                <div className="marketplace-page__header-row">
                    <div>
                        <h1>Marketplace</h1>
                        <p>Buy and sell OP-721 NFTs</p>
                    </div>
                    {isConnected && (
                        <Link to="/marketplace/list" className="btn btn--primary marketplace-list-btn">
                            List NFT for Sale
                        </Link>
                    )}
                </div>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading marketplace...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}

            {!loading && !error && collections.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No active listings</p>
                    <p className="empty-state__subtitle">
                        {isConnected
                            ? 'Be the first to list an NFT for sale!'
                            : 'Connect your wallet to list NFTs.'}
                    </p>
                </div>
            )}

            {!loading && collections.length > 0 && (
                <div className="marketplace-collection-browse">
                    {collections.map((col) => (
                        <Link
                            key={col.address}
                            to={`/marketplace/collection/${col.address}`}
                            className="marketplace-collection-card"
                        >
                            <img
                                src={resolveCollectionIcon(col)}
                                alt=""
                                className="marketplace-collection-card__icon"
                                loading="lazy"
                            />
                            <div className="marketplace-collection-card__info">
                                <span className="marketplace-collection-card__name">
                                    {col.name}
                                </span>
                                {col.symbol && (
                                    <span className="marketplace-collection-card__symbol">
                                        {col.symbol}
                                    </span>
                                )}
                            </div>
                            <div className="marketplace-collection-card__stats">
                                <span className="marketplace-collection-card__count">
                                    {col.listingCount} listed
                                </span>
                                <span className="marketplace-collection-card__floor">
                                    Floor: {formatPrice(col.floorPrice)}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
