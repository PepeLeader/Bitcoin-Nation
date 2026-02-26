import { Link, useLocation, useNavigate } from 'react-router-dom';
import { WalletButton } from '../wallet/WalletButton';
import { OpLogo } from './OpLogo';
import { useWallet } from '../../hooks/useWallet';
import { useSidebar } from '../../context/SidebarContext';

export function Header(): React.JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();
    const { isConnected, openConnectModal } = useWallet();
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
                Bitcoin Nation <OpLogo size={22} />
            </Link>

            {/* Only show center nav links when there's no sidebar */}
            {!hasSidebar && (
                <div className="landing-nav__center">
                    <button
                        type="button"
                        className="landing-nav__cta landing-nav__cta--outline"
                        onClick={() => {
                            if (isConnected) {
                                navigate('/portfolio');
                            } else {
                                openConnectModal();
                            }
                        }}
                    >
                        Enter
                    </button>
                    <Link to="/collections" className="landing-nav__cta landing-nav__cta--outline">
                        OP_721 Collections
                    </Link>
                    <Link to="/mints" className="landing-nav__cta landing-nav__cta--outline">
                        Active Mints
                    </Link>
                    <Link to="/create" className="landing-nav__cta landing-nav__cta--outline">
                        + Create
                    </Link>
                </div>
            )}

            <WalletButton />
        </nav>
    );
}
