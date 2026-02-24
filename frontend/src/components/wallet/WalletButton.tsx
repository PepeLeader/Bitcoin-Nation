import { useWallet } from '../../hooks/useWallet';
import { shortenAddress } from '../../utils/formatting';

export function WalletButton(): React.JSX.Element {
    const { isConnected, addressStr, disconnect, openConnectModal } = useWallet();

    if (isConnected && addressStr) {
        return (
            <div className="wallet-connected">
                <span className="wallet-btn wallet-btn--connected">
                    <span className="wallet-btn__dot" />
                    <span className="wallet-btn__address">{shortenAddress(addressStr)}</span>
                </span>
                <button type="button" className="landing-nav__cta landing-nav__cta--outline" onClick={disconnect}>
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button type="button" className="landing-nav__cta" onClick={openConnectModal}>
            Connect Wallet
        </button>
    );
}
