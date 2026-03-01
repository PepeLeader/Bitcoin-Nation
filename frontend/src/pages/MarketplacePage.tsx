import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { generateCollectionIcon } from '../utils/tokenImage';

interface ListingDisplay extends ListingData {
    readonly id: bigint;
    readonly collectionName: string;
    readonly collectionSymbol: string;
    readonly collectionIcon: string;
    readonly tokenURI: string;
}

export function MarketplacePage(): React.JSX.Element {
    const { network, isConnected } = useWallet();
    const { getListingCount, getListing } = useMarketplaceContract();
    const [listings, setListings] = useState<readonly ListingDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collectionFilter, setCollectionFilter] = useState<string>('all');

    const loadListings = useCallback(async (cancelled: { current: boolean }): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const count = await getListingCount();
            const items: ListingDisplay[] = [];

            for (let i = 0n; i < count && i < 200n; i++) {
                if (cancelled.current) return;

                try {
                    const listing = await getListing(i);
                    if (!listing.active) continue;

                    // Load collection metadata
                    let collectionName = 'Unknown';
                    let collectionSymbol = '???';
                    let collectionIcon = '';
                    let tokenURI = '';

                    try {
                        const contract = contractService.getNFTContract(listing.collection, network);
                        const [meta, uriResult] = await Promise.all([
                            contract.metadata(),
                            contract.tokenURI(listing.tokenId),
                        ]);
                        collectionName = meta.properties.name;
                        collectionSymbol = meta.properties.symbol;
                        collectionIcon = meta.properties.icon;
                        tokenURI = uriResult.properties.uri;
                    } catch {
                        // Skip metadata errors
                    }

                    items.push({
                        ...listing,
                        id: i,
                        collectionName,
                        collectionSymbol,
                        collectionIcon,
                        tokenURI,
                    });
                } catch {
                    // Skip broken listings
                }
            }

            if (!cancelled.current) setListings(items.reverse());
        } catch (err) {
            if (!cancelled.current) {
                setError(err instanceof Error ? err.message : 'Failed to load listings');
            }
        } finally {
            if (!cancelled.current) setLoading(false);
        }
    }, [network, getListingCount, getListing]);

    useEffect(() => {
        const cancelled = { current: false };
        void loadListings(cancelled);
        return () => { cancelled.current = true; };
    }, [loadListings]);

    // Unique collections for filter
    const collections = [...new Set(listings.map((l) => l.collection))];
    const filtered = collectionFilter === 'all'
        ? listings
        : listings.filter((l) => l.collection === collectionFilter);

    // Resolve NFT image from tokenURI
    function resolveImage(listing: ListingDisplay): string {
        if (listing.tokenURI) {
            return ipfsService.resolveIPFS(listing.tokenURI);
        }
        return listing.collectionIcon
            ? ipfsService.resolveIPFS(listing.collectionIcon)
            : generateCollectionIcon(listing.collection);
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
            <div className="page-header">
                <div className="marketplace-page__header-row">
                    <div>
                        <h1>Marketplace</h1>
                        <p>Buy and sell OP-721 NFTs</p>
                    </div>
                    {isConnected && (
                        <Link to="/marketplace/list" className="btn btn--primary">
                            List NFT for Sale
                        </Link>
                    )}
                </div>
            </div>

            {collections.length > 1 && (
                <div className="marketplace-filters">
                    <button
                        type="button"
                        className={`marketplace-filter-btn ${collectionFilter === 'all' ? 'marketplace-filter-btn--active' : ''}`}
                        onClick={() => setCollectionFilter('all')}
                    >
                        All ({listings.length})
                    </button>
                    {collections.map((addr) => {
                        const match = listings.find((l) => l.collection === addr);
                        const name = match?.collectionName ?? 'Unknown';
                        const count = listings.filter((l) => l.collection === addr).length;
                        return (
                            <button
                                key={addr}
                                type="button"
                                className={`marketplace-filter-btn ${collectionFilter === addr ? 'marketplace-filter-btn--active' : ''}`}
                                onClick={() => setCollectionFilter(addr)}
                            >
                                {name} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading marketplace...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}

            {!loading && !error && filtered.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No active listings</p>
                    <p className="empty-state__subtitle">
                        {isConnected
                            ? 'Be the first to list an NFT for sale!'
                            : 'Connect your wallet to list NFTs.'}
                    </p>
                </div>
            )}

            <div className="listing-grid">
                {filtered.map((listing) => (
                    <Link
                        key={listing.id.toString()}
                        to={`/marketplace/${listing.id.toString()}`}
                        className="listing-card"
                    >
                        <div className="listing-card__image">
                            <img
                                src={resolveImage(listing)}
                                alt={`${listing.collectionName} #${listing.tokenId.toString()}`}
                                loading="lazy"
                            />
                        </div>
                        <div className="listing-card__body">
                            <div className="listing-card__collection">
                                {listing.collectionName}
                            </div>
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
        </div>
    );
}
