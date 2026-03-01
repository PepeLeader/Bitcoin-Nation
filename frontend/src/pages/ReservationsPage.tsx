import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData, type ReservationData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { providerService } from '../services/ProviderService';
import { ipfsService } from '../services/IPFSService';
import { generateTokenImage } from '../utils/tokenImage';
import { shortenAddress } from '../utils/formatting';

interface ReservationEntry {
    readonly reservationId: bigint;
    readonly reservation: ReservationData;
    readonly listing: ListingData;
    readonly collectionName: string;
    readonly imageUrl: string;
}

export function ReservationsPage(): React.JSX.Element {
    const { network, isConnected, address: walletAddress } = useWallet();
    const {
        getReservationCount,
        getReservation,
        getListing,
        fulfillReservation,
        cancelReservation,
        expireReservation,
        loading,
        error,
    } = useMarketplaceContract();

    const [reservations, setReservations] = useState<readonly ReservationEntry[]>([]);
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [currentBlock, setCurrentBlock] = useState<bigint>(0n);
    const [txSuccess, setTxSuccess] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchBlock = useCallback(async () => {
        try {
            const provider = providerService.getProvider(network);
            const block = await provider.getBlockNumber();
            setCurrentBlock(block);
        } catch { /* non-fatal */ }
    }, [network]);

    // Poll block number
    useEffect(() => {
        void fetchBlock();
        pollRef.current = setInterval(() => void fetchBlock(), 10_000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchBlock]);

    // Load reservations
    useEffect(() => {
        if (!isConnected || !walletAddress) {
            setReservations([]);
            setPageLoading(false);
            return;
        }
        let cancelled = false;

        void (async () => {
            setPageLoading(true);
            setPageError(null);

            try {
                const count = await getReservationCount();
                if (cancelled) return;

                if (count === 0n) {
                    setReservations([]);
                    return;
                }

                const walletHex = String(walletAddress).toLowerCase();

                // Batch fetch reservations
                const entries: ReservationEntry[] = [];
                const batchSize = 20;
                const total = Number(count > 200n ? 200n : count);

                for (let start = total - 1; start >= 0 && !cancelled; start -= batchSize) {
                    const end = Math.max(start - batchSize + 1, 0);
                    const batch = Array.from(
                        { length: start - end + 1 },
                        (_, i) => BigInt(start - i),
                    );

                    const results = await Promise.all(
                        batch.map(async (resId) => {
                            try {
                                const res = await getReservation(resId);
                                if (res.buyer.toLowerCase() !== walletHex) return null;

                                const listing = await getListing(res.listingId);

                                let collectionName = '';
                                let imageUrl = '';
                                try {
                                    const contract = contractService.getNFTContract(listing.collection, network);
                                    const [meta, uriResult] = await Promise.all([
                                        contract.metadata(),
                                        contract.tokenURI(listing.tokenId),
                                    ]);
                                    collectionName = meta.properties.name;
                                    const uri = uriResult.properties.uri;
                                    try {
                                        if (uri?.startsWith('data:image/')) {
                                            imageUrl = uri;
                                        } else if (uri?.startsWith('data:')) {
                                            const r = await fetch(uri);
                                            const j = (await r.json()) as { image?: string };
                                            if (j.image) imageUrl = ipfsService.resolveIPFS(j.image);
                                        } else if (uri) {
                                            const r = await ipfsService.fetchIPFS(uri);
                                            const j = (await r.json()) as { image?: string };
                                            if (j.image) imageUrl = ipfsService.resolveIPFS(j.image);
                                        }
                                    } catch { /* */ }
                                } catch { /* */ }
                                if (!imageUrl) imageUrl = generateTokenImage(listing.tokenId);

                                return {
                                    reservationId: resId,
                                    reservation: res,
                                    listing,
                                    collectionName,
                                    imageUrl,
                                } satisfies ReservationEntry;
                            } catch {
                                return null;
                            }
                        }),
                    );

                    for (const r of results) {
                        if (r) entries.push(r);
                    }
                }

                if (!cancelled) {
                    // Sort: active first, then by reservation ID descending
                    entries.sort((a, b) => {
                        if (a.reservation.active !== b.reservation.active) {
                            return a.reservation.active ? -1 : 1;
                        }
                        return Number(b.reservationId - a.reservationId);
                    });
                    setReservations(entries);
                }
            } catch (err) {
                if (!cancelled) {
                    setPageError(err instanceof Error ? err.message : 'Failed to load reservations');
                }
            } finally {
                if (!cancelled) setPageLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [network, isConnected, walletAddress, getReservationCount, getReservation, getListing]);

    function formatPrice(sats: bigint): string {
        if (sats >= 100_000_000n) {
            const btc = Number(sats) / 100_000_000;
            return `${btc.toFixed(8)} BTC`;
        }
        return `${sats.toLocaleString()} sats`;
    }

    async function handleFulfill(resId: bigint): Promise<void> {
        setTxSuccess(null);
        try {
            await fulfillReservation(resId);
            setTxSuccess('Purchase completed successfully!');
        } catch { /* error shown by hook */ }
    }

    async function handleCancel(resId: bigint): Promise<void> {
        setTxSuccess(null);
        try {
            await cancelReservation(resId);
            setTxSuccess('Reservation cancelled.');
        } catch { /* error shown by hook */ }
    }

    async function handleExpire(resId: bigint): Promise<void> {
        setTxSuccess(null);
        try {
            await expireReservation(resId);
            setTxSuccess('Reservation expired and cleaned up.');
        } catch { /* error shown by hook */ }
    }

    if (!isConnected) {
        return (
            <div className="connect-prompt">
                <h2>Connect Your Wallet</h2>
                <p>Connect your wallet to view your reservations.</p>
            </div>
        );
    }

    return (
        <div className="reservations-page">
            <div className="page-header">
                <h1>My Reservations</h1>
                {currentBlock > 0n && (
                    <span className="reservations-page__block">
                        Block: {currentBlock.toString()}
                    </span>
                )}
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

            {pageLoading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading reservations...</p>
                </div>
            )}

            {pageError && <div className="error-state">{pageError}</div>}

            {!pageLoading && !pageError && reservations.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No reservations</p>
                    <p className="empty-state__description">
                        Browse the marketplace to reserve and purchase NFTs.
                    </p>
                    <Link to="/marketplace" className="btn btn--primary" style={{ marginTop: '16px' }}>
                        Browse Marketplace
                    </Link>
                </div>
            )}

            <div className="reservations-grid">
                {reservations.map((entry) => {
                    const isActive = entry.reservation.active;
                    const isExpired = isActive && currentBlock > entry.reservation.expiryBlock;
                    const blocksLeft = isActive && !isExpired
                        ? entry.reservation.expiryBlock - currentBlock
                        : 0n;

                    return (
                        <div
                            key={entry.reservationId.toString()}
                            className={`reservation-card ${isActive ? (isExpired ? 'reservation-card--expired' : 'reservation-card--active') : 'reservation-card--inactive'}`}
                        >
                            <Link
                                to={`/marketplace/${entry.reservation.listingId.toString()}`}
                                className="reservation-card__image-link"
                            >
                                <img
                                    src={entry.imageUrl}
                                    alt={`#${entry.listing.tokenId.toString()}`}
                                    className="reservation-card__image"
                                />
                            </Link>

                            <div className="reservation-card__body">
                                <div className="reservation-card__collection">
                                    {entry.collectionName || shortenAddress(entry.listing.collection)}
                                </div>
                                <div className="reservation-card__token">
                                    #{entry.listing.tokenId.toString()}
                                </div>
                                <div className="reservation-card__price">
                                    {formatPrice(entry.listing.price)}
                                </div>

                                <div className="reservation-card__status">
                                    {isActive && !isExpired && (
                                        <span className="badge badge--success">
                                            Active — {blocksLeft.toString()} blocks left
                                        </span>
                                    )}
                                    {isActive && isExpired && (
                                        <span className="badge badge--warning">
                                            Expired
                                        </span>
                                    )}
                                    {!isActive && (
                                        <span className="badge badge--muted">
                                            Completed / Cancelled
                                        </span>
                                    )}
                                </div>

                                {isActive && !isExpired && (
                                    <div className="reservation-card__actions">
                                        <button
                                            type="button"
                                            className="btn btn--primary btn--sm"
                                            disabled={loading}
                                            onClick={() => void handleFulfill(entry.reservationId)}
                                        >
                                            Complete
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn--secondary btn--sm"
                                            disabled={loading}
                                            onClick={() => void handleCancel(entry.reservationId)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}

                                {isActive && isExpired && (
                                    <div className="reservation-card__actions">
                                        <button
                                            type="button"
                                            className="btn btn--secondary btn--sm"
                                            disabled={loading}
                                            onClick={() => void handleExpire(entry.reservationId)}
                                        >
                                            Clean Up
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
