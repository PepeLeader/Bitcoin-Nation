import { JSONRpcProvider } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { getRpcUrl } from '../config/contracts';

class ProviderService {
    static #instance: ProviderService | undefined;
    readonly #providers = new Map<string, JSONRpcProvider>();

    private constructor() {}

    static getInstance(): ProviderService {
        if (!ProviderService.#instance) {
            ProviderService.#instance = new ProviderService();
        }
        return ProviderService.#instance;
    }

    getProvider(network: Network): JSONRpcProvider {
        const key = network.bech32;

        const existing = this.#providers.get(key);
        if (existing) return existing;

        const provider = new JSONRpcProvider({
            url: getRpcUrl(network),
            network,
        });
        this.#providers.set(key, provider);
        return provider;
    }

    clearAll(): void {
        this.#providers.clear();
    }
}

export const providerService = ProviderService.getInstance();
