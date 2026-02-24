import { useMemo, useState, useEffect } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { networks, type Network } from '@btc-vision/bitcoin';
import type { Address, UnisatSigner } from '@btc-vision/transaction';
import {
    getOrCreateSigner,
    clearCachedSigner,
} from '../services/WalletSignerService';

interface WalletState {
    readonly isConnected: boolean;
    readonly address: Address | null;
    readonly addressStr: string | null;
    readonly hashedMLDSAKey: string | null;
    readonly network: Network;
    readonly signer: UnisatSigner | null;
    readonly openConnectModal: () => void;
    readonly disconnect: () => void;
}

export function useWallet(): WalletState {
    const ctx = useWalletConnect();
    const [resolvedSigner, setResolvedSigner] = useState<UnisatSigner | null>(
        null,
    );

    const network: Network = useMemo(() => {
        if (!ctx.network) return networks.opnetTestnet;
        const bech32 = ctx.network.bech32 as string;
        if (bech32 === 'bc') return networks.bitcoin;
        if (bech32 === 'opt') return networks.opnetTestnet;
        if (bech32 === 'bcrt') return networks.regtest;
        return networks.opnetTestnet;
    }, [ctx.network]);

    const isConnected: boolean = ctx.address !== null;

    useEffect(() => {
        if (!isConnected) {
            clearCachedSigner();
            setResolvedSigner(null);
            return;
        }

        let cancelled = false;

        void getOrCreateSigner(ctx.signer ?? null, ctx.walletInstance ?? null)
            .then((signer: UnisatSigner | null) => {
                if (!cancelled) {
                    setResolvedSigner(signer);
                }
            })
            .catch((err: unknown) => {
                console.error(
                    '[useWallet] Failed to resolve signer:',
                    err,
                );
            });

        return () => {
            cancelled = true;
        };
    }, [isConnected, ctx.signer, ctx.walletInstance]);

    return {
        isConnected,
        address: ctx.address,
        addressStr: ctx.walletAddress,
        hashedMLDSAKey: ctx.hashedMLDSAKey ?? null,
        network,
        signer: resolvedSigner,
        openConnectModal: ctx.openConnectModal,
        disconnect: ctx.disconnect,
    };
}
