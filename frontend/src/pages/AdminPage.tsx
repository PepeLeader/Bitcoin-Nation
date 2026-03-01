import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { useApprovalContract } from '../hooks/useApprovalContract';
import { useRegistryContract } from '../hooks/useRegistryContract';
import { useMarketplaceContract } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { getAdminAddress } from '../config/contracts';
import { shortenAddress } from '../utils/formatting';
import { generateCollectionIcon } from '../utils/tokenImage';
import type { CollectionInfo } from '../types/nft';

type Section = 'collections' | 'submissions' | 'marketplace';
type TabFilter = 'all' | 'pending' | 'approved';

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

interface SubmissionInfo {
    readonly address: string;
    readonly submitter: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly description: string;
    approvalStatus: number;
}

export function AdminPage(): React.JSX.Element {
    const { network, isConnected, addressStr } = useWallet();
    const { approveCollection, rejectCollection, loading: factoryActionLoading, error: factoryActionError } = useApprovalContract();
    const { approveSubmission, rejectSubmission, loading: registryActionLoading, error: registryActionError } = useRegistryContract();
    const { approveMarketplaceCollection, revokeMarketplaceCollection, setPlatformFee, loading: marketplaceActionLoading, error: marketplaceActionError } = useMarketplaceContract();

    const [section, setSection] = useState<Section>('collections');
    const [collections, setCollections] = useState<readonly AdminCollectionInfo[]>([]);
    const [submissions, setSubmissions] = useState<readonly SubmissionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabFilter>('all');

    const [marketplaceCollectionAddr, setMarketplaceCollectionAddr] = useState('');
    const [marketplaceStatus, setMarketplaceStatus] = useState<string | null>(null);
    const [feeNumerator, setFeeNumerator] = useState('100');
    const [feeStatus, setFeeStatus] = useState<string | null>(null);

    const adminAddress = getAdminAddress(network);
    const isAdmin = isConnected && addressStr === adminAddress;

    async function handleApproveMarketplaceCollection(): Promise<void> {
        if (!marketplaceCollectionAddr) return;
        setMarketplaceStatus(null);
        try {
            await approveMarketplaceCollection(marketplaceCollectionAddr);
            setMarketplaceStatus(`Collection approved for marketplace.`);
            setMarketplaceCollectionAddr('');
        } catch (err) {
            setMarketplaceStatus(err instanceof Error ? err.message : 'Failed');
        }
    }

    async function handleRevokeMarketplaceCollection(): Promise<void> {
        if (!marketplaceCollectionAddr) return;
        setMarketplaceStatus(null);
        try {
            await revokeMarketplaceCollection(marketplaceCollectionAddr);
            setMarketplaceStatus(`Collection revoked from marketplace.`);
            setMarketplaceCollectionAddr('');
        } catch (err) {
            setMarketplaceStatus(err instanceof Error ? err.message : 'Failed');
        }
    }

    async function handleSetPlatformFee(): Promise<void> {
        if (!feeNumerator) return;
        setFeeStatus(null);
        try {
            await setPlatformFee(BigInt(feeNumerator));
            setFeeStatus(`Platform fee set to ${Number(feeNumerator) / 10}%.`);
        } catch (err) {
            setFeeStatus(err instanceof Error ? err.message : 'Failed');
        }
    }

    // Load factory collections
    const loadCollections = useCallback(async (cancelled: { current: boolean }): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const factory = contractService.getFactory(network);
            const countResult = await factory.collectionCount();
            const count = countResult.properties.count;
            const items: AdminCollectionInfo[] = [];

            for (let i = 0n; i < count && i < 100n; i++) {
                if (cancelled.current) return;

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

                    const status = Number(statusResult.properties.status);
                    if (status === 3) continue;

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
                        approvalStatus: status,
                        creator: creatorResult.properties.creator.toHex(),
                    });
                } catch {
                    // Skip broken collections
                }
            }

            if (!cancelled.current) setCollections(items.reverse());
        } catch (err) {
            if (!cancelled.current) {
                setError(err instanceof Error ? err.message : 'Failed to load collections');
            }
        } finally {
            if (!cancelled.current) setLoading(false);
        }
    }, [network]);

    // Load registry submissions
    const loadSubmissions = useCallback(async (cancelled: { current: boolean }): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const registry = contractService.getRegistry(network);
            const countResult = await registry.submissionCount();
            const count = countResult.properties.count;
            const items: SubmissionInfo[] = [];

            for (let i = 0n; i < count && i < 100n; i++) {
                if (cancelled.current) return;

                const addrResult = await registry.submissionAtIndex(i);
                const addr = String(addrResult.properties.collectionAddress);

                try {
                    const [statusResult, submitterResult] = await Promise.all([
                        registry.submissionStatus(Address.fromString(addr)),
                        registry.submissionSubmitter(Address.fromString(addr)),
                    ]);

                    const status = Number(statusResult.properties.status);
                    if (status === 3) continue; // Hide rejected

                    // Try to read metadata — bulk first, then individual standard calls
                    let name = 'Unknown';
                    let symbol = '???';
                    let icon = '';
                    let description = '';

                    const contract = contractService.getNFTContract(addr, network);
                    try {
                        const meta = await contract.metadata();
                        name = meta.properties.name;
                        symbol = meta.properties.symbol;
                        icon = meta.properties.icon;
                        description = meta.properties.description;
                    } catch {
                        // External collection — try standard individual calls
                        const fallback = await Promise.allSettled([
                            contract.name(),
                            contract.symbol(),
                        ]);
                        if (fallback[0].status === 'fulfilled') name = fallback[0].value.properties.name;
                        if (fallback[1].status === 'fulfilled') symbol = fallback[1].value.properties.symbol;
                    }

                    items.push({
                        address: addr,
                        submitter: submitterResult.properties.submitter.toHex(),
                        name,
                        symbol,
                        icon,
                        description,
                        approvalStatus: status,
                    });
                } catch {
                    // Skip broken entries
                }
            }

            if (!cancelled.current) setSubmissions(items.reverse());
        } catch (err) {
            if (!cancelled.current) {
                setError(err instanceof Error ? err.message : 'Failed to load submissions');
            }
        } finally {
            if (!cancelled.current) setLoading(false);
        }
    }, [network]);

    useEffect(() => {
        if (!isAdmin) return;
        const cancelled = { current: false };

        if (section === 'collections') {
            void loadCollections(cancelled);
        } else {
            void loadSubmissions(cancelled);
        }

        return () => { cancelled.current = true; };
    }, [network, isAdmin, section, loadCollections, loadSubmissions]);

    function updateCollectionStatus(address: string, newStatus: number): void {
        setCollections((prev) =>
            prev.map((c) => (c.address === address ? { ...c, approvalStatus: newStatus } : c)),
        );
    }

    function updateSubmissionStatus(address: string, newStatus: number): void {
        setSubmissions((prev) =>
            prev.map((s) => (s.address === address ? { ...s, approvalStatus: newStatus } : s)),
        );
    }

    async function handleApproveCollection(address: string): Promise<void> {
        try {
            await approveCollection(address);
            updateCollectionStatus(address, 2);
        } catch {
            // error displayed via hook
        }
    }

    async function handleRejectCollection(address: string): Promise<void> {
        try {
            await rejectCollection(address);
            setCollections((prev) => prev.filter((c) => c.address !== address));
        } catch {
            // error displayed via hook
        }
    }

    async function handleApproveSubmission(address: string): Promise<void> {
        try {
            await approveSubmission(address);
            updateSubmissionStatus(address, 2);
        } catch {
            // error displayed via hook
        }
    }

    async function handleRejectSubmission(address: string): Promise<void> {
        try {
            await rejectSubmission(address);
            setSubmissions((prev) => prev.filter((s) => s.address !== address));
        } catch {
            // error displayed via hook
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

    const actionLoading = factoryActionLoading || registryActionLoading || marketplaceActionLoading;
    const actionError = factoryActionError || registryActionError || marketplaceActionError;

    // Filter for the active tab
    const filteredCollections = collections.filter((c) => {
        switch (activeTab) {
            case 'pending': return c.approvalStatus === 1;
            case 'approved': return c.approvalStatus === 2;
            default: return true;
        }
    });

    const filteredSubmissions = submissions.filter((s) => {
        switch (activeTab) {
            case 'pending': return s.approvalStatus === 1;
            case 'approved': return s.approvalStatus === 2;
            default: return true;
        }
    });

    const currentItems = section === 'collections' ? collections : submissions;
    const tabs: readonly { key: TabFilter; label: string }[] = [
        { key: 'all', label: `All (${currentItems.length})` },
        { key: 'pending', label: `Pending (${currentItems.filter((c) => c.approvalStatus === 1).length})` },
        { key: 'approved', label: `Approved (${currentItems.filter((c) => c.approvalStatus === 2).length})` },
    ];

    return (
        <div className="admin-page">
            <div className="page-header">
                <h1>Administration</h1>
                <p>Manage collection approvals</p>
            </div>

            <div className="admin-sections">
                <button
                    type="button"
                    className={`admin-section-btn ${section === 'collections' ? 'admin-section-btn--active' : ''}`}
                    onClick={() => { setSection('collections'); setActiveTab('all'); }}
                >
                    Collections
                </button>
                <button
                    type="button"
                    className={`admin-section-btn ${section === 'submissions' ? 'admin-section-btn--active' : ''}`}
                    onClick={() => { setSection('submissions'); setActiveTab('all'); }}
                >
                    Submissions
                </button>
                <button
                    type="button"
                    className={`admin-section-btn ${section === 'marketplace' ? 'admin-section-btn--active' : ''}`}
                    onClick={() => { setSection('marketplace'); setActiveTab('all'); }}
                >
                    Marketplace
                </button>
            </div>

            {section !== 'marketplace' && (
                <>
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
                            <p>Loading {section}...</p>
                        </div>
                    )}

                    {error && <div className="error-state">{error}</div>}
                    {actionError && <div className="form-error" style={{ marginBottom: '16px' }}>{actionError}</div>}

                    {!loading && !error && section === 'collections' && filteredCollections.length === 0 && (
                        <div className="empty-state">
                            <p className="empty-state__title">No collections in this category</p>
                        </div>
                    )}

                    {!loading && !error && section === 'submissions' && filteredSubmissions.length === 0 && (
                        <div className="empty-state">
                            <p className="empty-state__title">No submissions in this category</p>
                        </div>
                    )}
                </>
            )}

            {/* Collections grid */}
            {section === 'collections' && (
                <div className="admin-grid">
                    {filteredCollections.map((col) => (
                        <div key={col.address} className="admin-card">
                            <div className="admin-card__header">
                                <img
                                    src={col.icon ? ipfsService.resolveIPFS(col.icon) : generateCollectionIcon(col.address)}
                                    alt=""
                                    className="admin-card__icon"
                                    loading="lazy"
                                />
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
                                            onClick={() => void handleApproveCollection(col.address)}
                                        >
                                            {actionLoading ? 'Processing...' : 'Approve'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn--reject"
                                        disabled={actionLoading}
                                        onClick={() => void handleRejectCollection(col.address)}
                                    >
                                        {actionLoading ? 'Processing...' : 'Reject'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Marketplace section */}
            {section === 'marketplace' && (
                <div className="admin-marketplace-section">
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-lg)', color: 'var(--text-primary)' }}>
                        Marketplace Collection Approval
                    </h2>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Approve or revoke collections for marketplace trading. Enter the collection contract address (hex format).
                    </p>

                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Collection address (0x...)"
                            value={marketplaceCollectionAddr}
                            onChange={(e) => setMarketplaceCollectionAddr(e.target.value)}
                            style={{ flex: '1', minWidth: '300px' }}
                        />
                        <button
                            type="button"
                            className="btn btn--approve"
                            disabled={marketplaceActionLoading || !marketplaceCollectionAddr}
                            onClick={() => void handleApproveMarketplaceCollection()}
                        >
                            {marketplaceActionLoading ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                            type="button"
                            className="btn btn--reject"
                            disabled={marketplaceActionLoading || !marketplaceCollectionAddr}
                            onClick={() => void handleRevokeMarketplaceCollection()}
                        >
                            {marketplaceActionLoading ? 'Processing...' : 'Revoke'}
                        </button>
                    </div>

                    {marketplaceStatus && (
                        <div className="form-status">{marketplaceStatus}</div>
                    )}
                    {marketplaceActionError && (
                        <div className="form-error">{marketplaceActionError}</div>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 'var(--space-2xl) 0' }} />

                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-lg)', color: 'var(--text-primary)' }}>
                        Platform Fee
                    </h2>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Set the marketplace platform fee. Value is numerator over 1000 (e.g. 100 = 10%, 33 = 3.3%). Max: 100.
                    </p>

                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="100"
                            value={feeNumerator}
                            onChange={(e) => setFeeNumerator(e.target.value)}
                            style={{ width: '120px' }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            = {feeNumerator ? (Number(feeNumerator) / 10).toFixed(1) : '0'}%
                        </span>
                        <button
                            type="button"
                            className="btn btn--primary"
                            disabled={marketplaceActionLoading || !feeNumerator || Number(feeNumerator) > 100}
                            onClick={() => void handleSetPlatformFee()}
                        >
                            {marketplaceActionLoading ? 'Processing...' : 'Set Fee'}
                        </button>
                    </div>

                    {feeStatus && (
                        <div className="form-status">{feeStatus}</div>
                    )}
                </div>
            )}

            {/* Submissions grid */}
            {section === 'submissions' && (
                <div className="admin-grid">
                    {filteredSubmissions.map((sub) => (
                        <div key={sub.address} className="admin-card">
                            <div className="admin-card__header">
                                <img
                                    src={sub.icon ? ipfsService.resolveIPFS(sub.icon) : generateCollectionIcon(sub.address)}
                                    alt=""
                                    className="admin-card__icon"
                                    loading="lazy"
                                />
                                <div className="admin-card__info">
                                    <Link to={`/collection/${sub.address}`} className="admin-card__name">
                                        {sub.name}
                                    </Link>
                                    <span className="admin-card__symbol">{sub.symbol}</span>
                                </div>
                                <span className={`approval-badge ${statusClass(sub.approvalStatus)}`}>
                                    {STATUS_LABELS[sub.approvalStatus] ?? 'Unknown'}
                                </span>
                            </div>

                            <div className="admin-card__meta">
                                <span className="admin-card__creator">
                                    Submitter: {shortenAddress(sub.submitter)}
                                </span>
                                <span className="admin-card__address">
                                    Contract: {shortenAddress(sub.address)}
                                </span>
                            </div>

                            {sub.approvalStatus === 1 && (
                                <div className="admin-card__actions">
                                    <button
                                        type="button"
                                        className="btn btn--approve"
                                        disabled={actionLoading}
                                        onClick={() => void handleApproveSubmission(sub.address)}
                                    >
                                        {actionLoading ? 'Processing...' : 'Approve'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn--reject"
                                        disabled={actionLoading}
                                        onClick={() => void handleRejectSubmission(sub.address)}
                                    >
                                        {actionLoading ? 'Processing...' : 'Reject'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
