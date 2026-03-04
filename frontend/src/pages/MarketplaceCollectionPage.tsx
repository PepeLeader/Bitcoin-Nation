import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Network } from '@btc-vision/bitcoin';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, type ListingData } from '../hooks/useMarketplaceContract';
import { contractService } from '../services/ContractService';
import { providerService } from '../services/ProviderService';
import { ipfsService } from '../services/IPFSService';
import { generateCollectionIcon, generateTokenImage } from '../utils/tokenImage';

interface ListingDisplay extends ListingData {
    readonly id: bigint;
    imageUrl: string;
}

const BATCH_SIZE = 20;

async function fetchInBatches<T>(
    count: bigint,
    limit: bigint,
    fetcher: (i: bigint) => Promise<T | null>,
    cancelled: { current: boolean },
): Promise<T[]> {
    const results: T[] = [];
    const total = count < limit ? count : limit;
    for (let start = 0n; start < total; start += BigInt(BATCH_SIZE)) {
        if (cancelled.current) return results;
        const end = start + BigInt(BATCH_SIZE) < total ? start + BigInt(BATCH_SIZE) : total;
        const batch: Promise<T | null>[] = [];
        for (let i = start; i < end; i++) {
            batch.push(fetcher(i));
        }
        const batchResults = await Promise.all(batch);
        for (const r of batchResults) {
            if (r !== null) results.push(r);
        }
    }
    return results;
}

/** Resolve token image from tokenURI with timeout */
async function resolveTokenImage(
    collectionAddress: string,
    tokenId: bigint,
    network: Network,
): Promise<string> {
    try {
        const contract = contractService.getNFTContract(collectionAddress, network);
        const uriResult = await contract.tokenURI(tokenId);
        const uri = uriResult.properties.uri;

        if (uri) {
            if (uri.startsWith('data:image/')) return uri;
            if (uri.startsWith('data:')) {
                const res = await fetch(uri);
                const json = (await res.json()) as { image?: string };
                if (json.image) return ipfsService.resolveIPFS(json.image);
            } else {
                const res = await ipfsService.fetchIPFS(uri);
                const json = (await res.json()) as { image?: string };
                if (json.image) return ipfsService.resolveIPFS(json.image);
            }
        }
    } catch {
        // Image resolution failed
    }
    return generateTokenImage(tokenId);
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
            // Phase 1: Fetch collection metadata + listing count + reservation meta in parallel
            const metaP = (async () => {
                try {
                    const contract = contractService.getNFTContract(collectionAddress, network);
                    return await contract.metadata();
                } catch { return null; }
            })();

            const countP = getListingCount();
            const resMetaP = Promise.all([
                getReservationCount(),
                providerService.getProvider(network).getBlockNumber(),
            ]);

            const [meta, count, resMeta] = await Promise.all([metaP, countP, resMetaP]);
            const [resCount, currentBlock] = resMeta;

            if (meta && !cancelled.current) {
                setCollectionName(meta.properties.name);
                setCollectionSymbol(meta.properties.symbol);
                setCollectionIcon(meta.properties.icon);
            }

            // Phase 2: Fetch all listings + reservations in parallel batches
            const [allListings, reservedIds] = await Promise.all([
                fetchInBatches<{ listing: ListingData; id: bigint }>(
                    count, 200n,
                    async (i) => {
                        try {
                            const listing = await getListing(i);
                            if (!listing.active || listing.collection !== collectionAddress) return null;
                            return { listing, id: i };
                        } catch { return null; }
                    },
                    cancelled,
                ),
                fetchInBatches<string>(
                    resCount, 500n,
                    async (i) => {
                        try {
                            const res = await getReservation(i);
                            return (res.active && res.expiryBlock > currentBlock)
                                ? res.listingId.toString()
                                : null;
                        } catch { return null; }
                    },
                    cancelled,
                ),
            ]);

            if (cancelled.current) return;

            const reservedSet = new Set(reservedIds);
            const available = allListings
                .filter((l) => !reservedSet.has(l.id.toString()))
                .map((l) => ({
                    ...l.listing,
                    id: l.id,
                    imageUrl: generateTokenImage(l.listing.tokenId),
                } as ListingDisplay));

            // Sort by price: cheapest first
            available.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));

            // Show listings immediately with placeholder images
            if (!cancelled.current) {
                setListings(available);
                setLoading(false);
            }

            // Phase 3: Resolve images progressively in parallel batches
            const IMG_BATCH = 8;
            for (let start = 0; start < available.length; start += IMG_BATCH) {
                if (cancelled.current) return;
                const batch = available.slice(start, start + IMG_BATCH);
                const images = await Promise.all(
                    batch.map((l) => resolveTokenImage(collectionAddress, l.tokenId, network)),
                );

                if (cancelled.current) return;

                // Update each listing's image
                let changed = false;
                for (let j = 0; j < batch.length; j++) {
                    const img = images[j];
                    const item = batch[j];
                    if (item && img && img !== item.imageUrl) {
                        item.imageUrl = img;
                        changed = true;
                    }
                }
                if (changed) {
                    setListings([...available]);
                }
            }
        } catch (err) {
            if (!cancelled.current) {
                setError(err instanceof Error ? err.message : 'Failed to load listings');
                setLoading(false);
            }
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
