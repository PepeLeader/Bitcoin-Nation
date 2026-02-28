import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { LandingPage } from './pages/LandingPage';
import { BrowsePage } from './pages/BrowsePage';
import { CreateCollectionPage } from './pages/CreateCollectionPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { MintNFTPage } from './pages/MintNFTPage';
import { ActiveMintsPage } from './pages/ActiveMintsPage';
import { NFTDetailPage } from './pages/NFTDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { PortfolioPage } from './pages/PortfolioPage';
import { AdminPage } from './pages/AdminPage';
import { NationsPage } from './pages/NationsPage';
import { ForumPage } from './pages/ForumPage';
import { ThreadPage } from './pages/ThreadPage';
import { OrdinalBridgePage } from './pages/OrdinalBridgePage';
import { BrowseAllPage } from './pages/BrowseAllPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SubmitCollectionPage } from './pages/SubmitCollectionPage';
import { SpaceBackground } from './components/common/SpaceBackground';
import { useWallet } from './hooks/useWallet';

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
                    </Routes>
                </main>
            )}
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
