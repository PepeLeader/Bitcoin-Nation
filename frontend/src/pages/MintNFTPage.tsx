import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useCollectionData } from '../hooks/useCollectionData';
import { useNFTContract } from '../hooks/useNFTContract';
import { formatSats } from '../utils/formatting';

const SUPPLY_POLL_MS = 15_000;
const LOW_SUPPLY_THRESHOLD = 30n;

type MintState = 'idle' | 'minting' | 'done';

export function MintNFTPage(): React.JSX.Element {
    const { address } = useParams<{ address: string }>();
    const { isConnected } = useWallet();
    const { collection, loading: collLoading, error: collError, refresh } = useCollectionData(address, { pollInterval: SUPPLY_POLL_MS });
    const { mint, loading, error } = useNFTContract();

    const [quantity, setQuantity] = useState('1');
    const [status, setStatus] = useState('');
    const [mintState, setMintState] = useState<MintState>('idle');

    if (!isConnected) {
        return (
            <div className="mint-page">
                <div className="connect-prompt">
                    <h2>Connect Your Wallet</h2>
                    <p>Connect to mint NFTs.</p>
                </div>
            </div>
        );
    }

    if (collError) {
        return (
            <div className="mint-page">
                <div className="error-state">
                    <h2>Failed to load collection</h2>
                    <p>{collError}</p>
                    <button type="button" className="btn btn--secondary" onClick={refresh}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (collLoading || !collection || !address) {
        return (
            <div className="loading-state">
                <div className="spinner" />
            </div>
        );
    }

    const qty = BigInt(quantity || '1');
    const totalCost = collection.mintPrice * qty;
    const adminFee = totalCost * 10n / 100n;
    const creatorPayment = totalCost - adminFee;

    // Effective max per transaction: min of contract hard cap (10), per-wallet limit, and available supply
    const CONTRACT_MAX_PER_TX = 10n;
    let effectiveMax = CONTRACT_MAX_PER_TX;
    if (collection.maxPerWallet > 0n && collection.maxPerWallet < effectiveMax) {
        effectiveMax = collection.maxPerWallet;
    }
    if (collection.maxSupply > 0n && collection.availableSupply > 0n && collection.availableSupply < effectiveMax) {
        effectiveMax = collection.availableSupply;
    }
    const maxQty = Number(effectiveMax < 1n ? 1n : effectiveMax);

    const supplyTooLow: boolean =
        collection.maxSupply > 0n && collection.availableSupply > 0n && collection.availableSupply < qty;
    const soldOut: boolean = collection.maxSupply > 0n && collection.availableSupply === 0n;
    const lowSupply: boolean =
        collection.maxSupply > 0n &&
        collection.availableSupply > 0n &&
        collection.availableSupply <= LOW_SUPPLY_THRESHOLD;

    async function handleMint(e: FormEvent): Promise<void> {
        e.preventDefault();
        if (!address) return;

        // Refresh supply one more time before proceeding
        refresh();

        if (soldOut) {
            setStatus('This collection is sold out.');
            return;
        }
        if (supplyTooLow && collection) {
            setStatus(`Only ${collection.availableSupply.toString()} remaining — reduce your quantity.`);
            return;
        }

        setMintState('minting');
        setStatus('Minting...');
        try {
            await mint(address, qty);
            setMintState('done');
            setStatus('');
            refresh();
        } catch (err) {
            setMintState('idle');
            setStatus(err instanceof Error ? err.message : 'Mint failed. Please try again.');
        }
    }

    return (
        <div className="mint-page">
            <div className="page-header">
                <h1>Mint — {collection.name}</h1>
                <p>Price: {formatSats(collection.mintPrice)} per NFT</p>
                {collection.maxSupply > 0n && (
                    <p className="supply-info">
                        Available: {collection.availableSupply.toString()} / {collection.maxSupply.toString()}
                    </p>
                )}
            </div>

            <div className="mint-form">
                {/* IDLE — Mint */}
                {mintState === 'idle' && (
                    <form onSubmit={(e) => void handleMint(e)}>
                        <div className="form-group">
                            <label htmlFor="quantity">Quantity (max {maxQty})</label>
                            <input
                                id="quantity"
                                type="number"
                                min="1"
                                max={maxQty}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                        </div>

                        <div className="mint-summary">
                            <div className="mint-summary__row">
                                <span>Total cost:</span>
                                <strong>{formatSats(totalCost)}</strong>
                            </div>
                            <div className="mint-summary__row mint-summary__detail">
                                <span>Creator (90%):</span>
                                <span>{formatSats(creatorPayment)}</span>
                            </div>
                            <div className="mint-summary__row mint-summary__detail">
                                <span>Platform fee (10%):</span>
                                <span>{formatSats(adminFee)}</span>
                            </div>
                        </div>

                        {lowSupply && (
                            <div className="form-warning form-warning--low-supply">
                                <strong>Low Supply Warning — {collection.availableSupply.toString()} remaining</strong>
                                <p>
                                    When supply is low, there is a small risk that another buyer&apos;s
                                    transaction confirms before yours. On Bitcoin L1, if the collection
                                    sells out before your transaction is processed, your BTC payment
                                    cannot be refunded.
                                </p>
                                <p>
                                    <strong>Safety measures in place:</strong> We verify supply is
                                    available immediately before your wallet opens. The contract also
                                    rejects any mint that exceeds remaining supply. However, a narrow
                                    race window exists between your wallet confirmation and on-chain
                                    settlement. Proceed only if you accept this risk.
                                </p>
                            </div>
                        )}

                        {supplyTooLow && (
                            <div className="form-error">
                                Not enough supply — only {collection.availableSupply.toString()} remaining. Reduce your quantity.
                            </div>
                        )}

                        {error && <div className="form-error">{error}</div>}
                        {status && <div className="form-status">{status}</div>}

                        <button
                            type="submit"
                            className="btn btn--primary btn--mint"
                            disabled={loading || !collection.isMintingOpen || soldOut || supplyTooLow}
                        >
                            {soldOut ? 'Sold Out' : 'Mint'}
                        </button>
                    </form>
                )}

                {/* MINTING — in flight */}
                {mintState === 'minting' && (
                    <div className="mint-state-card">
                        <div className="spinner" />
                        <p>Minting your NFTs...</p>
                        <p className="mint-state-card__sub">Confirm the transaction in your wallet.</p>
                    </div>
                )}

                {/* DONE */}
                {mintState === 'done' && (
                    <div className="mint-state-card mint-state-card--success">
                        <h3>Minted!</h3>
                        <p>Your NFT has been minted successfully! Your NFT will appear in your wallet following mint transaction confirmation.</p>
                        <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() => {
                                setMintState('idle');
                                refresh();
                            }}
                        >
                            Mint More
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
