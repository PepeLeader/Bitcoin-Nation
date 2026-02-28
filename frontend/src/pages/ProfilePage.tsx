import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { shortenAddress } from '../utils/formatting';
import { loadAllCollectionAddresses } from '../utils/externalCollections';

interface OwnedCollection {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly balance: bigint;
}

export function ProfilePage(): React.JSX.Element {
    const { isConnected, address, addressStr, network } = useWallet();
    const [collections, setCollections] = useState<readonly OwnedCollection[]>([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<'owned' | 'created'>('owned');

    useEffect(() => {
        if (!isConnected || !address) return;
        let cancelled = false;

        void (async () => {
            setLoading(true);
            try {
                const allAddresses = await loadAllCollectionAddresses(network);
                if (cancelled) return;

                const items: OwnedCollection[] = [];

                const checks = allAddresses.map(async (collAddr) => {
                    try {
                        const contract = contractService.getNFTContract(collAddr, network);
                        const [meta, balanceResult] = await Promise.all([
                            contract.metadata(),
                            contract.balanceOf(address),
                        ]);

                        const balance = balanceResult.properties.balance;
                        if (balance > 0n) {
                            return {
                                address: collAddr,
                                name: meta.properties.name,
                                symbol: meta.properties.symbol,
                                icon: meta.properties.icon,
                                balance,
                            } as OwnedCollection;
                        }
                    } catch {
                        // skip
                    }
                    return null;
                });

                const results = await Promise.all(checks);
                for (const r of results) {
                    if (r) items.push(r);
                }

                if (!cancelled) setCollections(items);
            } catch {
                // fail silently
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isConnected, address, network]);

    if (!isConnected) {
        return (
            <div className="profile-page">
                <div className="connect-prompt">
                    <h2>Connect Your Wallet</h2>
                    <p>View your NFTs and created collections.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="page-header">
                <h1>My Profile</h1>
                <p className="profile-address">{shortenAddress(addressStr ?? '')}</p>
            </div>

            <div className="profile-tabs">
                <button
                    type="button"
                    className={`tab ${tab === 'owned' ? 'active' : ''}`}
                    onClick={() => setTab('owned')}
                >
                    Owned NFTs
                </button>
                <button
                    type="button"
                    className={`tab ${tab === 'created' ? 'active' : ''}`}
                    onClick={() => setTab('created')}
                >
                    Created Collections
                </button>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                </div>
            )}

            {tab === 'owned' && !loading && (
                <div className="profile-collections">
                    {collections.length === 0 ? (
                        <div className="empty-state">
                            <p>You don't own any NFTs yet.</p>
                            <Link to="/browse" className="btn btn-primary">
                                Browse Collections
                            </Link>
                        </div>
                    ) : (
                        <div className="collections-grid">
                            {collections.map((col) => (
                                <Link
                                    key={col.address}
                                    to={`/collection/${col.address}`}
                                    className="collection-card"
                                >
                                    <div className="collection-card-body">
                                        {col.icon && (
                                            <img
                                                src={ipfsService.resolveIPFS(col.icon)}
                                                alt=""
                                                className="collection-card-icon"
                                            />
                                        )}
                                        <h3>{col.name}</h3>
                                        <span className="collection-card-symbol">
                                            {col.symbol}
                                        </span>
                                        <span className="badge">
                                            {col.balance.toString()} owned
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'created' && !loading && (
                <div className="empty-state">
                    <p>Created collections tracking coming soon.</p>
                </div>
            )}
        </div>
    );
}
