import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';

interface NationCollection {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly balance: bigint;
    readonly holders: number;
}

export function NationsPage(): React.JSX.Element {
    const { isConnected, address, network } = useWallet();
    const [collections, setCollections] = useState<readonly NationCollection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isConnected || !address) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        void (async () => {
            setLoading(true);
            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const items: NationCollection[] = [];

                for (let i = 0n; i < count && i < 50n; i++) {
                    if (cancelled) return;

                    try {
                        const addrResult = await factory.collectionAtIndex(i);
                        const collAddr = String(addrResult.properties.collectionAddress);

                        const nft = contractService.getNFTContract(collAddr, network);
                        const [meta, balanceResult, statusResult] = await Promise.all([
                            nft.metadata(),
                            nft.balanceOf(address),
                            factory.approvalStatus(Address.fromString(collAddr)),
                        ]);

                        // Only show approved collections where user holds NFTs
                        const approvalStatus = Number(statusResult.properties.status);
                        const balance = balanceResult.properties.balance;
                        if (approvalStatus !== 2 || balance === 0n) continue;

                        // Count unique holders
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
                            address: collAddr,
                            name: meta.properties.name,
                            symbol: meta.properties.symbol,
                            icon: meta.properties.icon,
                            balance,
                            holders,
                        });
                    } catch {
                        // skip broken collection
                    }
                }

                if (!cancelled) setCollections(items);
            } catch {
                // factory not available
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
            <div className="portfolio-page">
                <div className="connect-prompt">
                    <h2>Connect Your Wallet</h2>
                    <p>Connect your wallet to view your nations.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-page">
            <div className="page-header">
                <h1>Your Nations</h1>
                <p>Token-gated forums for collections you hold</p>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading your nations...</p>
                </div>
            )}

            {!loading && collections.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No nations yet</p>
                    <p className="empty-state__description">
                        You don't hold any NFTs yet. Mint your first NFT to join a nation.
                    </p>
                    <Link to="/mints" className="btn btn--primary" style={{ marginTop: '16px' }}>
                        Active Mints
                    </Link>
                </div>
            )}

            {!loading && collections.length > 0 && (
                <div className="portfolio-grid">
                    {collections.map((col) => (
                        <Link
                            key={col.address}
                            to={`/nations/${col.address}`}
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
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <span className="badge">{col.holders} holders</span>
                                <span className="badge">{col.balance.toString()} owned</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
