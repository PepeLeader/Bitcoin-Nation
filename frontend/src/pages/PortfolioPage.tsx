import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { useApprovalContract } from '../hooks/useApprovalContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import type { CollectionInfo, NFTMetadata } from '../types/nft';

const STATUS_LABELS: readonly string[] = ['Not Applied', 'Pending', 'Approved', 'Rejected'];

function statusClass(status: number): string {
    switch (status) {
        case 1: return 'approval-badge--pending';
        case 2: return 'approval-badge--approved';
        case 3: return 'approval-badge--rejected';
        default: return 'approval-badge--none';
    }
}

interface OwnedNFT {
    readonly tokenId: bigint;
    readonly uri: string;
    readonly imageUrl: string;
    readonly collectionAddress: string;
    readonly collectionName: string;
    readonly collectionSymbol: string;
}

export function PortfolioPage(): React.JSX.Element {
    const { network, isConnected, address: walletAddress, addressStr } = useWallet();
    const { applyForMint, loading: applyLoading, error: applyError } = useApprovalContract();
    const [collections, setCollections] = useState<readonly CollectionInfo[]>([]);
    const [ownedNFTs, setOwnedNFTs] = useState<readonly OwnedNFT[]>([]);
    const [loading, setLoading] = useState(true);
    const [nftsLoading, setNftsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nftsError, setNftsError] = useState<string | null>(null);

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
                    setError(err instanceof Error ? err.message : 'Failed to load portfolio');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [network, isConnected, walletAddress, addressStr]);

    // Load NFTs owned by the user across all collections
    useEffect(() => {
        if (!isConnected || !walletAddress) {
            setOwnedNFTs([]);
            setNftsLoading(false);
            return;
        }
        let cancelled = false;

        void (async () => {
            setNftsLoading(true);
            setNftsError(null);

            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const items: OwnedNFT[] = [];

                for (let i = 0n; i < count && i < 50n; i++) {
                    if (cancelled) return;

                    const addrResult = await factory.collectionAtIndex(i);
                    const addr = String(addrResult.properties.collectionAddress);

                    try {
                        const contract = contractService.getNFTContract(addr, network);
                        const balanceResult = await contract.balanceOf(walletAddress);
                        const balance = balanceResult.properties.balance;

                        if (balance === 0n) continue;

                        const meta = await contract.metadata();
                        const collectionName = meta.properties.name;
                        const collectionSymbol = meta.properties.symbol;

                        for (let j = 0n; j < balance && j < 20n; j++) {
                            if (cancelled) return;
                            const tokenIdResult = await contract.tokenOfOwnerByIndex(walletAddress, j);
                            const tokenId = tokenIdResult.properties.tokenId;
                            const uriResult = await contract.tokenURI(tokenId);
                            const uri = uriResult.properties.uri;

                            let imageUrl = ipfsService.resolveIPFS(uri);
                            try {
                                const res = await fetch(ipfsService.resolveIPFS(uri));
                                if (res.ok) {
                                    const json = (await res.json()) as NFTMetadata;
                                    if (json.image) {
                                        imageUrl = ipfsService.resolveIPFS(json.image);
                                    }
                                }
                            } catch {
                                // fall back to raw URI
                            }

                            items.push({
                                tokenId,
                                uri,
                                imageUrl,
                                collectionAddress: addr,
                                collectionName,
                                collectionSymbol,
                            });
                        }
                    } catch {
                        // Skip collections that fail
                    }
                }

                if (!cancelled) setOwnedNFTs(items);
            } catch (err) {
                if (!cancelled) {
                    setNftsError(err instanceof Error ? err.message : 'Failed to load owned NFTs');
                }
            } finally {
                if (!cancelled) setNftsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [network, isConnected, walletAddress]);

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

    if (!isConnected) {
        return (
            <div className="connect-prompt">
                <h2>Connect Your Wallet</h2>
                <p>Connect your wallet to view your portfolio.</p>
            </div>
        );
    }

    return (
        <div className="portfolio-page">
            <div className="page-header">
                <h1>My Portfolio</h1>
                <p>Your NFTs and collections</p>
            </div>

            {/* Owned NFTs Section */}
            <section className="portfolio-section">
                <h2 className="portfolio-section__title">Owned NFTs</h2>

                {nftsLoading && (
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading your NFTs...</p>
                    </div>
                )}

                {nftsError && <div className="error-state">{nftsError}</div>}

                {!nftsLoading && !nftsError && ownedNFTs.length === 0 && (
                    <div className="empty-state">
                        <p className="empty-state__title">No NFTs yet</p>
                        <p className="empty-state__description">
                            Browse collections and mint your first NFT.
                        </p>
                        <Link to="/browse" className="btn btn--primary" style={{ marginTop: '16px' }}>
                            Browse Collections
                        </Link>
                    </div>
                )}

                <div className="nft-gallery">
                    {ownedNFTs.map((nft) => (
                        <Link
                            key={`${nft.collectionAddress}-${nft.tokenId.toString()}`}
                            to={`/collection/${nft.collectionAddress}/nft/${nft.tokenId.toString()}`}
                            className="nft-card"
                        >
                            <div className="nft-card__image">
                                <img
                                    src={nft.imageUrl}
                                    alt={`#${nft.tokenId.toString()}`}
                                    loading="lazy"
                                />
                            </div>
                            <div className="nft-card__info">
                                <span className="nft-card__id">#{nft.tokenId.toString()}</span>
                                <span className="nft-card__name">{nft.collectionName}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Created Collections Section */}
            <section className="portfolio-section">
                <h2 className="portfolio-section__title">My Collections</h2>

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
                        <div key={col.address} className="portfolio-card">
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
                                    <Link to={`/collection/${col.address}`} className="portfolio-card__name">
                                        {col.name}
                                    </Link>
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
                                        onClick={() => void handleApply(col.address)}
                                    >
                                        {applyLoading ? 'Submitting...' : 'Apply for Minting'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
