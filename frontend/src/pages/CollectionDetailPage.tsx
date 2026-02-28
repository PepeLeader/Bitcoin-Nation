import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useCollectionData } from '../hooks/useCollectionData';
import { useNFTContract } from '../hooks/useNFTContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { shortenAddress, formatSats, formatSupply } from '../utils/formatting';
import { generateTokenImage } from '../utils/tokenImage';

const APPROVAL_LABELS: readonly string[] = ['None', 'Pending', 'Approved', 'Rejected'];
const PAGE_SIZE = 20;

function getPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push('...');
    pages.push(total);
    return pages;
}

function approvalClass(status: number): string {
    switch (status) {
        case 1: return 'approval-badge--pending';
        case 2: return 'approval-badge--approved';
        case 3: return 'approval-badge--rejected';
        default: return 'approval-badge--none';
    }
}

interface NFTGridItem {
    readonly tokenId: bigint;
    readonly imageUrl: string;
    readonly owner: string;
}

export function CollectionDetailPage(): React.JSX.Element {
    const { address } = useParams<{ address: string }>();
    const { network, isConnected, address: walletAddress } = useWallet();
    const { collection, creator, loading, error, refresh } = useCollectionData(address);
    const { setMintingOpen, loading: mintToggleLoading, error: mintToggleError } = useNFTContract();
    const [nfts, setNfts] = useState<readonly NFTGridItem[]>([]);
    const [nftsLoading, setNftsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [page, setPage] = useState(1);

    const totalPages = collection
        ? Math.max(1, Math.ceil(Number(collection.totalSupply) / PAGE_SIZE))
        : 1;

    const isCreator = isConnected && !!walletAddress && !!creator
        && walletAddress.toHex() === creator;

    const handleToggleMinting = useCallback(async (): Promise<void> => {
        if (!address || !collection) return;
        try {
            await setMintingOpen(address, !collection.isMintingOpen);
            refresh();
        } catch {
            // error displayed via mintToggleError
        }
    }, [address, collection, setMintingOpen, refresh]);

    const copyAddress = useCallback((): void => {
        if (!collection) return;
        void navigator.clipboard.writeText(collection.address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [collection]);

    useEffect(() => {
        if (!address || !collection) return;
        let cancelled = false;

        void (async () => {
            setNftsLoading(true);
            try {
                const contract = contractService.getNFTContract(address, network);
                const startId = (page - 1) * PAGE_SIZE + 1;
                const endId = Math.min(page * PAGE_SIZE, Number(collection.totalSupply));
                if (startId > endId) {
                    if (!cancelled) setNfts([]);
                    return;
                }
                const tokenIds = Array.from(
                    { length: endId - startId + 1 },
                    (_, j) => BigInt(startId + j),
                );

                const results = await Promise.all(
                    tokenIds.map(async (tid): Promise<NFTGridItem | null> => {
                        try {
                            // Get owner (standard OP-721)
                            let owner = '';
                            try {
                                const ownerResult = await contract.ownerOf(tid);
                                owner = String(ownerResult.properties.owner);
                            } catch {
                                // ownerOf failed — token may not exist
                                return null;
                            }

                            // Try tokenURI → IPFS/data URI image
                            try {
                                const uriResult = await contract.tokenURI(tid);
                                const uri = uriResult.properties.uri;

                                if (uri.startsWith('data:')) {
                                    // On-chain data URI (base64 JSON or direct image)
                                    if (uri.startsWith('data:image/')) {
                                        return { tokenId: tid, imageUrl: uri, owner };
                                    }
                                    // data:application/json;base64,... — decode JSON
                                    const res = await fetch(uri);
                                    const json = (await res.json()) as { image?: string };
                                    if (json.image) {
                                        return { tokenId: tid, imageUrl: ipfsService.resolveIPFS(json.image), owner };
                                    }
                                } else if (uri) {
                                    // IPFS or HTTP URI
                                    const res = await ipfsService.fetchIPFS(uri);
                                    const json = (await res.json()) as { image?: string };
                                    if (json.image) {
                                        return { tokenId: tid, imageUrl: ipfsService.resolveIPFS(json.image), owner };
                                    }
                                }
                            } catch {
                                // tokenURI not available — use deterministic fallback
                            }

                            // Fallback: generate deterministic pixel art from tokenId
                            const fallbackImage = generateTokenImage(tid);
                            return { tokenId: tid, imageUrl: fallbackImage, owner };
                        } catch {
                            return null;
                        }
                    }),
                );

                if (!cancelled) {
                    setNfts(results.filter((r): r is NFTGridItem => r !== null));
                }
            } catch {
                // fail silently for NFT grid
            } finally {
                if (!cancelled) setNftsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [address, collection, network, page]);

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner" />
                <p>Loading collection...</p>
            </div>
        );
    }

    if (error || !collection) {
        return <div className="error-state">{error ?? 'Collection not found'}</div>;
    }

    return (
        <div className="collection-detail-page">
            {collection.banner && (
                <div className="collection-banner">
                    <img src={ipfsService.resolveIPFS(collection.banner)} alt="" />
                </div>
            )}

            <div className="collection-header">
                <div className="collection-info">
                    <h1>{collection.name}</h1>
                    <span className="collection-symbol">{collection.symbol}</span>
                    <div className="collection-address-label">
                        <span className="collection-address-label__text">Contract Address:</span>
                        <button type="button" className="collection-address collection-address--copyable" onClick={copyAddress} title="Click to copy address">
                            {copied ? 'Copied!' : shortenAddress(collection.address)}
                        </button>
                    </div>
                    {collection.description && <p>{collection.description}</p>}
                </div>
            </div>

            <div className="collection-stats-bar">
                <div className="stat">
                    <span className="stat-label">Supply</span>
                    <span className="stat-value">
                        {formatSupply(collection.totalSupply, collection.maxSupply)}
                    </span>
                </div>
                {collection.maxSupply > 0n && (
                    <div className="stat">
                        <span className="stat-label">Available</span>
                        <span className="stat-value">{collection.availableSupply.toString()}</span>
                    </div>
                )}
                <div className="stat">
                    <span className="stat-label">Mint Price</span>
                    <span className="stat-value">{formatSats(collection.mintPrice)}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Status</span>
                    <span className="stat-value">
                        {collection.isMintingOpen ? (
                            <span className="badge badge-success">Minting Open</span>
                        ) : (
                            <span className="badge badge-muted">Minting Closed</span>
                        )}
                    </span>
                </div>
                <div className="stat">
                    <span className="stat-label">Approval</span>
                    <span className="stat-value">
                        <span className={`approval-badge ${approvalClass(collection.approvalStatus)}`}>
                            {APPROVAL_LABELS[collection.approvalStatus] ?? 'Unknown'}
                        </span>
                    </span>
                </div>
            </div>

            <div className="collection-actions">
                {collection.approvalStatus === 2 && collection.isMintingOpen && (
                    <Link
                        to={`/collection/${collection.address}/mint`}
                        className="btn btn-primary btn-lg"
                    >
                        Mint NFT
                    </Link>
                )}
                {isCreator && (
                    <button
                        type="button"
                        className={`btn ${collection.isMintingOpen ? 'btn--secondary' : 'btn--primary'}`}
                        disabled={mintToggleLoading}
                        onClick={() => void handleToggleMinting()}
                    >
                        {mintToggleLoading
                            ? 'Processing...'
                            : collection.isMintingOpen
                                ? 'Close Minting'
                                : 'Open Minting'}
                    </button>
                )}
                {mintToggleError && (
                    <p className="form-error">{mintToggleError}</p>
                )}
            </div>

            <section className="nft-gallery">
                <h2>NFTs</h2>
                {nftsLoading && <div className="spinner" />}
                {nfts.length === 0 && !nftsLoading && (
                    <p className="empty-text">No NFTs minted yet.</p>
                )}
                <div className="nft-list">
                    {nfts.map((nft) => (
                        <div key={nft.tokenId.toString()} className="nft-row">
                            <Link
                                to={`/collection/${collection.address}/nft/${nft.tokenId.toString()}`}
                                className="nft-row__image"
                            >
                                {nft.imageUrl ? (
                                    <img
                                        src={nft.imageUrl}
                                        alt={`#${nft.tokenId.toString()}`}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="nft-row__placeholder">No image</div>
                                )}
                            </Link>
                            <div className="nft-row__info">
                                <Link
                                    to={`/collection/${collection.address}/nft/${nft.tokenId.toString()}`}
                                    className="nft-row__id"
                                >
                                    #{nft.tokenId.toString()}
                                </Link>
                                <Link
                                    to={`/user/${nft.owner}`}
                                    className="nft-row__owner"
                                    title={nft.owner}
                                >
                                    Owner: {shortenAddress(nft.owner)}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
                {totalPages > 1 && (
                    <div className="nft-pagination">
                        <button
                            type="button"
                            className="nft-pagination__btn"
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            aria-label="Previous page"
                        >
                            &lsaquo;
                        </button>
                        {getPageNumbers(page, totalPages).map((p, i) =>
                            p === '...' ? (
                                <span key={`ellipsis-${i}`} className="nft-pagination__ellipsis">
                                    &hellip;
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    type="button"
                                    className={`nft-pagination__btn${p === page ? ' nft-pagination__btn--active' : ''}`}
                                    onClick={() => setPage(p)}
                                >
                                    {p}
                                </button>
                            ),
                        )}
                        <button
                            type="button"
                            className="nft-pagination__btn"
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            aria-label="Next page"
                        >
                            &rsaquo;
                        </button>
                        <span className="nft-pagination__info">
                            Page {page} of {totalPages}
                        </span>
                    </div>
                )}
            </section>
        </div>
    );
}
