import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';

export function WalletButton(): React.JSX.Element {
    const { isConnected, addressStr, disconnect, openConnectModal } = useWallet();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent): void => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (isConnected && addressStr) {
        return (
            <div className="wallet-dropdown" ref={ref}>
                <button
                    type="button"
                    className="landing-nav__cta landing-nav__cta--outline"
                    onClick={() => setOpen((v) => !v)}
                >
                    <span className="wallet-btn__dot" /> Connected
                </button>
                {open && (
                    <div className="wallet-dropdown__menu">
                        <button
                            type="button"
                            className="wallet-dropdown__item"
                            onClick={() => { setOpen(false); navigate('/portfolio'); }}
                        >
                            Portfolio
                        </button>
                        <button
                            type="button"
                            className="wallet-dropdown__item wallet-dropdown__item--danger"
                            onClick={() => { setOpen(false); disconnect(); }}
                        >
                            Disconnect
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <button type="button" className="landing-nav__cta" onClick={openConnectModal}>
            Connect Wallet
        </button>
    );
}
