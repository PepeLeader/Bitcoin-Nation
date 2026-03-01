import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { forumService } from '../services/ForumService';
import { getHolderCount } from '../utils/holders';
import { loadApprovedRegistryAddresses, loadExternalCollectionMeta } from '../utils/externalCollections';
import { generateCollectionIcon } from '../utils/tokenImage';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { volumeService } from '../services/VolumeService';

interface CollectionData {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly volume: bigint;
    readonly holders: number;
    readonly listings: number;
    readonly engagement: number;
    readonly totalSupply: bigint;
    readonly maxSupply: bigint;
    readonly isMintingOpen: boolean;
    readonly approvalStatus: number;
}

interface RankedCollection extends CollectionData {
    readonly rank: number;
    readonly volumePoints: number;
    readonly holdersPoints: number;
    readonly engagementPoints: number;
    readonly score: number;
}

const VOLUME_MAX = 60;
const HOLDERS_MAX = 25;
const ENGAGEMENT_MAX = 15;

/**
 * Rank-based scoring: 1st place gets maxPoints, 2nd gets maxPoints-1, etc.
 * Ties share the same rank (and points). Scores floor at 0.
 */
function assignRankPoints<T>(
    items: readonly T[],
    getValue: (item: T) => number,
    maxPoints: number,
): readonly number[] {
    const indexed = items.map((item, i) => ({ i, val: getValue(item) }));
    indexed.sort((a, b) => b.val - a.val);

    const points = new Array<number>(items.length).fill(0);
    let currentRank = 0;
    let prevVal: number | null = null;

    for (const entry of indexed) {
        if (prevVal === null || entry.val < prevVal) {
            currentRank = prevVal === null ? 0 : currentRank + 1;
            prevVal = entry.val;
        }
        points[entry.i] = Math.max(0, maxPoints - currentRank);
    }

    return points;
}

