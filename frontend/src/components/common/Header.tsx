import { Link, useLocation } from 'react-router-dom';
import { WalletButton } from '../wallet/WalletButton';
import { OpLogo } from './OpLogo';
import { useWallet } from '../../hooks/useWallet';
import { useSidebar } from '../../context/SidebarContext';

export function Header(): React.JSX.Element {
    const location = useLocation();
    const { isConnected } = useWallet();
    const { isOpen, toggle } = useSidebar();
    const isLanding: boolean = location.pathname === '/';
    const hasSidebar = !isLanding && isConnected;

    return (
        <nav className="landing-nav">
            {hasSidebar && (
                <button
                    type="button"
                    className="sidebar-toggle"
                    onClick={toggle}
                    aria-label={isOpen ? 'Close menu' : 'Open menu'}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isOpen ? (
                            <>
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </>
                        ) : (
                            <>
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </>
                        )}
                    </svg>
                </button>
            )}

            <Link to="/" className="landing-nav__brand">
                Bitcoin <span style={{ color: '#a855f7' }}>Nation</span> <OpLogo size={22} />
            </Link>

            <span className="landing-nav__tagline">NFT Collections on Bitcoin L1 — powered by OPNet</span>

            <WalletButton />
        </nav>
    );
}
