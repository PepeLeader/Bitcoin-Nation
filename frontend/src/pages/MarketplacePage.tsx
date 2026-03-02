import { useState, useEffect, useCallback } from 'react';
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

export function MarketplacePage(): React.JSX.Element {
    const { network, isConnected } = useWallet();
    const { getListingCount, getListing, getReservationCount, getReservation } = useMarketplaceContract();
    const [collections, setCollections] = useState<readonly CollectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCollections = useCallback(async (cancelled: { current: boolean }): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const count = await getListingCount();

            // Gather active listings (no tokenURI needed — just collection + price)
            const activeListings: ActiveListing[] = [];
            for (let i = 0n; i < count && i < 200n; i++) {
                if (cancelled.current) return;
                try {
                    const listing = await getListing(i);
                    if (listing.active) activeListings.push({ ...listing, id: i });
                } catch {
                    // Skip broken listings
                }
            }

            // Build set of listing IDs with active, non-expired reservations
            const reservedListingIds = new Set<string>();
            try {
                const [resCount, currentBlock] = await Promise.all([
                    getReservationCount(),
                    providerService.getProvider(network).getBlockNumber(),
                ]);

                for (let i = 0n; i < resCount && i < 500n; i++) {
                    if (cancelled.current) return;
                    try {
                        const res = await getReservation(i);
                        if (res.active && res.expiryBlock > currentBlock) {
                            reservedListingIds.add(res.listingId.toString());
                        }
                    } catch {
                        // Skip broken reservations
                    }
                }
            } catch {
                // If reservation check fails, show all active listings
            }

            // Filter out reserved listings
            const available = activeListings.filter(
                (l) => !reservedListingIds.has(l.id.toString()),
            );

            // Group by collection address
            const groupMap = new Map<string, { listings: ActiveListing[] }>();
            for (const listing of available) {
                let group = groupMap.get(listing.collection);
                if (!group) {
                    group = { listings: [] };
                    groupMap.set(listing.collection, group);
                }
                group.listings.push(listing);
            }

            // Build global ranking from ALL approved collections (same as landing page)
            // so marketplace order matches the rankings table exactly.
            const rankMap = new Map<string, number>();
            try {
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

                // Fetch metadata for all collections in parallel
                const since = Date.now() - 604_800_000; // 7d, matches landing default
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

                // Rank all approved collections
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
            } catch {
                // If factory load fails, marketplace collections will show unsorted
            }

            // Resolve collection metadata for marketplace display
            const summaries: CollectionSummary[] = [];
            for (const [address, group] of groupMap) {
                if (cancelled.current) return;

                let name = 'Unknown';
                let symbol = '???';
                let icon = '';

                try {
                    const contract = contractService.getNFTContract(address, network);
                    const meta = await contract.metadata();
                    name = meta.properties.name;
                    symbol = meta.properties.symbol;
                    icon = meta.properties.icon;
                } catch {
                    // Use defaults
                }

                const first = group.listings[0];
                if (!first) continue;

                const floorPrice = group.listings.reduce(
                    (min, l) => (l.price < min ? l.price : min),
                    first.price,
                );

                summaries.push({
                    address,
                    name,
                    symbol,
                    icon,
                    listingCount: group.listings.length,
                    floorPrice,
                });
            }

            // Sort by global rank (collections not in rankMap go to end)
            summaries.sort((a, b) => {
                const ra = rankMap.get(a.address) ?? Number.MAX_SAFE_INTEGER;
                const rb = rankMap.get(b.address) ?? Number.MAX_SAFE_INTEGER;
                return ra - rb;
            });

            if (!cancelled.current) setCollections(summaries);
        } catch (err) {
            if (!cancelled.current) {
                setError(err instanceof Error ? err.message : 'Failed to load listings');
            }
        } finally {
            if (!cancelled.current) setLoading(false);
        }
    }, [network, getListingCount, getListing, getReservationCount, getReservation]);

    useEffect(() => {
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
