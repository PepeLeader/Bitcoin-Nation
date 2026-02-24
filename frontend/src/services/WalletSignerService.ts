import { UnisatSigner, WalletNetworks } from '@btc-vision/transaction';
import type { Unisat } from '@btc-vision/transaction';

/**
 * Resolves a working signer for any supported wallet.
 *
 * window.unisat is read-only (set by UniSat extension), so we cannot
 * reassign it. Instead we subclass UnisatSigner and override the
 * `unisat` getter to return the wallet the user actually connected
 * with, plus a network-string fix ("livenet" → "mainnet").
 */

const NETWORK_MAP: Record<string, WalletNetworks> = {
    livenet: WalletNetworks.Mainnet,
    mainnet: WalletNetworks.Mainnet,
    testnet: WalletNetworks.Testnet,
    regtest: WalletNetworks.Regtest,
};

interface WindowWithWallets {
    opnet?: Unisat;
    unisat?: Unisat;
}

function getWalletWindow(): WindowWithWallets {
    return window as unknown as WindowWithWallets;
}

/**
 * Wraps a wallet instance so getNetwork() maps non-standard strings
 * like "livenet" to the values UnisatSigner expects.
 */
function wrapWallet(instance: Unisat): Unisat {
    return new Proxy(instance, {
        get(target: Unisat, prop: string | symbol): unknown {
            if (prop === 'getNetwork') {
                return async (): Promise<WalletNetworks> => {
                    const raw: string =
                        (await target.getNetwork()) as string;
                    return NETWORK_MAP[raw] ?? (raw as WalletNetworks);
                };
            }

            const value: unknown = Reflect.get(target, prop) as unknown;
            if (typeof value === 'function') {
                return (value as (...args: unknown[]) => unknown).bind(
                    target,
                );
            }
            return value;
        },
    });
}

/**
 * UnisatSigner subclass that uses an injected wallet reference
 * instead of reading window.unisat (which may be read-only or
 * point to the wrong wallet).
 */
class WalletBridgeSigner extends UnisatSigner {
    readonly #wallet: Unisat;

    public constructor(wallet: Unisat) {
        super();
        this.#wallet = wallet;
    }

    public override get unisat(): Unisat {
        return this.#wallet;
    }
}

let cachedSigner: UnisatSigner | null = null;

export async function getOrCreateSigner(
    contextSigner: UnisatSigner | null,
    walletInstance: Unisat | null,
): Promise<UnisatSigner | null> {
    if (contextSigner) {
        cachedSigner = contextSigner;
        return contextSigner;
    }

    if (cachedSigner) {
        return cachedSigner;
    }

    const w: WindowWithWallets = getWalletWindow();
    const instance: Unisat | undefined =
        walletInstance ?? w.opnet ?? w.unisat;

    if (!instance) {
        console.warn('[WalletSigner] No wallet API found');
        return null;
    }

    const wrapped: Unisat = wrapWallet(instance);
    const signer: WalletBridgeSigner = new WalletBridgeSigner(wrapped);
    await signer.init();
    cachedSigner = signer;
    return signer;
}

export function clearCachedSigner(): void {
    cachedSigner = null;
}
