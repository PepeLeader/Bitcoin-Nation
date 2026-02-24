import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import type { CollectionInfo } from '../types/nft';

export function BrowsePage(): React.JSX.Element {
    const { network, isConnected } = useWallet();
    const [collections, setCollections] = useState<readonly CollectionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isConnected) return;
        let cancelled = false;

        void (async () => {
            setLoading(true);
            setError(null);

            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const items: CollectionInfo[] = [];

                for (let i = 0n; i < count && i < 50n; i++) {
                    if (cancelled) return;

                    const addrResult = await factory.collectionAtIndex(i);
                    const addr = String(addrResult.properties.collectionAddress);

                    try {
                        const collectionAddr = Address.fromString(addr);
                        const statusResult = await factory.approvalStatus(collectionAddr);
                        if (Number(statusResult.properties.status) !== 2) continue;

                        const contract = contractService.getNFTContract(addr, network);
                        const [meta, maxSup, price, maxWallet, avail, mintOpen] = await Promise.all([
                            contract.metadata(),
                            contract.maxSupply(),
                            contract.mintPrice(),
                            contract.maxPerWallet(),
                            contract.availableSupply(),
                            contract.isMintingOpen(),
                        ]);

                        items.push({
                            address: addr,
                            name: meta.properties.name,
                            symbol: meta.properties.symbol,
                            icon: meta.properties.icon,
                            banner: meta.properties.banner,
                            description: meta.properties.description,
                            website: meta.properties.website,
                            totalSupply: meta.properties.totalSupply,
                            maxSupply: maxSup.properties.maxSupply,
                            mintPrice: price.properties.price,
                            maxPerWallet: maxWallet.properties.maxPerWallet,
                            availableSupply: avail.properties.available,
                            isMintingOpen: mintOpen.properties.isOpen,
                            approvalStatus: 2,
                        });
                    } catch {
                        // Skip collections that fail to load
                    }
                }

                if (!cancelled) setCollections(items);
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
    }, [network, isConnected]);

    return (
        <div className="browse-page">
            <div className="page-header">
                <h1>Browse Collections</h1>
                <p>All collections on Bitcoin Nation</p>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading collections...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}

            {!loading && collections.filter((c) => c.approvalStatus === 2).length === 0 && (
                <div className="empty-state">
                    <p>No collections yet.</p>
                    <Link to="/create" className="btn btn--primary" style={{ marginTop: '16px' }}>
                        Create the first one
                    </Link>
                </div>
            )}

            <div className="browse-grid">
                {collections.filter((col) => col.approvalStatus === 2).map((col) => (
                    <Link
                        key={col.address}
                        to={`/collection/${col.address}`}
                        className="browse-item"
                    >
                        <div className="browse-item__icon">
                            {col.icon ? (
                                <img
                                    src={ipfsService.resolveIPFS(col.icon)}
                                    alt=""
                                    loading="lazy"
                                />
                            ) : (
                                <span className="browse-item__icon-fallback">
                                    {col.symbol.slice(0, 2)}
                                </span>
                            )}
                        </div>
                        <span className="browse-item__name">{col.name}</span>
                        <span className="browse-item__symbol">{col.symbol}</span>
                        {col.isMintingOpen && (
                            <span className="badge badge--success" style={{ fontSize: '0.625rem' }}>Minting Live</span>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}
