import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { generateCollectionIcon } from '../utils/tokenImage';

interface CollectionSummary {
    readonly address: string;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;
    readonly listingCount: number;
    readonly floorPrice: bigint;
}

export function MarketplacePage(): React.JSX.Element {
    const { network, isConnected } = useWallet();
    const { getListingCount, getListing } = useMarketplaceContract();
    const [collections, setCollections] = useState<readonly CollectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCollections = useCallback(async (cancelled: { current: boolean }): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const count = await getListingCount();

            // Gather active listings (no tokenURI needed — just collection + price)
            const activeListings: ListingData[] = [];
            for (let i = 0n; i < count && i < 200n; i++) {
                if (cancelled.current) return;
                try {
                    const listing = await getListing(i);
                    if (listing.active) activeListings.push(listing);
                } catch {
                    // Skip broken listings
                }
            }

            // Group by collection address
            const groupMap = new Map<string, { listings: ListingData[] }>();
            for (const listing of activeListings) {
                let group = groupMap.get(listing.collection);
                if (!group) {
                    group = { listings: [] };
                    groupMap.set(listing.collection, group);
                }
                group.listings.push(listing);
            }

            // Resolve collection metadata (name, symbol, icon only — no per-token data)
            const summaries: CollectionSummary[] = [];
            for (const [address, group] of groupMap) {
                if (cancelled.current) return;

                let name = 'Unknown';
                let symbol = '???';
                let icon = '';

                try {
                    const contract = contractService.getNFTContract(address, network);
                    const meta = await contract.metadata();
                    name = meta.properties.name;
                    symbol = meta.properties.symbol;
                    icon = meta.properties.icon;
                } catch {
                    // Use defaults
                }

                const floorPrice = group.listings.reduce(
                    (min, l) => (l.price < min ? l.price : min),
                    group.listings[0].price,
                );

                summaries.push({
                    address,
                    name,
                    symbol,
                    icon,
                    listingCount: group.listings.length,
                    floorPrice,
                });
            }

            if (!cancelled.current) setCollections(summaries);
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
        void loadCollections(cancelled);
        return () => { cancelled.current = true; };
    }, [loadCollections]);

    function resolveCollectionIcon(col: CollectionSummary): string {
        return col.icon
            ? ipfsService.resolveIPFS(col.icon)
            : generateCollectionIcon(col.address);
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

            {!loading && !error && collections.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No active listings</p>
                    <p className="empty-state__subtitle">
                        {isConnected
                            ? 'Be the first to list an NFT for sale!'
                            : 'Connect your wallet to list NFTs.'}
                    </p>
                </div>
            )}

            {!loading && collections.length > 0 && (
                <div className="marketplace-collection-browse">
                    {collections.map((col) => (
                        <Link
                            key={col.address}
                            to={`/marketplace/collection/${col.address}`}
                            className="marketplace-collection-card"
                        >
                            <img
                                src={resolveCollectionIcon(col)}
                                alt=""
                                className="marketplace-collection-card__icon"
                                loading="lazy"
                            />
                            <div className="marketplace-collection-card__info">
                                <span className="marketplace-collection-card__name">
                                    {col.name}
                                </span>
                                {col.symbol && (
                                    <span className="marketplace-collection-card__symbol">
                                        {col.symbol}
                                    </span>
                                )}
                            </div>
                            <div className="marketplace-collection-card__stats">
                                <span className="marketplace-collection-card__count">
                                    {col.listingCount} listed
                                </span>
                                <span className="marketplace-collection-card__floor">
                                    Floor: {formatPrice(col.floorPrice)}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
