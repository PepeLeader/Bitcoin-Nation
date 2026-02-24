import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { useApprovalContract } from '../hooks/useApprovalContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { getAdminAddress } from '../config/contracts';
import { shortenAddress } from '../utils/formatting';
import type { CollectionInfo } from '../types/nft';

type TabFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_LABELS: readonly string[] = ['Not Applied', 'Pending', 'Approved', 'Rejected'];

function statusClass(status: number): string {
    switch (status) {
        case 1: return 'approval-badge--pending';
        case 2: return 'approval-badge--approved';
        case 3: return 'approval-badge--rejected';
        default: return 'approval-badge--none';
    }
}

interface AdminCollectionInfo extends CollectionInfo {
    readonly creator: string;
}

export function AdminPage(): React.JSX.Element {
    const { network, isConnected, addressStr } = useWallet();
    const { approveCollection, rejectCollection, loading: actionLoading, error: actionError } = useApprovalContract();
    const [collections, setCollections] = useState<readonly AdminCollectionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabFilter>('all');

    const adminAddress = getAdminAddress(network);
    const isAdmin = isConnected && addressStr === adminAddress;

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;

        void (async () => {
            setLoading(true);
            setError(null);

            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const items: AdminCollectionInfo[] = [];

                for (let i = 0n; i < count && i < 100n; i++) {
                    if (cancelled) return;

                    const addrResult = await factory.collectionAtIndex(i);
                    const addr = String(addrResult.properties.collectionAddress);

                    try {
                        const contract = contractService.getNFTContract(addr, network);
                        const [meta, maxSup, price, maxWallet, avail, mintOpen, statusResult, creatorResult] =
                            await Promise.all([
                                contract.metadata(),
                                contract.maxSupply(),
                                contract.mintPrice(),
                                contract.maxPerWallet(),
                                contract.availableSupply(),
                                contract.isMintingOpen(),
                                factory.approvalStatus(Address.fromString(addr)),
                                factory.collectionCreator(Address.fromString(addr)),
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
                            creator: creatorResult.properties.creator.toHex(),
                        });
                    } catch {
                        // Skip broken collections
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
    }, [network, isAdmin]);

    function updateStatus(address: string, newStatus: number): void {
        setCollections((prev) =>
            prev.map((c) => (c.address === address ? { ...c, approvalStatus: newStatus } : c)),
        );
    }

    async function handleApprove(address: string): Promise<void> {
        try {
            await approveCollection(address);
            updateStatus(address, 2);
        } catch {
            // error displayed via actionError
        }
    }

    async function handleReject(address: string): Promise<void> {
        try {
            await rejectCollection(address);
            updateStatus(address, 3);
        } catch {
            // error displayed via actionError
        }
    }

    if (!isAdmin) {
        return (
            <div className="admin-access-denied">
                <h2>Access Denied</h2>
                <p>Only the platform administrator can access this page.</p>
            </div>
        );
    }

    const filteredCollections = collections.filter((c) => {
        switch (activeTab) {
            case 'pending': return c.approvalStatus === 1;
            case 'approved': return c.approvalStatus === 2;
            case 'rejected': return c.approvalStatus === 3;
            default: return true;
        }
    });

    const tabs: readonly { key: TabFilter; label: string }[] = [
        { key: 'all', label: `All (${collections.length})` },
        { key: 'pending', label: `Pending (${collections.filter((c) => c.approvalStatus === 1).length})` },
        { key: 'approved', label: `Approved (${collections.filter((c) => c.approvalStatus === 2).length})` },
        { key: 'rejected', label: `Rejected (${collections.filter((c) => c.approvalStatus === 3).length})` },
    ];

    return (
        <div className="admin-page">
            <div className="page-header">
                <h1>Administration</h1>
                <p>Manage collection mint approvals</p>
            </div>

            <div className="admin-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`admin-tab ${activeTab === tab.key ? 'admin-tab--active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading collections...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}
            {actionError && <div className="form-error" style={{ marginBottom: '16px' }}>{actionError}</div>}

            {!loading && !error && filteredCollections.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No collections in this category</p>
                </div>
            )}

            <div className="admin-grid">
                {filteredCollections.map((col) => (
                    <div key={col.address} className="admin-card">
                        <div className="admin-card__header">
                            {col.icon ? (
                                <img
                                    src={ipfsService.resolveIPFS(col.icon)}
                                    alt=""
                                    className="admin-card__icon"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="admin-card__icon admin-card__icon--fallback">
                                    {col.symbol.slice(0, 2)}
                                </div>
                            )}
                            <div className="admin-card__info">
                                <Link to={`/collection/${col.address}`} className="admin-card__name">
                                    {col.name}
                                </Link>
                                <span className="admin-card__symbol">{col.symbol}</span>
                            </div>
                            <span className={`approval-badge ${statusClass(col.approvalStatus)}`}>
                                {STATUS_LABELS[col.approvalStatus] ?? 'Unknown'}
                            </span>
                        </div>

                        <div className="admin-card__meta">
                            <span className="admin-card__creator">
                                Creator: {shortenAddress(col.creator)}
                            </span>
                            <span className="admin-card__supply">
                                Supply: {col.totalSupply.toString()} / {col.maxSupply === 0n ? 'Unlimited' : col.maxSupply.toString()}
                            </span>
                        </div>

                        {(col.approvalStatus === 1 || col.approvalStatus === 2) && (
                            <div className="admin-card__actions">
                                {col.approvalStatus === 1 && (
                                    <button
                                        type="button"
                                        className="btn btn--approve"
                                        disabled={actionLoading}
                                        onClick={() => void handleApprove(col.address)}
                                    >
                                        {actionLoading ? 'Processing...' : 'Approve'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn btn--reject"
                                    disabled={actionLoading}
                                    onClick={() => void handleReject(col.address)}
                                >
                                    {actionLoading ? 'Processing...' : 'Reject'}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