export function LandingPage(): React.JSX.Element {
    const { network } = useWallet();
    const navigate = useNavigate();
    const { getListingCount, getListing } = useMarketplaceContract();
    const [rawCollections, setRawCollections] = useState<readonly CollectionData[]>([]);
    const [listingCounts, setListingCounts] = useState<ReadonlyMap<string, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'1h' | '1d' | '7d' | '30d'>('7d');

    // Compute the "since" timestamp from the selected timeframe
    const sinceTimestamp = useMemo(() => {
        const ms = { '1h': 3_600_000, '1d': 86_400_000, '7d': 604_800_000, '30d': 2_592_000_000 };
        return Date.now() - ms[timeframe];
    }, [timeframe]);

    // Compute ranked scores from raw data, re-filtered by timeframe
    const rankedCollections = useMemo(() => {
        const approved = rawCollections.filter((c) => c.approvalStatus === 2);
        if (approved.length === 0) return [];

        // Recalculate engagement and volume per timeframe
        const withMetrics = approved.map((c) => ({
            ...c,
            engagement: forumService.getEngagement(c.address, sinceTimestamp),
            volume: volumeService.getVolume(c.address, sinceTimestamp),
        }));

        const volPoints = assignRankPoints(withMetrics, (c) => Number(c.volume), VOLUME_MAX);
        const holPoints = assignRankPoints(withMetrics, (c) => c.holders, HOLDERS_MAX);
        const engPoints = assignRankPoints(withMetrics, (c) => c.engagement, ENGAGEMENT_MAX);

        const scored: RankedCollection[] = withMetrics.map((c, i) => {
            const vp = volPoints[i] ?? 0;
            const hp = holPoints[i] ?? 0;
            const ep = engPoints[i] ?? 0;
            return {
                ...c,
                rank: 0,
                volumePoints: vp,
                holdersPoints: hp,
                engagementPoints: ep,
                score: vp + hp + ep,
            };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.map((c, i) => ({ ...c, rank: i + 1 }));
    }, [rawCollections, sinceTimestamp]);

    const loadCollections = useCallback(async (): Promise<void> => {
        try {
            const factory = contractService.getFactory(network);
            const countResult = await factory.collectionCount();
            const count = countResult.properties.count;
            const limit = count < 20n ? count : 20n;

            // Phase 1: fetch all collection addresses in parallel
            const indexPromises: Promise<string | null>[] = [];
            for (let i = 0n; i < limit; i++) {
                indexPromises.push(
                    factory.collectionAtIndex(i)
                        .then((r) => String(r.properties.collectionAddress))
                        .catch(() => null),
                );
            }
            const addresses = (await Promise.all(indexPromises)).filter(
                (a): a is string => a !== null,
            );

            // Phase 2: fetch metadata + holder counts in parallel
            const detailPromises = addresses.map(async (addr) => {
                try {
                    const nft = contractService.getNFTContract(addr, network);
                    const [meta, maxSup, mintOpen, statusResult] = await Promise.all([
                        nft.metadata(),
                        nft.maxSupply(),
                        nft.isMintingOpen(),
                        factory.approvalStatus(Address.fromString(addr)),
                    ]);

                    const supply = Number(meta.properties.totalSupply);
                    const holders = await getHolderCount(addr, supply, network);

                    return {
                        address: addr,
                        name: meta.properties.name,
                        symbol: meta.properties.symbol,
                        icon: meta.properties.icon,
                        volume: 0n,
                        holders,
                        listings: 0,
                        engagement: forumService.getEngagement(addr),
                        totalSupply: meta.properties.totalSupply,
                        maxSupply: maxSup.properties.maxSupply,
                        isMintingOpen: mintOpen.properties.isOpen,
                        approvalStatus: Number(statusResult.properties.status),
                    } as CollectionData;
                } catch {
                    return null;
                }
            });

            const factoryResults = await Promise.all(detailPromises);
            const factoryCollections = factoryResults.filter((r): r is CollectionData => r !== null);

            // Merge approved external collections from registry
            const factoryAddressSet = new Set(addresses);
            const registryAddresses = await loadApprovedRegistryAddresses(network);
            const externalAddresses = registryAddresses.filter((a) => !factoryAddressSet.has(a));

            const externalPromises = externalAddresses.map(async (addr): Promise<CollectionData | null> => {
                const meta = await loadExternalCollectionMeta(addr, network);
                if (!meta) return null;
                const holders = await getHolderCount(addr, Number(meta.totalSupply), network);
                return {
                    address: addr,
                    name: meta.name,
                    symbol: meta.symbol,
                    icon: meta.icon,
                    volume: 0n,
                    holders,
                    listings: 0,
                    engagement: forumService.getEngagement(addr),
                    totalSupply: meta.totalSupply,
                    maxSupply: meta.maxSupply,
                    isMintingOpen: meta.isMintingOpen,
                    approvalStatus: 2, // Only approved submissions are returned
                };
            });

            const externalResults = await Promise.all(externalPromises);
            const externalCollections = externalResults.filter((r): r is CollectionData => r !== null);

            setRawCollections([...factoryCollections, ...externalCollections]);
        } catch {
            // factory not deployed yet
        } finally {
            setLoading(false);
        }
    }, [network]);

    const loadListingCounts = useCallback(async (): Promise<void> => {
        try {
            const count = await getListingCount();
            const counts = new Map<string, number>();
            const salesToCheck: { id: bigint; listing: ListingData }[] = [];

            for (let i = 0n; i < count && i < 200n; i++) {
                try {
                    const listing = await getListing(i);
                    if (listing.active) {
                        const addr = listing.collection;
                        counts.set(addr, (counts.get(addr) ?? 0) + 1);
                    } else if (!volumeService.hasSale(i)) {
                        salesToCheck.push({ id: i, listing });
                    }
                } catch {
                    // skip
                }
            }

            // Check inactive listings in parallel to determine sold vs delisted
            const checkPromises = salesToCheck.map(async ({ id, listing }) => {
                try {
                    const nft = contractService.getNFTContract(listing.collection, network);
                    const ownerResult = await nft.ownerOf(listing.tokenId);
                    const currentOwner = String(ownerResult.properties.owner).toLowerCase();
                    const seller = listing.seller.toLowerCase();
                    if (currentOwner !== seller) {
                        volumeService.recordSale(id, listing.collection, listing.price);
                    }
                } catch {
                    // Can't determine ownership — skip
                }
            });
            await Promise.all(checkPromises);

            setListingCounts(counts);
        } catch {
            // marketplace not deployed yet
        }
    }, [getListingCount, getListing, network]);

    useEffect(() => {
        void loadCollections();
        void loadListingCounts();
    }, [loadCollections, loadListingCounts]);

    // Shooting star spawner

    return (
        <div className="landing">
            {/* HERO */}
            <section className="landing-hero">
                <div className="landing-hero__actions">
                    <Link to="/marketplace" className="landing-btn-secondary">Marketplace</Link>
                    <Link to="/mints" className="landing-btn-secondary">Active Mints</Link>
                    <Link to="/collections" className="landing-btn-secondary">Explore Collections</Link>
                    <Link to="/create" className="landing-btn-secondary">Create Collection</Link>
                    <Link to="/nations" className="landing-btn-secondary">Gated Forums</Link>
                    <a href="https://x.com/BitcoinNationop" target="_blank" rel="noopener noreferrer" className="landing-btn-secondary landing-btn-icon" aria-label="X (Twitter)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                    </a>
                    <a href="https://t.me/BitcoinNationOP" target="_blank" rel="noopener noreferrer" className="landing-btn-secondary">Telegram</a>
                </div>
            </section>

            {/* RANKINGS */}
            <section className="landing-rankings">
                <div className="landing-rankings__layout">
                    {/* Collections table */}
                    <div className="landing-table-wrap">
                    <div className="landing-timeframe-bar">
                        {(['1h', '1d', '7d', '30d'] as const).map((tf) => (
                            <button
                                key={tf}
                                type="button"
                                className={`landing-timeframe-btn${timeframe === tf ? ' landing-timeframe-btn--active' : ''}`}
                                onClick={() => setTimeframe(tf)}
                            >
                                {tf === '1h' ? '1 Hour' : tf === '1d' ? '1 Day' : tf === '7d' ? '7 Days' : '1 Month'}
                            </button>
                        ))}
                    </div>
                    <table className="landing-rankings-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Icon</th>
                                <th>Name</th>
                                <th>Volume</th>
                                <th>Holders</th>
                                <th>Listings</th>
                                <th>Engagement</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rankedCollections.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                        No approved collections yet.
                                    </td>
                                </tr>
                            )}
                            {loading && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                        Loading...
                                    </td>
                                </tr>
                            )}
                            {rankedCollections.map((col) => (
                                <tr key={col.address} onClick={() => navigate(`/collection/${col.address}`)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <span className={`landing-rank ${col.rank <= 3 ? 'landing-rank--top3' : ''}`}>
                                            {col.rank}
                                        </span>
                                    </td>
                                    <td>
                                        <img
                                            src={col.icon ? ipfsService.resolveIPFS(col.icon) : generateCollectionIcon(col.address)}
                                            alt=""
                                            className="landing-collection-cell__icon"
                                        />
                                    </td>
                                    <td>
                                        <span className="landing-collection-cell__name">{col.name}</span>
                                    </td>
                                    <td className="landing-mono">
                                        {col.volume >= 100_000_000n
                                            ? `${(Number(col.volume) / 100_000_000).toFixed(4)} BTC`
                                            : `${Number(col.volume).toLocaleString()} sats`}
                                    </td>
                                    <td className="landing-mono">{col.holders}</td>
                                    <td className="landing-mono">{listingCounts.get(col.address) ?? 0}</td>
                                    <td className="landing-mono">{col.engagement}</td>
                                    <td>
                                        <div className="landing-score-bar">
                                            <div className="landing-score-bar__wrap">
                                                <div
                                                    className="landing-score-bar__fill"
                                                    style={{ width: `${col.score}%` }}
                                                />
                                            </div>
                                            <span className="landing-score-bar__value">{col.score}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="landing-footer">
                <span className="landing-footer__brand"></span>
                <div className="landing-footer__links">
                    <a href="https://github.com" className="landing-footer__link" target="_blank" rel="noreferrer">GitHub</a>
                    <a href="https://x.com" className="landing-footer__link" target="_blank" rel="noreferrer">Twitter / X</a>
                    <a href="https://docs.opnet.org" className="landing-footer__link" target="_blank" rel="noreferrer">Docs</a>
                    <a href="#" className="landing-footer__link">Terms</a>
                </div>
                <p className="landing-footer__copy">&copy; 2026 Built with OPNet.</p>
            </footer>
        </div>
    );
}
