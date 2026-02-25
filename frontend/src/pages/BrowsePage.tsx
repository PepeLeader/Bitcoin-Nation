import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { useApprovalContract } from '../hooks/useApprovalContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import type { CollectionInfo } from '../types/nft';

const STATUS_LABELS: readonly string[] = ['Not Applied', 'Pending', 'Approved', 'Rejected'];

function statusClass(status: number): string {
    switch (status) {
        case 1: return 'approval-badge--pending';
        case 2: return 'approval-badge--approved';
        case 3: return 'approval-badge--rejected';
        default: return 'approval-badge--none';
    }
}

export function BrowsePage(): React.JSX.Element {
    const { network, isConnected, address: walletAddress, addressStr } = useWallet();
    const { applyForMint, loading: applyLoading, error: applyError } = useApprovalContract();
    const [collections, setCollections] = useState<readonly CollectionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load collections created by the user
    useEffect(() => {
        if (!isConnected || !addressStr) return;
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
                        const creatorResult = await factory.collectionCreator(collectionAddr);
                        const creator = creatorResult.properties.creator;

                        if (!walletAddress || !creator.equals(walletAddress)) continue;

                        const contract = contractService.getNFTContract(addr, network);
                        const [meta, maxSup, price, maxWallet, avail, mintOpen, statusResult] = await Promise.all([
                            contract.metadata(),
                            contract.maxSupply(),
                            contract.mintPrice(),
                            contract.maxPerWallet(),
                            contract.availableSupply(),
                            contract.isMintingOpen(),
                            factory.approvalStatus(collectionAddr),
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
                            approvalStatus: Number(statusResult.properties.status),
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
    }, [network, isConnected, walletAddress, addressStr]);

    async function handleApply(collectionAddress: string): Promise<void> {
        try {
            await applyForMint(collectionAddress);
            setCollections((prev) =>
                prev.map((c) =>
                    c.address === collectionAddress ? { ...c, approvalStatus: 1 } : c,
                ),
            );
        } catch {
            // error displayed via applyError
        }
    }

    return (
        <div className="browse-page">
            <div className="page-header">
                <h1>My Projects</h1>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading your collections...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}

            {!loading && !error && collections.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No collections yet</p>
                    <p className="empty-state__description">
                        Create your first NFT collection to get started.
                    </p>
                    <Link to="/create" className="btn btn--primary" style={{ marginTop: '16px' }}>
                        + Create Collection
                    </Link>
                </div>
            )}

            {applyError && <div className="form-error" style={{ marginBottom: '16px' }}>{applyError}</div>}

            <div className="portfolio-grid">
                {collections.map((col) => (
                    <Link key={col.address} to={`/collection/${col.address}`} className="portfolio-card portfolio-card--clickable">
                        <div className="portfolio-card__header">
                            {col.icon ? (
                                <img
                                    src={ipfsService.resolveIPFS(col.icon)}
                                    alt=""
                                    className="portfolio-card__icon"
                                    loading="lazy"
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
                            <span className={`approval-badge ${statusClass(col.approvalStatus)}`}>
                                {STATUS_LABELS[col.approvalStatus] ?? 'Unknown'}
                            </span>
                        </div>

                        <div className="portfolio-card__supply">
                            <span>
                                {col.totalSupply.toString()} / {col.maxSupply === 0n ? 'Unlimited' : col.maxSupply.toString()}
                            </span>
                        </div>

                        {(col.approvalStatus === 0 || col.approvalStatus === 3) && (
                            <div className="portfolio-card__actions">
                                <button
                                    type="button"
                                    className="btn btn--primary"
                                    disabled={applyLoading}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        void handleApply(col.address);
                                    }}
                                >
                                    {applyLoading ? 'Submitting...' : 'Apply for Minting'}
                                </button>
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}
