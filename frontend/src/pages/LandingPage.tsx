import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { forumService } from '../services/ForumService';
import { getHolderCount } from '../utils/holders';

interface CollectionData {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly volume: bigint;
    readonly holders: number;
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
    const [rawCollections, setRawCollections] = useState<readonly CollectionData[]>([]);
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

        // Recalculate engagement per timeframe
        const withEngagement = approved.map((c) => ({
            ...c,
            engagement: forumService.getEngagement(c.address, sinceTimestamp),
        }));

        const volPoints = assignRankPoints(withEngagement, (c) => Number(c.volume), VOLUME_MAX);
        const holPoints = assignRankPoints(withEngagement, (c) => c.holders, HOLDERS_MAX);
        const engPoints = assignRankPoints(withEngagement, (c) => c.engagement, ENGAGEMENT_MAX);

        const scored: RankedCollection[] = withEngagement.map((c, i) => {
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

            const results = await Promise.all(detailPromises);
            setRawCollections(results.filter((r): r is CollectionData => r !== null));
        } catch {
            // factory not deployed yet
        } finally {
            setLoading(false);
        }
    }, [network]);

    useEffect(() => {
        void loadCollections();
    }, [loadCollections]);

    // Shooting star spawner
    const spaceBgRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const container = spaceBgRef.current;
        if (!container) return;

        function spawnStar(): void {
            if (!container) return;
            const star = document.createElement('div');
            star.className = 'shooting-star';

            // Random angle between 200-340 deg (mostly downward arcs)
            const angle = 200 + Math.random() * 140;
            // Random start position (upper portion of viewport)
            const startX = Math.random() * 120 - 10;
            const startY = Math.random() * 40 - 10;
            // Travel distance, duration, tail length
            const dist = 300 + Math.random() * 400;
            const duration = 1.2 + Math.random() * 1.2;
            const tail = 80 + Math.random() * 120;

            star.style.left = `${startX}%`;
            star.style.top = `${startY}%`;
            star.style.setProperty('--angle', `${angle}deg`);
            star.style.setProperty('--dist', `${dist}px`);
            star.style.setProperty('--tail', `${tail}px`);
            star.style.animationDuration = `${duration}s`;

            container.appendChild(star);
            star.addEventListener('animationend', () => star.remove());
        }

        // Recursive timeout for truly random intervals (8-14s)
        let timer: ReturnType<typeof setTimeout>;
        function scheduleNext(): void {
            const delay = 8000 + Math.random() * 6000;
            timer = setTimeout(() => {
                spawnStar();
                scheduleNext();
            }, delay);
        }
        // First one after a short delay
        timer = setTimeout(() => {
            spawnStar();
            scheduleNext();
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    // UFO fly-by spawner — every ~60s
    useEffect(() => {
        const container = spaceBgRef.current;
        if (!container) return;

        function spawnUFO(): void {
            if (!container) return;
            const ufo = document.createElement('div');
            ufo.className = 'ufo';

            // Pick a side to enter from: 0=left, 1=right
            const fromLeft = Math.random() > 0.5;
            // Random vertical position (10-70% of viewport)
            const startY = 10 + Math.random() * 60;
            // Slight vertical drift during travel
            const drift = -30 + Math.random() * 60;
            // Duration 3-5s
            const duration = 3 + Math.random() * 2;

            ufo.style.top = `${startY}%`;
            ufo.style.setProperty('--drift', `${drift}px`);
            ufo.style.animationDuration = `${duration}s`;

            if (fromLeft) {
                ufo.style.left = '-60px';
                ufo.style.setProperty('--travel', `${window.innerWidth + 120}px`);
            } else {
                ufo.style.left = `${window.innerWidth + 60}px`;
                ufo.style.setProperty('--travel', `${-(window.innerWidth + 120)}px`);
            }

            container.appendChild(ufo);
            ufo.addEventListener('animationend', () => ufo.remove());
        }

        // First UFO after 30s, then every ~60s
        let ufoTimer: ReturnType<typeof setTimeout>;
        function scheduleUFO(): void {
            ufoTimer = setTimeout(() => {
                spawnUFO();
                scheduleUFO();
            }, 55000 + Math.random() * 10000);
        }
        ufoTimer = setTimeout(() => {
            spawnUFO();
            scheduleUFO();
        }, 30000);

        return () => clearTimeout(ufoTimer);
    }, []);

    return (
        <div className="landing">
            <div className="space-bg" ref={spaceBgRef} aria-hidden="true">
                <div className="space-bg__nebula space-bg__nebula--1" />
                <div className="space-bg__nebula space-bg__nebula--2" />
                <div className="space-bg__nebula space-bg__nebula--3" />
                <div className="space-bg__nebula space-bg__nebula--4" />
                <div className="space-bg__galaxy" />
                <div className="space-bg__planet space-bg__planet--gas-giant" />
                <div className="space-bg__planet space-bg__planet--ringed" />
                <div className="space-bg__planet space-bg__planet--distant" />
                <div className="space-bg__stars space-bg__stars--sm" />
                <div className="space-bg__stars space-bg__stars--md" />
                <div className="space-bg__stars space-bg__stars--lg" />
                <div className="space-bg__stars space-bg__stars--twinkle-a" />
                <div className="space-bg__stars space-bg__stars--twinkle-b" />
            </div>

            {/* HERO */}
            <section className="landing-hero">
                <h1 className="landing-hero__headline">Bitcoin Nation</h1>
                <p className="landing-hero__sub">
                    NFT Collections on Bitcoin L1 — powered by OPNet
                </p>
                <div className="landing-hero__actions">
                    <Link to="/collections" className="landing-btn-secondary">Explore Collections</Link>
                    <Link to="/mints" className="landing-btn-secondary">Active Mints</Link>
                    <Link to="/create" className="landing-btn-secondary">Create Collection</Link>
                </div>
                <div className="landing-hero__scroll"><span /></div>
            </section>

            {/* RANKINGS */}
            <section className="landing-rankings">
                <div className="landing-rankings__header">
                    <h2 className="landing-rankings__title">Collection Rankings</h2>
                </div>
                <div className="landing-rankings__layout">
                    {/* Active Mints sidebar */}
                    <div className="landing-active-mints">
                        <h3 className="landing-active-mints__title">Active Mints</h3>
                        <div className="landing-active-mints__list">
                            {loading && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading...</p>
                            )}
                            {!loading && rankedCollections.filter((c) => c.isMintingOpen && (c.maxSupply === 0n || c.totalSupply < c.maxSupply)).length === 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No active mints</p>
                            )}
                            {!loading && rankedCollections
                                .filter((c) => c.isMintingOpen && (c.maxSupply === 0n || c.totalSupply < c.maxSupply))
                                .slice(0, 5)
                                .map((col) => (
                                    <Link
                                        key={col.address}
                                        to={`/collection/${col.address}/mint`}
                                        className="landing-active-mint-item"
                                    >
                                        {col.icon ? (
                                            <img
                                                src={ipfsService.resolveIPFS(col.icon)}
                                                alt=""
                                                className="landing-active-mint-item__icon"
                                            />
                                        ) : (
                                            <div className="landing-active-mint-item__icon landing-active-mint-item__icon--fallback">
                                                {col.symbol.slice(0, 2)}
                                            </div>
                                        )}
                                        <span className="landing-active-mint-item__name">{col.name}</span>
                                        <span className="badge badge--success" style={{ marginLeft: 'auto', fontSize: '0.625rem' }}>Live</span>
                                    </Link>
                                ))}
                        </div>
                    </div>

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
                                <th>Engagement</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rankedCollections.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                        No approved collections yet.
                                    </td>
                                </tr>
                            )}
                            {loading && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
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
                                        {col.icon ? (
                                            <img
                                                src={ipfsService.resolveIPFS(col.icon)}
                                                alt=""
                                                className="landing-collection-cell__icon"
                                            />
                                        ) : (
                                            <div className="landing-collection-cell__icon landing-collection-cell__icon--fallback">
                                                {col.symbol.slice(0, 2)}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="landing-collection-cell__name">{col.name}</span>
                                    </td>
                                    <td className="landing-mono">{col.volume.toString()} sats</td>
                                    <td className="landing-mono">{col.holders}</td>
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
                <span className="landing-footer__brand">Bitcoin Nation</span>
                <div className="landing-footer__links">
                    <a href="https://github.com" className="landing-footer__link" target="_blank" rel="noreferrer">GitHub</a>
                    <a href="https://x.com" className="landing-footer__link" target="_blank" rel="noreferrer">Twitter / X</a>
                    <a href="https://docs.opnet.org" className="landing-footer__link" target="_blank" rel="noreferrer">Docs</a>
                    <a href="#" className="landing-footer__link">Terms</a>
                </div>
                <p className="landing-footer__copy">&copy; 2026 Bitcoin Nation. Built on OPNet.</p>
            </footer>
        </div>
    );
}
