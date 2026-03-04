import { SpaceBackground } from './components/common/SpaceBackground';
import { OpLogo } from './components/common/OpLogo';

/* ── Maintenance mode ─────────────────────────────────────────────────
   Set MAINTENANCE = false and restore the commented imports/routes
   below to return to the full app.
   ──────────────────────────────────────────────────────────────────── */
const MAINTENANCE = true;

function MaintenancePage(): React.JSX.Element {
    return (
        <div className="maintenance">
            <SpaceBackground />
            <div className="maintenance__card">
                <div className="maintenance__logo">
                    Bitcoin <span style={{ color: '#a855f7' }}>Nation</span>{' '}
                    <OpLogo size={28} />
                </div>
                <div className="maintenance__divider" />
                <h1 className="maintenance__title">Under Construction</h1>
                <p className="maintenance__body">
                    We are building an ecosystem-wide decentralized OP-721 registry
                    for all NFT collections on OPNet.
                </p>
                <p className="maintenance__sub">
                    A single, permissionless, on-chain source of truth — no admin,
                    no whitelist. One registry for every wallet, marketplace, and explorer.
                </p>
                <div className="maintenance__bar">
                    <div className="maintenance__bar-fill" />
                </div>
                <span className="maintenance__status">In Progress</span>
            </div>
        </div>
    );
}

/* ── Full app (commented out during maintenance) ──────────────────── */
// import { lazy, Suspense } from 'react';
// import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
// import { Header } from './components/common/Header';
// import { Sidebar } from './components/common/Sidebar';
// import { SidebarProvider, useSidebar } from './context/SidebarContext';
// import { ReservationAlertProvider } from './context/ReservationAlertContext';
// import { useWallet } from './hooks/useWallet';
//
// const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
// const BrowsePage = lazy(() => import('./pages/BrowsePage').then(m => ({ default: m.BrowsePage })));
// const CreateCollectionPage = lazy(() => import('./pages/CreateCollectionPage').then(m => ({ default: m.CreateCollectionPage })));
// const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage').then(m => ({ default: m.CollectionDetailPage })));
// const MintNFTPage = lazy(() => import('./pages/MintNFTPage').then(m => ({ default: m.MintNFTPage })));
// const ActiveMintsPage = lazy(() => import('./pages/ActiveMintsPage').then(m => ({ default: m.ActiveMintsPage })));
// const NFTDetailPage = lazy(() => import('./pages/NFTDetailPage').then(m => ({ default: m.NFTDetailPage })));
// const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
// const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
// const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
// const NationsPage = lazy(() => import('./pages/NationsPage').then(m => ({ default: m.NationsPage })));
// const ForumPage = lazy(() => import('./pages/ForumPage').then(m => ({ default: m.ForumPage })));
// const ThreadPage = lazy(() => import('./pages/ThreadPage').then(m => ({ default: m.ThreadPage })));
// const OrdinalBridgePage = lazy(() => import('./pages/OrdinalBridgePage').then(m => ({ default: m.OrdinalBridgePage })));
// const BrowseAllPage = lazy(() => import('./pages/BrowseAllPage').then(m => ({ default: m.BrowseAllPage })));
// const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
// const SubmitCollectionPage = lazy(() => import('./pages/SubmitCollectionPage').then(m => ({ default: m.SubmitCollectionPage })));
// const MarketplacePage = lazy(() => import('./pages/MarketplacePage').then(m => ({ default: m.MarketplacePage })));
// const MarketplaceCollectionPage = lazy(() => import('./pages/MarketplaceCollectionPage').then(m => ({ default: m.MarketplaceCollectionPage })));
// const ListNFTPage = lazy(() => import('./pages/ListNFTPage').then(m => ({ default: m.ListNFTPage })));
// const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage').then(m => ({ default: m.ListingDetailPage })));
// const ReservationsPage = lazy(() => import('./pages/ReservationsPage').then(m => ({ default: m.ReservationsPage })));

export function App(): React.JSX.Element {
    if (MAINTENANCE) return <MaintenancePage />;

    // Full app — unreachable while MAINTENANCE = true
    return <MaintenancePage />;
}
