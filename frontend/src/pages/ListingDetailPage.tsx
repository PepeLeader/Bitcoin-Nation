import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { getExplorerTxUrl } from '../config/contracts';
import { contractService } from '../services/ContractService';
import { providerService } from '../services/ProviderService';
import { ipfsService } from '../services/IPFSService';
import { generateTokenImage } from '../utils/tokenImage';
import { shortenAddress } from '../utils/formatting';

type ReservationStep = 'idle' | 'modal' | 'reserving' | 'reserved';

export function ListingDetailPage(): React.JSX.Element {
    const { listingId: listingIdParam } = useParams<{ listingId: string }>();
    const { network, isConnected, address: walletAddress } = useWallet();
    const {
        getListing,
        delistNFT,
        reserveListing,
        isBlacklisted,
        getBlacklistExpiry,
        loading,
        error,
    } = useMarketplaceContract();

    const [listing, setListing] = useState<ListingData | null>(null);
    const [collectionName, setCollectionName] = useState('');
    const [collectionSymbol, setCollectionSymbol] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [txSuccess, setTxSuccess] = useState<string | null>(null);

    // Reservation state
    const [reservationStep, setReservationStep] = useState<ReservationStep>('idle');
    const [reserveTxId, setReserveTxId] = useState<string | null>(null);
    const [blacklistError, setBlacklistError] = useState<string | null>(null);

    const navigate = useNavigate();
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

                        const uri = uriResult.properties.uri;
                        let resolved = '';
                        try {
                            if (uri) {
                                if (uri.startsWith('data:image/')) {
                                    resolved = uri;
                                } else if (uri.startsWith('data:')) {
                                    const res = await fetch(uri);
                                    const json = (await res.json()) as { image?: string };
                                    if (json.image) resolved = ipfsService.resolveIPFS(json.image);
                                } else {
                                    const res = await ipfsService.fetchIPFS(uri);
                                    const json = (await res.json()) as { image?: string };
                                    if (json.image) resolved = ipfsService.resolveIPFS(json.image);
                                }
                            }
                        } catch {
                            // Image resolution failed
                        }
                        if (!resolved) resolved = generateTokenImage(data.tokenId);
                        if (!cancelled) setImageUrl(resolved);
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

    const isSeller = listing && walletAddress
        ? String(walletAddress).toLowerCase() === listing.seller.toLowerCase()
        : false;

    const price = listing?.price ?? 0n;
    const platformFee = price * 100n / 1000n;
    const sellerReceives = price - platformFee;

    function formatPrice(sats: bigint): string {
        if (sats >= 100_000_000n) {
            const btc = Number(sats) / 100_000_000;
            return `${btc.toFixed(8)} BTC`;
        }
        return `${sats.toLocaleString()} sats`;
    }

    async function handleBuyClick(): Promise<void> {
        if (listingId === null) return;
        setTxSuccess(null);
        setBlacklistError(null);

        try {
            // Check blacklist before showing modal
            const blocked = await isBlacklisted();
            if (blocked) {
                const expiry = await getBlacklistExpiry();
                const provider = providerService.getProvider(network);
                const block = await provider.getBlockNumber();
                const remaining = expiry > block ? expiry - block : 0n;
                setBlacklistError(
                    `Your wallet is blacklisted from making reservations. ${remaining > 0n ? `${remaining.toString()} blocks remaining.` : 'Try again shortly.'}`,
                );
                return;
            }

            setReservationStep('modal');
        } catch {
            // Error shown by hook
        }
    }

    async function handleReserve(): Promise<void> {
        if (listingId === null) return;
        setReservationStep('reserving');

        try {
            const { txId } = await reserveListing(listingId);
            setReserveTxId(txId);
            setReservationStep('reserved');
        } catch {
            setReservationStep('modal');
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
        if (imageUrl) return imageUrl;
        if (listing) return generateTokenImage(listing.tokenId);
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
                                <span>Seller receives (90%)</span>
                                <span>{formatPrice(sellerReceives)}</span>
                            </div>
                            <div className="listing-cost-breakdown__row listing-cost-breakdown__row--fee">
                                <span>Platform fee (10%)</span>
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

                    {blacklistError && (
                        <div className="form-error" style={{ marginBottom: '16px' }}>
                            {blacklistError}
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
                                    disabled={loading || reservationStep !== 'idle'}
                                    onClick={() => void handleBuyClick()}
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

            {/* Reservation Modal Overlay */}
            {reservationStep !== 'idle' && (
                <div className="reservation-overlay">
                    <div className="reservation-modal">
                        <button
                            type="button"
                            className="reservation-modal__close"
                            onClick={() => {
                                if (reservationStep === 'modal') {
                                    setReservationStep('idle');
                                }
                            }}
                            disabled={reservationStep !== 'modal'}
                            aria-label="Close"
                        >
                            &times;
                        </button>

                        {reservationStep === 'modal' && (
                            <>
                                <h2 className="reservation-modal__title">Reserve this NFT</h2>
                                <div className="reservation-modal__info">
                                    <p>To protect your funds, purchases use a <strong>two-step reservation system</strong>.</p>
                                    <div className="reservation-modal__steps">
                                        <div className="reservation-modal__step">
                                            <span className="reservation-modal__step-num">1</span>
                                            <span>Reserve this NFT (no BTC sent)</span>
                                        </div>
                                        <div className="reservation-modal__step">
                                            <span className="reservation-modal__step-num">2</span>
                                            <span>Complete purchase within 4 blocks</span>
                                        </div>
                                    </div>
                                    <div className="reservation-modal__warning">
                                        If you do not complete your purchase within 4 blocks, your wallet will be blacklisted from making reservations for 12 blocks.
                                    </div>
                                </div>
                                <div className="reservation-modal__price">
                                    Price: <strong>{formatPrice(price)}</strong>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn--primary reservation-modal__btn"
                                    disabled={loading}
                                    onClick={() => void handleReserve()}
                                >
                                    {loading ? 'Processing...' : 'Reserve NFT'}
                                </button>
                            </>
                        )}

                        {reservationStep === 'reserving' && (
                            <div className="reservation-modal__pending">
                                <div className="spinner" />
                                <h2 className="reservation-modal__title">Creating Reservation</h2>
                                <p>Sending reservation transaction...</p>
                            </div>
                        )}

                        {reservationStep === 'reserved' && (
                            <>
                                <h2 className="reservation-modal__title">Reservation Submitted!</h2>
                                <p className="reservation-modal__ready-note">
                                    Your reservation transaction has been broadcast. Head to Reservations to complete the purchase once it confirms.
                                </p>
                                {reserveTxId && (() => {
                                    const url = getExplorerTxUrl(network, reserveTxId);
                                    return url ? (
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn--secondary reservation-modal__btn"
                                        >
                                            View on Mempool
                                        </a>
                                    ) : (
                                        <div className="reservation-modal__txid">
                                            TX: {reserveTxId.slice(0, 12)}...{reserveTxId.slice(-12)}
                                        </div>
                                    );
                                })()}
                                <button
                                    type="button"
                                    className="btn btn--primary reservation-modal__btn"
                                    onClick={() => navigate('/reservations')}
                                >
                                    Go to Reservations
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
