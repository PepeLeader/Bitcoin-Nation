import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { useCollectionData } from '../hooks/useCollectionData';
import { useNFTContract } from '../hooks/useNFTContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { shortenAddress, formatSats, formatSupply } from '../utils/formatting';

const APPROVAL_LABELS: readonly string[] = ['None', 'Pending', 'Approved', 'Rejected'];

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
    const { collection, loading, error, refresh } = useCollectionData(address);
    const { setMintingOpen, loading: mintToggleLoading, error: mintToggleError } = useNFTContract();
    const [nfts, setNfts] = useState<readonly NFTGridItem[]>([]);
    const [nftsLoading, setNftsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isCreator, setIsCreator] = useState(false);

    // Check if connected wallet is the collection creator
    useEffect(() => {
        if (!address || !isConnected || !walletAddress) {
            setIsCreator(false);
            return;
        }
        let cancelled = false;

        void (async () => {
            try {
                const factory = contractService.getFactory(network);
                const creatorResult = await factory.collectionCreator(Address.fromString(address));
                if (!cancelled) {
                    setIsCreator(creatorResult.properties.creator.equals(walletAddress));
                }
            } catch {
                if (!cancelled) setIsCreator(false);
            }
        })();

        return () => { cancelled = true; };
    }, [address, isConnected, walletAddress, network]);

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
                const limit = collection.totalSupply < 20n ? collection.totalSupply : 20n;
                const tokenIds = Array.from({ length: Number(limit) }, (_, j) => BigInt(j + 1));

                const results = await Promise.all(
                    tokenIds.map(async (tid): Promise<NFTGridItem | null> => {
                        try {
                            const [uriResult, ownerResult] = await Promise.all([
                                contract.tokenURI(tid),
                                contract.ownerOf(tid),
                            ]);
                            const uri = uriResult.properties.uri;
                            const owner = String(ownerResult.properties.owner);

                            // Try to fetch metadata JSON and extract image
                            try {
                                const res = await ipfsService.fetchIPFS(uri);
                                const json = (await res.json()) as { image?: string };
                                if (json.image) {
                                    return { tokenId: tid, imageUrl: ipfsService.resolveIPFS(json.image), owner };
                                }
                            } catch {
                                // not JSON or fetch failed — use URI directly
                            }

                            return { tokenId: tid, imageUrl: ipfsService.resolveIPFS(uri), owner };
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
    }, [address, collection, network]);

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
                                <img
                                    src={nft.imageUrl}
                                    alt={`#${nft.tokenId.toString()}`}
                                    loading="lazy"
                                />
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
            </section>
        </div>
    );
}
