import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { SpaceBackground } from './components/common/SpaceBackground';
import { useWallet } from './hooks/useWallet';

const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const BrowsePage = lazy(() => import('./pages/BrowsePage').then(m => ({ default: m.BrowsePage })));
const CreateCollectionPage = lazy(() => import('./pages/CreateCollectionPage').then(m => ({ default: m.CreateCollectionPage })));
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage').then(m => ({ default: m.CollectionDetailPage })));
const MintNFTPage = lazy(() => import('./pages/MintNFTPage').then(m => ({ default: m.MintNFTPage })));
const ActiveMintsPage = lazy(() => import('./pages/ActiveMintsPage').then(m => ({ default: m.ActiveMintsPage })));
const NFTDetailPage = lazy(() => import('./pages/NFTDetailPage').then(m => ({ default: m.NFTDetailPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const NationsPage = lazy(() => import('./pages/NationsPage').then(m => ({ default: m.NationsPage })));
const ForumPage = lazy(() => import('./pages/ForumPage').then(m => ({ default: m.ForumPage })));
const ThreadPage = lazy(() => import('./pages/ThreadPage').then(m => ({ default: m.ThreadPage })));
const OrdinalBridgePage = lazy(() => import('./pages/OrdinalBridgePage').then(m => ({ default: m.OrdinalBridgePage })));
const BrowseAllPage = lazy(() => import('./pages/BrowseAllPage').then(m => ({ default: m.BrowseAllPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const SubmitCollectionPage = lazy(() => import('./pages/SubmitCollectionPage').then(m => ({ default: m.SubmitCollectionPage })));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage').then(m => ({ default: m.MarketplacePage })));
const MarketplaceCollectionPage = lazy(() => import('./pages/MarketplaceCollectionPage').then(m => ({ default: m.MarketplaceCollectionPage })));
const ListNFTPage = lazy(() => import('./pages/ListNFTPage').then(m => ({ default: m.ListNFTPage })));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage').then(m => ({ default: m.ListingDetailPage })));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage').then(m => ({ default: m.ReservationsPage })));

function AppRoutes(): React.JSX.Element {
    const location = useLocation();
    const { isConnected } = useWallet();
    const { isOpen: sidebarOpen, close: closeSidebar } = useSidebar();
    const isLanding: boolean = location.pathname === '/';
    const showSidebar = !isLanding && isConnected;

    return (
        <>
            <SpaceBackground />
            <Header />
            <Suspense fallback={<div className="page-loading" />}>
                {showSidebar ? (
                    <div className="app-layout">
                        {sidebarOpen && (
                            <div
                                className="sidebar-backdrop"
                                onClick={closeSidebar}
                                onKeyDown={(e) => { if (e.key === 'Escape') closeSidebar(); }}
                                role="button"
                                tabIndex={-1}
                                aria-label="Close sidebar"
                            />
                        )}
                        <Sidebar />
                        <main className="app-main">
                            <div className="page-container">
                                <Routes>
                                    <Route path="/browse" element={<BrowsePage />} />
                                    <Route path="/mints" element={<ActiveMintsPage />} />
                                    <Route path="/create" element={<CreateCollectionPage />} />
                                    <Route path="/submit" element={<SubmitCollectionPage />} />
                                    <Route path="/collection/:address" element={<CollectionDetailPage />} />
                                    <Route path="/collection/:address/mint" element={<MintNFTPage />} />
                                    <Route path="/collection/:address/nft/:tokenId" element={<NFTDetailPage />} />
                                    <Route path="/profile" element={<ProfilePage />} />
                                    <Route path="/portfolio" element={<PortfolioPage />} />
                                    <Route path="/admin" element={<AdminPage />} />
                                    <Route path="/nations" element={<NationsPage />} />
                                    <Route path="/nations/:address" element={<ForumPage />} />
                                    <Route path="/nations/:address/thread/:threadId" element={<ThreadPage />} />
                                    <Route path="/ordinal-bridge" element={<OrdinalBridgePage />} />
                                    <Route path="/collections" element={<BrowseAllPage />} />
                                    <Route path="/user/:ownerAddress" element={<UserProfilePage />} />
                                    <Route path="/marketplace" element={<MarketplacePage />} />
                                    <Route path="/marketplace/collection/:address" element={<MarketplaceCollectionPage />} />
                                    <Route path="/marketplace/list" element={<ListNFTPage />} />
                                    <Route path="/marketplace/:listingId" element={<ListingDetailPage />} />
                                    <Route path="/reservations" element={<ReservationsPage />} />
                                </Routes>
                            </div>
                        </main>
                    </div>
                ) : (
                    <main className={isLanding ? '' : 'main-content'}>
                        <Routes>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/browse" element={<BrowsePage />} />
                            <Route path="/mints" element={<ActiveMintsPage />} />
                            <Route path="/create" element={<CreateCollectionPage />} />
                            <Route path="/submit" element={<SubmitCollectionPage />} />
                            <Route path="/collection/:address" element={<CollectionDetailPage />} />
                            <Route path="/collection/:address/mint" element={<MintNFTPage />} />
                            <Route path="/collection/:address/nft/:tokenId" element={<NFTDetailPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/portfolio" element={<PortfolioPage />} />
                            <Route path="/admin" element={<AdminPage />} />
                            <Route path="/nations" element={<NationsPage />} />
                            <Route path="/nations/:address" element={<ForumPage />} />
                            <Route path="/nations/:address/thread/:threadId" element={<ThreadPage />} />
                            <Route path="/collections" element={<BrowseAllPage />} />
                            <Route path="/user/:ownerAddress" element={<UserProfilePage />} />
                            <Route path="/marketplace" element={<MarketplacePage />} />
                            <Route path="/marketplace/collection/:address" element={<MarketplaceCollectionPage />} />
                            <Route path="/marketplace/list" element={<ListNFTPage />} />
                            <Route path="/marketplace/:listingId" element={<ListingDetailPage />} />
                            <Route path="/reservations" element={<ReservationsPage />} />
                        </Routes>
                    </main>
                )}
            </Suspense>
        </>
    );
}

export function App(): React.JSX.Element {
    return (
        <BrowserRouter>
            <SidebarProvider>
                <AppRoutes />
            </SidebarProvider>
        </BrowserRouter>
    );
}
