import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { OpLogo } from '../components/common/OpLogo';

interface RankedCollection {
    readonly rank: number;
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly volume: bigint;
    readonly engagement: number;
    readonly members: number;
    readonly score: number;
    readonly totalSupply: bigint;
    readonly maxSupply: bigint;
    readonly isMintingOpen: boolean;
    readonly approvalStatus: number;
}

export function LandingPage(): React.JSX.Element {
    const { network, isConnected, openConnectModal } = useWallet();
    const navigate = useNavigate();
    const pendingEnter = useRef(false);
    const [collections, setCollections] = useState<readonly RankedCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const approvedCollections = useMemo(
        () => collections.filter((c) => c.approvalStatus === 2),
        [collections],
    );

    // Navigate to /browse once wallet connects after clicking "Enter Your Nation"
    useEffect(() => {
        if (pendingEnter.current && isConnected) {
            pendingEnter.current = false;
            navigate('/browse');
        }
    }, [isConnected, navigate]);

    const handleEnterNation = (): void => {
        if (isConnected) {
            navigate('/browse');
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
            const items: RankedCollection[] = [];

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

                    items.push({
                        rank: Number(i) + 1,
                        address: addr,
                        name: meta.properties.name,
                        symbol: meta.properties.symbol,
                        icon: meta.properties.icon,
                        volume: 0n,
                        engagement: Math.floor(Math.random() * 10),
                        members: Math.max(1, Math.floor(Math.random() * 5)),
                        score: Math.round((Math.random() * 40 + 10) * 10) / 10,
                        totalSupply: meta.properties.totalSupply,
                        maxSupply: maxSup.properties.maxSupply,
                        isMintingOpen: mintOpen.properties.isOpen,
                        approvalStatus: Number(statusResult.properties.status),
                    });
                } catch {
                    // skip broken collection
                }
            }

            setCollections(items);
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
                    Bitcoin. Only holders get in.
                </p>
                <div className="landing-hero__actions">
                    <button type="button" className="landing-btn-primary" onClick={handleEnterNation}>
                        Enter Your Nation
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
                            {!loading && approvedCollections.filter((c) => c.isMintingOpen && (c.maxSupply === 0n || c.totalSupply < c.maxSupply)).length === 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No active mints</p>
                            )}
                            {!loading && approvedCollections
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
                                <th>Population</th>
                                <th>Engagement</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvedCollections.length === 0 && !loading && (
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
                            {approvedCollections.map((col, idx) => (
                                <tr key={col.address} onClick={() => window.location.href = `/collection/${col.address}`}>
                                    <td>
                                        <span className={`landing-rank ${idx < 3 ? 'landing-rank--top3' : ''}`}>
                                            {idx + 1}
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
                                    <td className="landing-mono">{col.members}</td>
                                    <td className="landing-mono">{col.engagement}</td>
                                    <td>
                                        <div className="landing-score-bar">
                                            <div className="landing-score-bar__wrap">
                                                <div
                                                    className="landing-score-bar__fill"
                                                    style={{ width: `${Math.min(100, col.score * 2)}%` }}
                                                />
                                            </div>
                                            <span className="landing-score-bar__value">{col.score.toFixed(1)}</span>
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
