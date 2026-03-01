import { NavLink } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { getAdminAddress } from '../../config/contracts';
import { useSidebar } from '../../context/SidebarContext';

export function Sidebar(): React.JSX.Element {
    const { isConnected, addressStr, network } = useWallet();
    const { isOpen, close } = useSidebar();
    const adminAddress = getAdminAddress(network);
    const isAdmin = isConnected && !!addressStr && addressStr.toLowerCase() === adminAddress.toLowerCase();

    const linkClass = ({ isActive }: { readonly isActive: boolean }): string =>
        `sidebar-item${isActive ? ' sidebar-item--active' : ''}`;

    return (
        <aside className={`app-sidebar${isOpen ? ' app-sidebar--mobile-open' : ''}`}>
            <div className="app-sidebar__section-title">Navigate</div>

            <NavLink to="/portfolio" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Portfolio</span>
            </NavLink>

            <NavLink to="/reservations" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Reservations</span>
            </NavLink>

            <NavLink to="/nations" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Your Nations</span>
            </NavLink>

            <NavLink to="/mints" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Active Mints</span>
            </NavLink>

            <NavLink to="/collections" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                    </svg>
                </span>
                <span className="sidebar-item__name">All Collections</span>
            </NavLink>

            <NavLink to="/marketplace" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5z" />
                        <line x1="3" y1="7" x2="21" y2="7" />
                        <path d="M16 11a4 4 0 0 1-8 0" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Marketplace</span>
            </NavLink>

            <NavLink to="/ordinal-bridge" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <polyline points="7 23 3 19 7 15" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Ordinal Bridge</span>
            </NavLink>

            <div className="app-sidebar__section-title">Create</div>

            <NavLink to="/create" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Create Collection</span>
            </NavLink>

            <NavLink to="/submit" className={linkClass} onClick={close}>
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </span>
                <span className="sidebar-item__name">Submit Collection</span>
            </NavLink>

            <NavLink
                to="/browse"
                className={linkClass}
                onClick={close}
                end
            >
                <span className="sidebar-item__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </span>
                <span className="sidebar-item__name">My Projects</span>
            </NavLink>

            {isAdmin && (
                <>
                    <div className="app-sidebar__section-title">Admin</div>
                    <NavLink to="/admin" className={linkClass} onClick={close}>
                        <span className="sidebar-item__icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </span>
                        <span className="sidebar-item__name">Administration</span>
                    </NavLink>
                </>
            )}
        </aside>
    );
}
