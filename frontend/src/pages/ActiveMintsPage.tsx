import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { formatSats } from '../utils/formatting';
import type { CollectionInfo } from '../types/nft';

export function ActiveMintsPage(): React.JSX.Element {
    const { network } = useWallet();
    const [collections, setCollections] = useState<readonly CollectionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            setLoading(true);
            setError(null);

            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const limit = count < 50n ? count : 50n;

                // Phase 1: fetch all addresses in parallel
                const addressPromises: Promise<string | null>[] = [];
                for (let i = 0n; i < limit; i++) {
                    addressPromises.push(
                        factory.collectionAtIndex(i)
                            .then((r) => String(r.properties.collectionAddress))
                            .catch(() => null),
                    );
                }
                const addresses = (await Promise.all(addressPromises)).filter(
                    (a): a is string => a !== null,
                );

                if (cancelled) return;

                // Phase 2: pre-filter by approval status (1 call per collection)
                const statusPromises = addresses.map(async (addr): Promise<{ addr: string; approved: boolean }> => {
                    try {
                        const result = await factory.approvalStatus(Address.fromString(addr));
                        return { addr, approved: Number(result.properties.status) === 2 };
                    } catch {
                        return { addr, approved: false };
                    }
                });
                const statuses = await Promise.all(statusPromises);
                const approvedAddresses = statuses.filter((s) => s.approved).map((s) => s.addr);

                if (cancelled) return;

                // Phase 3: fetch details only for approved collections (5 calls each, not 7)
                const detailPromises = approvedAddresses.map(async (addr): Promise<CollectionInfo | null> => {
                    try {
                        const contract = contractService.getNFTContract(addr, network);
                        const [meta, maxSup, price, mintOpen] = await Promise.all([
                            contract.metadata(),
                            contract.maxSupply(),
                            contract.mintPrice(),
                            contract.isMintingOpen(),
                        ]);

                        const totalSupply = meta.properties.totalSupply;
                        const maxSupply = maxSup.properties.maxSupply;
                        const notMintedOut = maxSupply === 0n || totalSupply < maxSupply;

                        if (!notMintedOut) return null;

                        return {
                            address: addr,
                            name: meta.properties.name,
                            symbol: meta.properties.symbol,
                            icon: meta.properties.icon,
                            banner: meta.properties.banner,
                            description: meta.properties.description,
                            website: meta.properties.website,
                            totalSupply,
                            maxSupply,
                            mintPrice: price.properties.price,
                            maxPerWallet: 0n,
                            availableSupply: maxSupply > 0n ? maxSupply - totalSupply : 0n,
                            isMintingOpen: mintOpen.properties.isOpen,
                            approvalStatus: 2,
                        };
                    } catch {
                        return null;
                    }
                });

                const results = await Promise.all(detailPromises);
                if (!cancelled) setCollections(results.filter((r): r is CollectionInfo => r !== null));
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load collections');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [network]);

    function supplyPercent(col: CollectionInfo): number {
        if (col.maxSupply === 0n) return 0;
        return Number((col.totalSupply * 100n) / col.maxSupply);
    }

    return (
        <div className="active-mints-page">
            <div className="page-header">
                <h1>Active Mints</h1>
                <p>Collections available to mint</p>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading active mints...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}

            {!loading && !error && collections.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No active mints right now</p>
                    <p className="empty-state__description">
                        Check back later or browse all collections.
                    </p>
                    <Link to="/browse" className="btn btn--primary" style={{ marginTop: '16px' }}>
                        Browse Collections
                    </Link>
                </div>
            )}

            <div className="active-mints-grid">
                {collections.map((col) => (
                    <div key={col.address} className="mint-card">
                        <div className="mint-card__header">
                            {col.icon ? (
                                <img
                                    src={ipfsService.resolveIPFS(col.icon)}
                                    alt=""
                                    className="mint-card__icon"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="mint-card__icon mint-card__icon--fallback">
                                    {col.symbol.slice(0, 2)}
                                </div>
                            )}
                            <div className="mint-card__info">
                                <Link to={`/collection/${col.address}`} className="mint-card__name">
                                    {col.name}
                                </Link>
                                <span className="mint-card__symbol">{col.symbol}</span>
                            </div>
                            {col.isMintingOpen ? (
                                <span className="badge badge--success">Live</span>
                            ) : (
                                <span className="badge badge--warning">Closed</span>
                            )}
                        </div>

                        <div className="mint-card__supply">
                            <div className="mint-card__supply-labels">
                                <span>Supply</span>
                                <span>
                                    {col.totalSupply.toString()} / {col.maxSupply.toString()}
                                </span>
                            </div>
                            <div className="mint-card__supply-bar">
                                <div
                                    className="mint-card__supply-fill"
                                    style={{ width: `${supplyPercent(col)}%` }}
                                />
                            </div>
                        </div>

                        <div className="mint-card__footer">
                            <div className="mint-card__price">
                                <span className="mint-card__price-label">Price</span>
                                <span className="mint-card__price-value">
                                    {formatSats(col.mintPrice)}
                                </span>
                            </div>
                            <Link
                                to={`/collection/${col.address}/mint`}
                                className="btn btn--accent"
                            >
                                Mint
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
