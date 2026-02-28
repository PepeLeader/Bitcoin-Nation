import { useState, type SyntheticEvent } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useRegistryContract } from '../hooks/useRegistryContract';

export function SubmitCollectionPage(): React.JSX.Element {
    const { isConnected } = useWallet();
    const { submitCollection, loading, error } = useRegistryContract();
    const [contractAddress, setContractAddress] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const isValid = contractAddress.trim().length > 0;

    async function handleSubmit(e: SyntheticEvent): Promise<void> {
        e.preventDefault();
        if (!isValid || !isConnected || loading) return;

        try {
            await submitCollection(contractAddress.trim());
            setSubmitted(true);
            setContractAddress('');
        } catch {
            // error displayed via hook error state
        }
    }

    if (!isConnected) {
        return (
            <div className="create-page">
                <h1 className="create-page__title">Submit a Collection</h1>
                <p className="create-page__subtitle">Connect your wallet to submit a collection for listing.</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="create-page">
                <h1 className="create-page__title">Submission Sent</h1>
                <div className="submit-success">
                    <span className="submit-success__icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </span>
                    <p className="submit-success__message">
                        Your collection has been submitted on-chain. Once the transaction confirms, it will appear as pending for admin review.
                    </p>
                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setSubmitted(false)}
                    >
                        Submit Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="create-page">
            <h1 className="create-page__title">Submit a Collection</h1>
            <p className="create-page__subtitle">
                Have an existing OP-721 collection? Submit it for listing on Bitcoin Nation.
                A 10,000 sat submission fee is required.
            </p>

            <form className="create-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" htmlFor="contractAddress">
                        Collection Contract Address <span className="form-required">*</span>
                    </label>
                    <input
                        id="contractAddress"
                        className="form-input"
                        type="text"
                        placeholder="opt1q... or 0x..."
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                    />
                    <span className="form-hint">
                        The OP-721 contract address of your deployed collection.
                        All metadata (name, icon, description) will be read from the contract.
                    </span>
                </div>

                <div className="submit-fee-notice">
                    <strong>Submission Fee:</strong> 10,000 sats
                    <span className="form-hint">Paid to the platform admin on submission.</span>
                </div>

                {error && <div className="form-error">{error}</div>}

                <button
                    type="submit"
                    className="btn btn--primary btn--lg"
                    disabled={!isValid || loading}
                >
                    {loading ? 'Submitting...' : 'Submit & Pay 10,000 sats'}
                </button>
            </form>
        </div>
    );
}
