import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { contractService } from '../services/ContractService';
import { ipfsService } from '../services/IPFSService';
import type { NFTMetadata } from '../types/nft';

interface OwnedNFT {
    readonly tokenId: bigint;
    readonly uri: string;
    readonly imageUrl: string;
    readonly collectionAddress: string;
    readonly collectionName: string;
    readonly collectionSymbol: string;
}

export function PortfolioPage(): React.JSX.Element {
    const { network, isConnected, address: walletAddress } = useWallet();
    const [ownedNFTs, setOwnedNFTs] = useState<readonly OwnedNFT[]>([]);
    const [nftsLoading, setNftsLoading] = useState(true);
    const [nftsError, setNftsError] = useState<string | null>(null);

    // Load NFTs owned by the user across all collections
    useEffect(() => {
        if (!isConnected || !walletAddress) {
            setOwnedNFTs([]);
            setNftsLoading(false);
            return;
        }
        let cancelled = false;

        void (async () => {
            setNftsLoading(true);
            setNftsError(null);

            try {
                const factory = contractService.getFactory(network);
                const countResult = await factory.collectionCount();
                const count = countResult.properties.count;
                const items: OwnedNFT[] = [];

                for (let i = 0n; i < count && i < 50n; i++) {
                    if (cancelled) return;

                    const addrResult = await factory.collectionAtIndex(i);
                    const addr = String(addrResult.properties.collectionAddress);

                    try {
                        const contract = contractService.getNFTContract(addr, network);
                        const balanceResult = await contract.balanceOf(walletAddress);
                        const balance = balanceResult.properties.balance;

                        if (balance === 0n) continue;

                        const meta = await contract.metadata();
                        const collectionName = meta.properties.name;
                        const collectionSymbol = meta.properties.symbol;

                        for (let j = 0n; j < balance && j < 20n; j++) {
                            if (cancelled) return;
                            const tokenIdResult = await contract.tokenOfOwnerByIndex(walletAddress, j);
                            const tokenId = tokenIdResult.properties.tokenId;
                            const uriResult = await contract.tokenURI(tokenId);
                            const uri = uriResult.properties.uri;

                            let imageUrl = ipfsService.resolveIPFS(uri);
                            try {
                                const res = await fetch(ipfsService.resolveIPFS(uri));
                                if (res.ok) {
                                    const json = (await res.json()) as NFTMetadata;
                                    if (json.image) {
                                        imageUrl = ipfsService.resolveIPFS(json.image);
                                    }
                                }
                            } catch {
                                // fall back to raw URI
                            }

                            items.push({
                                tokenId,
                                uri,
                                imageUrl,
                                collectionAddress: addr,
                                collectionName,
                                collectionSymbol,
                            });
                        }
                    } catch {
                        // Skip collections that fail
                    }
                }

                if (!cancelled) setOwnedNFTs(items);
            } catch (err) {
                if (!cancelled) {
                    setNftsError(err instanceof Error ? err.message : 'Failed to load owned NFTs');
                }
            } finally {
                if (!cancelled) setNftsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [network, isConnected, walletAddress]);

    if (!isConnected) {
        return (
            <div className="connect-prompt">
                <h2>Connect Your Wallet</h2>
                <p>Connect your wallet to view your portfolio.</p>
            </div>
        );
    }

    return (
        <div className="portfolio-page">
            <div className="page-header">
                <h1>My Portfolio</h1>
                <p>Your NFTs</p>
            </div>

            <section className="portfolio-section">
                <h2 className="portfolio-section__title">Owned NFTs</h2>

                {nftsLoading && (
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading your NFTs...</p>
                    </div>
                )}

                {nftsError && <div className="error-state">{nftsError}</div>}

                {!nftsLoading && !nftsError && ownedNFTs.length === 0 && (
                    <div className="empty-state">
                        <p className="empty-state__title">No NFTs yet</p>
                        <p className="empty-state__description">
                            Browse collections and mint your first NFT.
                        </p>
                        <Link to="/mints" className="btn btn--primary" style={{ marginTop: '16px' }}>
                            Active Mints
                        </Link>
                    </div>
                )}

                <div className="nft-gallery">
                    {ownedNFTs.map((nft) => (
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
            </section>
        </div>
    );
}
