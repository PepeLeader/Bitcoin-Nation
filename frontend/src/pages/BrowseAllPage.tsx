import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { getHolderCount } from '../utils/holders';

interface BrowseCollection {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly totalSupply: bigint;
    readonly maxSupply: bigint;
    readonly isMintingOpen: boolean;
    readonly holders: number;
}

type StatusFilter = 'all' | 'live' | 'closed' | 'minted-out';

function getStatusBadge(col: BrowseCollection): { label: string; className: string } {
    if (col.maxSupply > 0n && col.totalSupply >= col.maxSupply) {
        return { label: 'Minted Out', className: 'badge badge--muted' };
    }
    if (col.isMintingOpen) {
        return { label: 'Live', className: 'badge badge--success' };
    }
    return { label: 'Closed', className: 'badge badge--warning' };
}

function matchesFilter(col: BrowseCollection, filter: StatusFilter): boolean {
    if (filter === 'all') return true;
    const mintedOut = col.maxSupply > 0n && col.totalSupply >= col.maxSupply;
    if (filter === 'minted-out') return mintedOut;
    if (filter === 'live') return col.isMintingOpen && !mintedOut;
    return !col.isMintingOpen && !mintedOut;
}

export function BrowseAllPage(): React.JSX.Element {
    const { network } = useWallet();
    const [collections, setCollections] = useState<readonly BrowseCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('all');

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            setLoading(true);
            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const limit = count < 50n ? count : 50n;

                // Phase 1: fetch all addresses in parallel
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
                if (cancelled) return;

                // Phase 2: fetch metadata for all in parallel
                const detailPromises = addresses.map(async (addr) => {
                    try {
                        const nft = contractService.getNFTContract(addr, network);
                        const [meta, maxSup, mintOpen, statusResult] = await Promise.all([
                            nft.metadata(),
                            nft.maxSupply(),
                            nft.isMintingOpen(),
                            factory.approvalStatus(Address.fromString(addr)),
                        ]);

                        if (Number(statusResult.properties.status) !== 2) return null;

                        const supply = Number(meta.properties.totalSupply);
                        const holders = await getHolderCount(addr, supply, network);

                        return {
                            address: addr,
                            name: meta.properties.name,
                            symbol: meta.properties.symbol,
                            icon: meta.properties.icon,
                            totalSupply: meta.properties.totalSupply,
                            maxSupply: maxSup.properties.maxSupply,
                            isMintingOpen: mintOpen.properties.isOpen,
                            holders,
                        } as BrowseCollection;
                    } catch {
                        return null;
                    }
                });

                const results = await Promise.all(detailPromises);
                if (!cancelled) {
                    setCollections(results.filter((r): r is BrowseCollection => r !== null));
                }
            } catch {
                // factory not available
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [network]);

    const filtered = collections.filter((c) => matchesFilter(c, filter));

    return (
        <div className="portfolio-page">
            <div className="page-header">
                <h1>All Collections</h1>
                <p>Browse all approved OP_721 collections</p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-lg)' }}>
                {(['all', 'live', 'closed', 'minted-out'] as const).map((f) => (
                    <button
                        key={f}
                        type="button"
                        className={`btn btn--sm${filter === f ? ' btn--primary' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? 'All' : f === 'live' ? 'Live' : f === 'closed' ? 'Closed' : 'Minted Out'}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading collections...</p>
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No collections found</p>
                    <p className="empty-state__description">
                        {filter === 'all'
                            ? 'No approved collections yet.'
                            : 'No collections match this filter.'}
                    </p>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="portfolio-grid">
                    {filtered.map((col) => {
                        const badge = getStatusBadge(col);
                        return (
                            <Link
                                key={col.address}
                                to={`/collection/${col.address}`}
                                className="portfolio-card portfolio-card--clickable"
                            >
                                <div className="portfolio-card__header">
                                    {col.icon ? (
                                        <img
                                            src={ipfsService.resolveIPFS(col.icon)}
                                            alt=""
                                            className="portfolio-card__icon"
                                        />
                                    ) : (
                                        <div className="portfolio-card__icon portfolio-card__icon--fallback">
                                            {col.symbol.slice(0, 2)}
                                        </div>
                                    )}
                                    <div className="portfolio-card__info">
                                        <span className="portfolio-card__name">{col.name}</span>
                                        <span className="portfolio-card__symbol">{col.symbol}</span>
                                    </div>
                                </div>
                                <div className="portfolio-card__supply">
                                    {col.totalSupply.toString()} / {col.maxSupply === 0n ? '\u221E' : col.maxSupply.toString()} minted
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <span className={badge.className}>{badge.label}</span>
                                    <span className="badge">{col.holders} holders</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
