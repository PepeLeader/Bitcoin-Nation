import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { providerService } from '../services/ProviderService';
import { ipfsService } from '../services/IPFSService';
import { generateCollectionIcon, generateTokenImage } from '../utils/tokenImage';

interface ListingDisplay extends ListingData {
    readonly id: bigint;
    readonly imageUrl: string;
}

export function MarketplaceCollectionPage(): React.JSX.Element {
    const { address: collectionAddress } = useParams<{ address: string }>();
    const { network } = useWallet();
    const { getListingCount, getListing, getReservationCount, getReservation } = useMarketplaceContract();

    const [listings, setListings] = useState<readonly ListingDisplay[]>([]);
    const [collectionName, setCollectionName] = useState('');
    const [collectionSymbol, setCollectionSymbol] = useState('');
    const [collectionIcon, setCollectionIcon] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadListings = useCallback(async (cancelled: { current: boolean }): Promise<void> => {
        if (!collectionAddress) return;

        setLoading(true);
        setError(null);
        try {
            // Load collection metadata
            try {
                const contract = contractService.getNFTContract(collectionAddress, network);
                const meta = await contract.metadata();
                if (!cancelled.current) {
                    setCollectionName(meta.properties.name);
                    setCollectionSymbol(meta.properties.symbol);
                    setCollectionIcon(meta.properties.icon);
                }
            } catch {
                // Use defaults
            }

            // Load all marketplace listings, filter to this collection
            const count = await getListingCount();
            const items: ListingDisplay[] = [];

            for (let i = 0n; i < count && i < 200n; i++) {
                if (cancelled.current) return;

                try {
                    const listing = await getListing(i);
                    if (!listing.active) continue;
                    if (listing.collection !== collectionAddress) continue;

                    // Resolve token image
                    let imageUrl = '';
                    try {
                        const contract = contractService.getNFTContract(listing.collection, network);
                        const uriResult = await contract.tokenURI(listing.tokenId);
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
                        // Image resolution failed
                    }

                    if (!imageUrl) imageUrl = generateTokenImage(listing.tokenId);

                    items.push({ ...listing, id: i, imageUrl });
                } catch {
                    // Skip broken listings
                }
            }

            // Build set of listing IDs with active, non-expired reservations
            const reservedListingIds = new Set<string>();
            try {
                const [resCount, currentBlock] = await Promise.all([
                    getReservationCount(),
                    providerService.getProvider(network).getBlockNumber(),
                ]);

                for (let j = 0n; j < resCount && j < 500n; j++) {
                    if (cancelled.current) return;
                    try {
                        const res = await getReservation(j);
                        if (res.active && res.expiryBlock > currentBlock) {
                            reservedListingIds.add(res.listingId.toString());
                        }
                    } catch {
                        // Skip broken reservations
                    }
                }
            } catch {
                // If reservation check fails, show all active listings
            }

            // Filter out reserved listings
            const available = items.filter(
                (l) => !reservedListingIds.has(l.id.toString()),
            );

            // Sort by price: cheapest first
            available.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));

            if (!cancelled.current) setListings(available);
        } catch (err) {
            if (!cancelled.current) {
                setError(err instanceof Error ? err.message : 'Failed to load listings');
            }
        } finally {
            if (!cancelled.current) setLoading(false);
        }
    }, [collectionAddress, network, getListingCount, getListing, getReservationCount, getReservation]);

    useEffect(() => {
        const cancelled = { current: false };
        void loadListings(cancelled);
        return () => { cancelled.current = true; };
    }, [loadListings]);

    function resolveIcon(): string {
        if (!collectionAddress) return '';
        return collectionIcon
            ? ipfsService.resolveIPFS(collectionIcon)
            : generateCollectionIcon(collectionAddress);
    }

    function formatPrice(sats: bigint): string {
        if (sats >= 100_000_000n) {
            const btc = Number(sats) / 100_000_000;
            return `${btc.toFixed(8)} BTC`;
        }
        return `${sats.toLocaleString()} sats`;
    }

    return (
        <div className="marketplace-page">
            <Link to="/marketplace" className="listing-back-btn">
                &larr; Back to Marketplace
            </Link>

            <div className="marketplace-collection-group__header">
                <img
                    src={resolveIcon()}
                    alt=""
                    className="marketplace-collection-group__icon"
                    loading="lazy"
                />
                <div className="marketplace-collection-group__info">
                    <h1 className="marketplace-collection-group__name">
                        {collectionName || 'Collection'}
                        {collectionSymbol && (
                            <span className="marketplace-collection-group__symbol">
                                {' '}({collectionSymbol})
                            </span>
                        )}
                    </h1>
                    {!loading && (
                        <span className="marketplace-collection-group__count">
                            {listings.length} listing{listings.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading listings...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}

            {!loading && !error && listings.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No active listings</p>
                    <p className="empty-state__subtitle">
                        No NFTs from this collection are currently for sale.
                    </p>
                </div>
            )}

            {!loading && listings.length > 0 && (
                <div className="listing-grid">
                    {listings.map((listing) => (
                        <Link
                            key={listing.id.toString()}
                            to={`/marketplace/${listing.id.toString()}`}
                            className="listing-card"
                        >
                            <div className="listing-card__image">
                                <img
                                    src={listing.imageUrl}
                                    alt={`${collectionName} #${listing.tokenId.toString()}`}
                                    loading="lazy"
                                />
                            </div>
                            <div className="listing-card__body">
                                <div className="listing-card__token">
                                    #{listing.tokenId.toString()}
                                </div>
                                <div className="listing-card__price">
                                    {formatPrice(listing.price)}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
