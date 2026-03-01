import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { generateCollectionIcon } from '../utils/tokenImage';
import { shortenAddress } from '../utils/formatting';

export function ListingDetailPage(): React.JSX.Element {
    const { listingId: listingIdParam } = useParams<{ listingId: string }>();
    const { network, isConnected, address: walletAddress } = useWallet();
    const { getListing, buyNFT, delistNFT, loading, error } = useMarketplaceContract();

    const [listing, setListing] = useState<ListingData | null>(null);
    const [collectionName, setCollectionName] = useState('');
    const [collectionSymbol, setCollectionSymbol] = useState('');
    const [tokenURI, setTokenURI] = useState('');
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [txSuccess, setTxSuccess] = useState<string | null>(null);

    const listingId = listingIdParam !== undefined ? BigInt(listingIdParam) : null;

    useEffect(() => {
        if (listingId === null) return;
        let cancelled = false;

        async function load(): Promise<void> {
            setPageLoading(true);
            setPageError(null);
            try {
                const data = await getListing(listingId!);
                if (cancelled) return;
                setListing(data);

                // Load metadata
                try {
                    const contract = contractService.getNFTContract(data.collection, network);
                    const [meta, uriResult] = await Promise.all([
                        contract.metadata(),
                        contract.tokenURI(data.tokenId),
                    ]);
                    if (!cancelled) {
                        setCollectionName(meta.properties.name);
                        setCollectionSymbol(meta.properties.symbol);
                        setTokenURI(uriResult.properties.uri);
                    }
                } catch {
                    // Metadata optional
                }
            } catch (err) {
                if (!cancelled) {
                    setPageError(err instanceof Error ? err.message : 'Failed to load listing');
                }
            } finally {
                if (!cancelled) setPageLoading(false);
            }
        }

        void load();
        return () => { cancelled = true; };
    }, [listingId, network, getListing]);

    // Check if current user is the seller
    const isSeller = listing && walletAddress
        ? String(walletAddress).toLowerCase() === listing.seller.toLowerCase()
        : false;

    const price = listing?.price ?? 0n;
    const platformFee = price * 33n / 1000n;
    const sellerReceives = price - platformFee;

    function formatPrice(sats: bigint): string {
        if (sats >= 100_000_000n) {
            const btc = Number(sats) / 100_000_000;
            return `${btc.toFixed(8)} BTC`;
        }
        return `${sats.toLocaleString()} sats`;
    }

    async function handleBuy(): Promise<void> {
        if (listingId === null) return;
        setTxSuccess(null);
        try {
            await buyNFT(listingId);
            setTxSuccess('Purchase successful! The NFT has been transferred to your wallet.');
            // Refresh listing data
            const updated = await getListing(listingId);
            setListing(updated);
        } catch {
            // Error shown by hook
        }
    }

    async function handleDelist(): Promise<void> {
        if (listingId === null) return;
        setTxSuccess(null);
        try {
            await delistNFT(listingId);
            setTxSuccess('Listing removed successfully.');
            const updated = await getListing(listingId);
            setListing(updated);
        } catch {
            // Error shown by hook
        }
    }

    function resolveImage(): string {
        if (tokenURI) return ipfsService.resolveIPFS(tokenURI);
        if (listing) return generateCollectionIcon(listing.collection);
        return '';
    }

    if (pageLoading) {
        return (
            <div className="loading-state">
                <div className="spinner" />
                <p>Loading listing...</p>
            </div>
        );
    }

    if (pageError || !listing) {
        return (
            <div className="error-state">
                <p>{pageError ?? 'Listing not found'}</p>
                <Link to="/marketplace" className="btn btn--secondary">
                    Back to Marketplace
                </Link>
            </div>
        );
    }

    return (
        <div className="listing-detail">
            <Link to="/marketplace" className="listing-back-btn">
                &larr; Back to Marketplace
            </Link>

            <div className="listing-detail__layout">
                <div className="listing-detail__image-col">
                    <img
                        src={resolveImage()}
                        alt={`${collectionName} #${listing.tokenId.toString()}`}
                        className="listing-detail__image"
                    />
                </div>

                <div className="listing-detail__info-col">
                    <Link
                        to={`/collection/${listing.collection}`}
                        className="listing-detail__collection"
                    >
                        {collectionName || shortenAddress(listing.collection)} {collectionSymbol && `(${collectionSymbol})`}
                    </Link>

                    <h1 className="listing-detail__title">
                        #{listing.tokenId.toString()}
                    </h1>

                    <div className="listing-detail__status">
                        <span className={`badge ${listing.active ? 'badge--success' : 'badge--muted'}`}>
                            {listing.active ? 'Active' : 'Sold / Delisted'}
                        </span>
                    </div>

                    <div className="listing-detail__seller">
                        Seller: {shortenAddress(listing.seller)}
                    </div>

                    <div className="listing-detail__price-section">
                        <div className="listing-detail__price">
                            {formatPrice(listing.price)}
                        </div>

                        <div className="listing-cost-breakdown">
                            <div className="listing-cost-breakdown__row">
                                <span>Seller receives (96.7%)</span>
                                <span>{formatPrice(sellerReceives)}</span>
                            </div>
                            <div className="listing-cost-breakdown__row listing-cost-breakdown__row--fee">
                                <span>Platform fee (3.3%)</span>
                                <span>{formatPrice(platformFee)}</span>
                            </div>
                            <div className="listing-cost-breakdown__row listing-cost-breakdown__row--total">
                                <span>Total cost</span>
                                <span>{formatPrice(price)}</span>
                            </div>
                        </div>
                    </div>

                    {txSuccess && (
                        <div className="form-status" style={{ marginBottom: '16px' }}>
                            {txSuccess}
                        </div>
                    )}

                    {error && (
                        <div className="form-error" style={{ marginBottom: '16px' }}>
                            {error}
                        </div>
                    )}

                    {listing.active && isConnected && (
                        <div className="listing-detail__actions">
                            {isSeller ? (
                                <button
                                    type="button"
                                    className="btn btn--reject"
                                    disabled={loading}
                                    onClick={() => void handleDelist()}
                                >
                                    {loading ? 'Processing...' : 'Remove Listing'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn--primary listing-detail__buy-btn"
                                    disabled={loading}
                                    onClick={() => void handleBuy()}
                                >
                                    {loading ? 'Processing...' : `Buy for ${formatPrice(price)}`}
                                </button>
                            )}
                        </div>
                    )}

                    {!listing.active && (
                        <div className="listing-detail__inactive">
                            This listing is no longer active.
                        </div>
                    )}

                    {!isConnected && listing.active && (
                        <div className="listing-detail__connect-prompt">
                            Connect your wallet to buy this NFT.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
