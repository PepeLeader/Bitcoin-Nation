import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { OpLogo } from '../components/common/OpLogo';
import { forumService } from '../services/ForumService';

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
    const { network, isConnected, openConnectModal } = useWallet();
    const navigate = useNavigate();
    const pendingEnter = useRef(false);
    const [rawCollections, setRawCollections] = useState<readonly CollectionData[]>([]);
    const [loading, setLoading] = useState(true);

    // Compute ranked scores from raw data
    const rankedCollections = useMemo(() => {
        const approved = rawCollections.filter((c) => c.approvalStatus === 2);
        if (approved.length === 0) return [];

        const volPoints = assignRankPoints(approved, (c) => Number(c.volume), VOLUME_MAX);
        const holPoints = assignRankPoints(approved, (c) => c.holders, HOLDERS_MAX);
        const engPoints = assignRankPoints(approved, (c) => c.engagement, ENGAGEMENT_MAX);

        const scored: RankedCollection[] = approved.map((c, i) => {
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
    }, [rawCollections]);

    // Navigate to /browse once wallet connects after clicking "Enter Your Nation"
    useEffect(() => {
        if (pendingEnter.current && isConnected) {
            pendingEnter.current = false;
            navigate('/portfolio');
        }
    }, [isConnected, navigate]);

    const handleEnterNation = (): void => {
        if (isConnected) {
            navigate('/portfolio');
        } else {
            pendingEnter.current = true;
            openConnectModal();
        }
    };

    const loadCollections = useCallback(async (): Promise<void> => {
        try {
            const factory = contractService.getFactory(network);
            const countResult = await factory.collectionCount();
            const count = countResult.properties.count;
            const items: CollectionData[] = [];

            for (let i = 0n; i < count && i < 20n; i++) {
                try {
                    const addrResult = await factory.collectionAtIndex(i);
                    const addr = String(addrResult.properties.collectionAddress);
                    const nft = contractService.getNFTContract(addr, network);
                    const [meta, maxSup, mintOpen, statusResult] = await Promise.all([
                        nft.metadata(),
                        nft.maxSupply(),
                        nft.isMintingOpen(),
                        factory.approvalStatus(Address.fromString(addr)),
                    ]);

                    // Count unique holders by querying ownerOf for each minted token
                    const supply = Number(meta.properties.totalSupply);
                    let holders = 0;
                    if (supply > 0) {
                        const cap = Math.min(supply, 200);
                        const tokenIds = Array.from({ length: cap }, (_, j) => BigInt(j + 1));
                        const ownerResults = await Promise.all(
                            tokenIds.map((id) => nft.ownerOf(id).catch(() => null)),
                        );
                        const uniqueOwners = new Set<string>();
                        for (const result of ownerResults) {
                            if (result) {
                                uniqueOwners.add(String(result.properties.owner).toLowerCase());
                            }
                        }
                        holders = uniqueOwners.size;
                    }

                    items.push({
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
                    });
                } catch {
                    // skip broken collection
                }
            }

            setRawCollections(items);
        } catch {
            // factory not deployed yet
        } finally {
            setLoading(false);
        }
    }, [network]);

    useEffect(() => {
        void loadCollections();
    }, [loadCollections]);

    return (
        <div className="landing">
            {/* HERO */}
            <section className="landing-hero">
                <h1 className="landing-hero__headline">
                    <span className="landing-hero__brand">
                        Bitcoin Nation <OpLogo size={64} />
                    </span>
                </h1>
                <p className="landing-hero__headline" style={{ fontSize: 'clamp(1.2rem, 2vw, 1.75rem)', fontStyle: 'italic', color: 'var(--accent-primary)', marginBottom: '8px', opacity: 1, animation: 'none' }}>
                    Where community matters
                </p>
                <p className="landing-hero__sub">
                    Token-gated forums and market data for OP_721 NFT collections on
                    Bitcoin.
                </p>
                <div className="landing-hero__actions">
                    <button type="button" className="landing-btn-primary" onClick={handleEnterNation}>
                        Enter
                    </button>
                </div>
            </section>

            {/* RANKINGS */}
            <section className="landing-rankings">
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
                                <tr key={col.address} onClick={() => window.location.href = `/collection/${col.address}`}>
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
            </footer>
        </div>
    );
}
