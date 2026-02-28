import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Address } from '@btc-vision/transaction';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import { shortenAddress } from '../utils/formatting';
import { loadAllCollectionAddresses } from '../utils/externalCollections';
import type { NFTMetadata } from '../types/nft';

interface UserNFT {
    readonly tokenId: bigint;
    readonly imageUrl: string;
    readonly collectionAddress: string;
    readonly collectionName: string;
}

export function UserProfilePage(): React.JSX.Element {
    const { ownerAddress } = useParams<{ ownerAddress: string }>();
    const { network } = useWallet();
    const [nfts, setNfts] = useState<readonly UserNFT[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ownerAddress) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        void (async () => {
            setLoading(true);
            try {
                const userAddr = Address.fromString(ownerAddress);

                // Phase 1: get all collection addresses (Factory + Registry)
                const addresses = await loadAllCollectionAddresses(network);
                if (cancelled) return;

                // Phase 2: check balance in each collection
                const items: UserNFT[] = [];
                const collPromises = addresses.map(async (addr) => {
                    try {
                        const contract = contractService.getNFTContract(addr, network);
                        const balanceResult = await contract.balanceOf(userAddr);
                        const balance = balanceResult.properties.balance;
                        if (balance === 0n) return [];

                        const meta = await contract.metadata();
                        const collectionName = meta.properties.name;

                        // Fetch each owned token
                        const tokenPromises: Promise<UserNFT | null>[] = [];
                        const tokenLimit = balance < 20n ? balance : 20n;
                        for (let j = 0n; j < tokenLimit; j++) {
                            const idx = j;
                            tokenPromises.push(
                                (async () => {
                                    try {
                                        const tidResult = await contract.tokenOfOwnerByIndex(userAddr, idx);
                                        const tokenId = tidResult.properties.tokenId;
                                        const uriResult = await contract.tokenURI(tokenId);
                                        const uri = uriResult.properties.uri;

                                        let imageUrl = ipfsService.resolveIPFS(uri);
                                        try {
                                            const res = await ipfsService.fetchIPFS(uri);
                                            const json = (await res.json()) as NFTMetadata;
                                            if (json.image) {
                                                imageUrl = ipfsService.resolveIPFS(json.image);
                                            }
                                        } catch {
                                            // use URI directly
                                        }

                                        return { tokenId, imageUrl, collectionAddress: addr, collectionName } as UserNFT;
                                    } catch {
                                        return null;
                                    }
                                })(),
                            );
                        }

                        return (await Promise.all(tokenPromises)).filter(
                            (r): r is UserNFT => r !== null,
                        );
                    } catch {
                        return [];
                    }
                });

                const results = await Promise.all(collPromises);
                if (!cancelled) {
                    for (const batch of results) {
                        items.push(...batch);
                    }
                    setNfts(items);
                }
            } catch {
                // fail silently
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [ownerAddress, network]);

    return (
        <div className="portfolio-page">
            <div className="page-header">
                <h1>User Profile</h1>
                <p className="profile-address">{shortenAddress(ownerAddress ?? '')}</p>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading NFTs...</p>
                </div>
            )}

            {!loading && nfts.length === 0 && (
                <div className="empty-state">
                    <p className="empty-state__title">No NFTs found</p>
                    <p className="empty-state__description">
                        This address doesn't own any NFTs.
                    </p>
                </div>
            )}

            {!loading && nfts.length > 0 && (
                <div className="nft-gallery">
                    {nfts.map((nft) => (
                        <Link
                            key={`${nft.collectionAddress}-${nft.tokenId.toString()}`}
                            to={`/collection/${nft.collectionAddress}/nft/${nft.tokenId.toString()}`}
                            className="nft-card"
                        >
                            <div className="nft-card__image">
                                <img
                                    src={nft.imageUrl}
                                    alt={`#${nft.tokenId.toString()}`}
                                    loading="lazy"
                                />
                            </div>
                            <div className="nft-card__info">
                                <span className="nft-card__id">#{nft.tokenId.toString()}</span>
                                <span className="nft-card__name">{nft.collectionName}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
