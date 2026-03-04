import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useMarketplaceContract, isPendingCompletion } from '../hooks/useMarketplaceContract';
import { providerService } from '../services/ProviderService';

interface ReservationAlertState {
    readonly hasActiveReservations: boolean;
    readonly activeCount: number;
}

const ReservationAlertContext = createContext<ReservationAlertState>({
    hasActiveReservations: false,
    activeCount: 0,
});

export function ReservationAlertProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
    const { isConnected, address: walletAddress, network } = useWallet();
    const { getReservationCount, getReservation } = useMarketplaceContract();
    const [state, setState] = useState<ReservationAlertState>({ hasActiveReservations: false, activeCount: 0 });
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkReservations = useCallback(async (): Promise<void> => {
        if (!walletAddress) {
            setState({ hasActiveReservations: false, activeCount: 0 });
            return;
        }
        try {
            const [resCount, currentBlock] = await Promise.all([
                getReservationCount(),
                providerService.getProvider(network).getBlockNumber(),
            ]);

            const walletHex = String(walletAddress).toLowerCase();
            let count = 0;
            for (let i = resCount - 1n; i >= 0n && i > resCount - 50n; i--) {
                try {
                    const res = await getReservation(i);
                    if (res.active && res.buyer.toLowerCase() === walletHex && res.expiryBlock > currentBlock) {
                        if (!isPendingCompletion(i)) {
                            count++;
                        }
                    }
                } catch {
                    // skip
                }
            }
            setState({ hasActiveReservations: count > 0, activeCount: count });
        } catch {
            // non-fatal
        }
    }, [walletAddress, network, getReservationCount, getReservation]);

    useEffect(() => {
        if (!isConnected) {
            setState({ hasActiveReservations: false, activeCount: 0 });
            return;
        }
        void checkReservations();
        pollRef.current = setInterval(() => void checkReservations(), 15_000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [isConnected, checkReservations]);

    return (
        <ReservationAlertContext.Provider value={state}>
            {children}
        </ReservationAlertContext.Provider>
    );
}

export function useReservationAlert(): ReservationAlertState {
    return useContext(ReservationAlertContext);
}
