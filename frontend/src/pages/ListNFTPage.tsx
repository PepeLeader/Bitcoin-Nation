import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { useFactoryContract } from '../hooks/useFactoryContract';
import { ipfsService } from '../services/IPFSService';
import { generateCollectionIcon, generateTokenImage } from '../utils/tokenImage';

interface OwnedCollection {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
}

interface OwnedNFT {
    readonly tokenId: bigint;
    readonly imageUrl: string;
}

export function ListNFTPage(): React.JSX.Element {
    const { network, isConnected, address: walletAddress } = useWallet();
    const { listNFT, setApprovalForAll, checkApproval, isCollectionApproved, loading, error } = useMarketplaceContract();
    const { getCollectionCount, getCollectionAtIndex } = useFactoryContract();

    const [step, setStep] = useState(1);
    const [collections, setCollections] = useState<readonly OwnedCollection[]>([]);
    const [selectedCollection, setSelectedCollection] = useState<string>('');
    const [ownedNFTs, setOwnedNFTs] = useState<readonly OwnedNFT[]>([]);
    const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
    const [price, setPrice] = useState('');
    const [loadingCollections, setLoadingCollections] = useState(true);
    const [loadingNFTs, setLoadingNFTs] = useState(false);
    const [needsApproval, setNeedsApproval] = useState(false);
    const [approvingMarketplace, setApprovingMarketplace] = useState(false);
    const [approvalPending, setApprovalPending] = useState(false);
    const [collectionNotApproved, setCollectionNotApproved] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [listingSuccess, setListingSuccess] = useState<bigint | null>(null);

    // Load user's collections that have balance > 0
    useEffect(() => {
        if (!isConnected || !walletAddress) return;
        let cancelled = false;
        const wallet = walletAddress;

        async function load(): Promise<void> {
            setLoadingCollections(true);
            try {
                const count = await getCollectionCount();
                const items: OwnedCollection[] = [];

                for (let i = 0n; i < count && i < 100n; i++) {
                    if (cancelled) return;
                    try {
                        const addr = await getCollectionAtIndex(i);
                        const contract = contractService.getNFTContract(addr, network);
                        const [balResult, metaResult] = await Promise.all([
                            contract.balanceOf(wallet),
                            contract.metadata(),
                        ]);
                        if (balResult.properties.balance > 0n) {
                            items.push({
                                address: addr,
                                name: metaResult.properties.name,
                                symbol: metaResult.properties.symbol,
                                icon: metaResult.properties.icon,
                            });
                        }
                    } catch {
                        // Skip
                    }
                }

                if (!cancelled) setCollections(items);
            } catch {
                // Silently fail
            } finally {
                if (!cancelled) setLoadingCollections(false);
            }
        }

        void load();
        return () => { cancelled = true; };
    }, [network, isConnected, walletAddress, getCollectionCount, getCollectionAtIndex]);

    // Load NFTs when collection selected
    const loadOwnedNFTs = useCallback(async (collectionAddr: string): Promise<void> => {
        if (!walletAddress) return;
        const wallet = walletAddress;
        setLoadingNFTs(true);
        setOwnedNFTs([]);

        try {
            const contract = contractService.getNFTContract(collectionAddr, network);
            const balResult = await contract.balanceOf(wallet);
            const balance = balResult.properties.balance;
            const items: OwnedNFT[] = [];

            for (let i = 0n; i < balance && i < 50n; i++) {
                try {
                    const tokenResult = await contract.tokenOfOwnerByIndex(wallet, i);
                    const tokenId = tokenResult.properties.tokenId;
                    let imageUrl = '';

                    try {
                        const uriResult = await contract.tokenURI(tokenId);
                        const uri = uriResult.properties.uri;

                        if (uri) {
                            if (uri.startsWith('data:image/')) {
                                imageUrl = uri;
                            } else if (uri.startsWith('data:')) {
                                const res = await fetch(uri);
                                const json = (await res.json()) as { image?: string };
                                if (json.image) imageUrl = ipfsService.resolveIPFS(json.image);
                            } else {
                                const res = await ipfsService.fetchIPFS(uri);
                                const json = (await res.json()) as { image?: string };
                                if (json.image) imageUrl = ipfsService.resolveIPFS(json.image);
                            }
                        }
                    } catch {
                        // tokenURI not available
                    }

                    if (!imageUrl) imageUrl = generateTokenImage(tokenId);
                    items.push({ tokenId, imageUrl });
                } catch {
                    break;
                }
            }

            setOwnedNFTs(items);
        } catch {
            // Error loading NFTs
        } finally {
            setLoadingNFTs(false);
        }
    }, [network, walletAddress]);

    async function handleSelectCollection(addr: string): Promise<void> {
        setSelectedCollection(addr);
        setSelectedTokenId(null);
        setCollectionNotApproved(false);

        // Check if collection is approved for marketplace
        const approved = await isCollectionApproved(addr);
        setCollectionNotApproved(!approved);

        if (approved) {
            setStep(2);
            await loadOwnedNFTs(addr);

            // Check marketplace approval
            const hasApproval = await checkApproval(addr);
            setNeedsApproval(!hasApproval);
        }
    }

    function handleSelectNFT(tokenId: bigint): void {
        setSelectedTokenId(tokenId);
        setStep(3);
    }

    async function handleApproveMarketplace(): Promise<void> {
        setApprovingMarketplace(true);
        try {
            await setApprovalForAll(selectedCollection, true);
            setNeedsApproval(false);
            setApprovalPending(true);
        } catch {
            // Error shown by hook
        } finally {
            setApprovingMarketplace(false);
        }
    }

    async function handleList(): Promise<void> {
        if (selectedTokenId === null || !price) return;
        setSubmitError(null);

        const priceSats = BigInt(price);
        if (priceSats < 546n) {
            setSubmitError('Price must be at least 546 sats (dust limit)');
            return;
        }

        try {
            const listingId = await listNFT(selectedCollection, selectedTokenId, priceSats);
            setListingSuccess(listingId);
            setStep(4);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to list');
        }
    }

    if (!isConnected) {
        return (
            <div className="connect-prompt">
                <h2>Connect Wallet</h2>
                <p>Connect your wallet to list NFTs for sale.</p>
            </div>
        );
    }

    const selectedNFT = ownedNFTs.find((n) => n.tokenId === selectedTokenId);

    return (
        <div className="listing-form-page">
            <div className="page-header">
                <h1>List NFT for Sale</h1>
                <p>Choose an NFT from your collection and set a price</p>
            </div>

            {/* Step indicators */}
            <div className="listing-steps">
                <div className={`listing-step ${step >= 1 ? 'listing-step--active' : ''}`}>
                    <span className="listing-step__number">1</span>
                    <span>Select Collection</span>
                </div>
                <div className={`listing-step ${step >= 2 ? 'listing-step--active' : ''}`}>
                    <span className="listing-step__number">2</span>
                    <span>Select NFT</span>
                </div>
                <div className={`listing-step ${step >= 3 ? 'listing-step--active' : ''}`}>
                    <span className="listing-step__number">3</span>
                    <span>Set Price</span>
                </div>
            </div>

            {/* Step 1: Select collection */}
            {step === 1 && (
                <div className="listing-form__section">
                    <h2>Your Collections</h2>
                    {loadingCollections ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading your collections...</p>
                        </div>
                    ) : collections.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-state__title">No NFTs found</p>
                            <p className="empty-state__subtitle">You don't own any NFTs to list.</p>
                        </div>
                    ) : (
                        <div className="listing-collection-grid">
                            {collections.map((col) => (
                                <button
                                    key={col.address}
                                    type="button"
                                    className={`listing-collection-card ${selectedCollection === col.address ? 'listing-collection-card--selected' : ''}`}
                                    onClick={() => void handleSelectCollection(col.address)}
                                >
                                    <img
                                        src={col.icon ? ipfsService.resolveIPFS(col.icon) : generateCollectionIcon(col.address)}
                                        alt=""
                                        className="listing-collection-card__icon"
                                        loading="lazy"
                                    />
                                    <div className="listing-collection-card__info">
                                        <span className="listing-collection-card__name">{col.name}</span>
                                        <span className="listing-collection-card__symbol">{col.symbol}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {collectionNotApproved && (
                        <div className="form-warning" style={{ marginTop: '16px' }}>
                            This collection is not yet approved for marketplace trading. Contact the admin to approve it.
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Select NFT */}
            {step === 2 && (
                <div className="listing-form__section">
                    <button type="button" className="listing-back-btn" onClick={() => setStep(1)}>
                        &larr; Back to collections
                    </button>
                    <h2>Select NFT</h2>

                    {needsApproval && (
                        <div className="listing-approval-prompt">
                            <p>The marketplace needs approval to transfer your NFTs from this collection.</p>
                            <button
                                type="button"
                                className="btn btn--primary"
                                disabled={approvingMarketplace}
                                onClick={() => void handleApproveMarketplace()}
                            >
                                {approvingMarketplace ? 'Approving...' : 'Approve Marketplace'}
                            </button>
                        </div>
                    )}

                    {approvalPending && !needsApproval && (
                        <div className="listing-approval-prompt">
                            <p>Your marketplace approval transaction has been submitted. You must wait for it to confirm on-chain before listing an NFT. This may take a few minutes.</p>
                        </div>
                    )}

                    {loadingNFTs ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading your NFTs...</p>
                        </div>
                    ) : ownedNFTs.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-state__title">No NFTs found in this collection</p>
                        </div>
                    ) : (
                        <div className="listing-nft-grid">
                            {ownedNFTs.map((nft) => (
                                <button
                                    key={nft.tokenId.toString()}
                                    type="button"
                                    className={`listing-nft-card ${selectedTokenId === nft.tokenId ? 'listing-nft-card--selected' : ''}`}
                                    onClick={() => handleSelectNFT(nft.tokenId)}
                                    disabled={needsApproval}
                                >
                                    <img
                                        src={nft.imageUrl}
                                        alt={`#${nft.tokenId.toString()}`}
                                        loading="lazy"
                                    />
                                    <span className="listing-nft-card__id">
                                        #{nft.tokenId.toString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Set price */}
            {step === 3 && (
                <div className="listing-form__section">
                    <button type="button" className="listing-back-btn" onClick={() => setStep(2)}>
                        &larr; Back to NFT selection
                    </button>
                    <h2>Set Price</h2>

                    {selectedNFT && (
                        <div className="listing-preview">
                            <img
                                src={selectedNFT.imageUrl}
                                alt=""
                                className="listing-preview__image"
                            />
                            <div className="listing-preview__info">
                                <span className="listing-preview__collection">
                                    {collections.find((c) => c.address === selectedCollection)?.name}
                                </span>
                                <span className="listing-preview__token">
                                    #{selectedTokenId?.toString()}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="listing-form__field">
                        <label htmlFor="listing-price">Price (satoshis)</label>
                        <input
                            id="listing-price"
                            type="number"
                            min="546"
                            placeholder="e.g. 100000"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                        {price && BigInt(price || '0') >= 546n && (
                            <span className="listing-form__price-preview">
                                = {(Number(price) / 100_000_000).toFixed(8)} BTC
                            </span>
                        )}
                    </div>

                    {price && BigInt(price || '0') >= 546n && (
                        <div className="listing-cost-breakdown">
                            <div className="listing-cost-breakdown__row">
                                <span>Seller receives (96.7%)</span>
                                <span>{(BigInt(price) - BigInt(price) * 33n / 1000n).toLocaleString()} sats</span>
                            </div>
                            <div className="listing-cost-breakdown__row listing-cost-breakdown__row--fee">
                                <span>Platform fee (3.3%)</span>
                                <span>{(BigInt(price) * 33n / 1000n).toLocaleString()} sats</span>
                            </div>
                        </div>
                    )}

                    {(submitError ?? error) && (
                        <div className="form-error" style={{ marginTop: '12px' }}>
                            {submitError ?? error}
                        </div>
                    )}

                    <button
                        type="button"
                        className="btn btn--primary listing-form__submit"
                        disabled={loading || !price || BigInt(price || '0') < 546n}
                        onClick={() => void handleList()}
                    >
                        {loading ? 'Listing...' : 'List for Sale'}
                    </button>
                </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && listingSuccess !== null && selectedNFT && (
                <div className="listing-form__section" style={{ textAlign: 'center' }}>
                    <div className="form-status" style={{ marginBottom: '24px', fontSize: '18px' }}>
                        NFT listed successfully!
                    </div>

                    <div className="listing-preview" style={{ justifyContent: 'center' }}>
                        <img
                            src={selectedNFT.imageUrl}
                            alt=""
                            className="listing-preview__image"
                        />
                        <div className="listing-preview__info">
                            <span className="listing-preview__collection">
                                {collections.find((c) => c.address === selectedCollection)?.name}
                            </span>
                            <span className="listing-preview__token">
                                #{selectedTokenId?.toString()}
                            </span>
                            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                {(Number(price) / 100_000_000).toFixed(8)} BTC
                            </span>
                        </div>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', margin: '24px 0 8px' }}>
                        Your listing will appear on the marketplace once the transaction is confirmed.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                        <Link to="/marketplace" className="btn btn--primary">
                            Go to Marketplace
                        </Link>
                        <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() => {
                                setStep(1);
                                setSelectedCollection('');
                                setSelectedTokenId(null);
                                setPrice('');
                                setListingSuccess(null);
                                setOwnedNFTs([]);
                            }}
                        >
                            List Another
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
