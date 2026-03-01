import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { generateCollectionIcon, generateTokenImage } from '../utils/tokenImage';

interface ListingDisplay extends ListingData {
    readonly id: bigint;
    readonly collectionName: string;
    readonly collectionSymbol: string;
    readonly collectionIcon: string;
    readonly imageUrl: string;
}

export function MarketplacePage(): React.JSX.Element {
    const { network, isConnected } = useWallet();
    const { getListingCount, getListing } = useMarketplaceContract();
    const [listings, setListings] = useState<readonly ListingDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

                    // Load collection metadata + resolve image
                    let collectionName = 'Unknown';
                    let collectionSymbol = '???';
                    let collectionIcon = '';
                    let imageUrl = '';

                    try {
                        const contract = contractService.getNFTContract(listing.collection, network);
                        const [meta, uriResult] = await Promise.all([
                            contract.metadata(),
                            contract.tokenURI(listing.tokenId),
                        ]);
                        collectionName = meta.properties.name;
                        collectionSymbol = meta.properties.symbol;
                        collectionIcon = meta.properties.icon;

                        const uri = uriResult.properties.uri;
                        try {
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
                    } catch {
                        // Skip metadata errors
                    }

                    if (!imageUrl) imageUrl = generateTokenImage(listing.tokenId);

                    items.push({
                        ...listing,
                        id: i,
                        collectionName,
                        collectionSymbol,
                        collectionIcon,
                        imageUrl,
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

    // Group listings by collection
    interface CollectionGroup {
        readonly address: string;
        readonly name: string;
        readonly symbol: string;
        readonly icon: string;
        readonly listings: readonly ListingDisplay[];
    }

    const grouped: CollectionGroup[] = [];
    const groupMap = new Map<string, { name: string; symbol: string; icon: string; items: ListingDisplay[] }>();

    for (const listing of listings) {
        let group = groupMap.get(listing.collection);
        if (!group) {
            group = { name: listing.collectionName, symbol: listing.collectionSymbol, icon: listing.collectionIcon, items: [] };
            groupMap.set(listing.collection, group);
        }
        group.items.push(listing);
    }

    for (const [address, group] of groupMap) {
        grouped.push({ address, name: group.name, symbol: group.symbol, icon: group.icon, listings: group.items });
    }

    function resolveImage(listing: ListingDisplay): string {
        return listing.imageUrl;
    }

    function resolveCollectionIcon(group: CollectionGroup): string {
        return group.icon
            ? ipfsService.resolveIPFS(group.icon)
            : generateCollectionIcon(group.address);
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
                        <Link to="/marketplace/list" className="btn btn--primary marketplace-list-btn">
                            List NFT for Sale
                        </Link>
                    )}
                </div>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading marketplace...</p>
                </div>
            )}

            {error && <div className="error-state">{error}</div>}

            {!loading && !error && grouped.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No active listings</p>
                    <p className="empty-state__subtitle">
                        {isConnected
                            ? 'Be the first to list an NFT for sale!'
                            : 'Connect your wallet to list NFTs.'}
                    </p>
                </div>
            )}

            {grouped.map((group) => (
                <div key={group.address} className="marketplace-collection-group">
                    <div className="marketplace-collection-group__header">
                        <img
                            src={resolveCollectionIcon(group)}
                            alt=""
                            className="marketplace-collection-group__icon"
                            loading="lazy"
                        />
                        <div className="marketplace-collection-group__info">
                            <h2 className="marketplace-collection-group__name">
                                {group.name} {group.symbol && <span className="marketplace-collection-group__symbol">({group.symbol})</span>}
                            </h2>
                            <span className="marketplace-collection-group__count">
                                {group.listings.length} listing{group.listings.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div className="listing-grid">
                        {group.listings.map((listing) => (
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
            ))}
        </div>
    );
}
