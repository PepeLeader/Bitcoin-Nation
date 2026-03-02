import { networks, Network } from '@btc-vision/bitcoin';

interface NetworkConfig {
    readonly rpcUrl: string;
    readonly factoryAddress: string;
    readonly registryAddress: string;
    readonly marketplaceAddress: string;
    readonly adminAddress: string;
    readonly explorerTxUrl: string;
}

const NETWORK_CONFIGS: ReadonlyMap<Network, NetworkConfig> = new Map([
    [
        networks.regtest,
        {
            rpcUrl: 'https://regtest.opnet.org',
            factoryAddress: 'opr1sqpk7rhjxjn6vqex54t48kjjsl9n8fk77rcfjhdpl',
            registryAddress: '', // Set after deploying registry to regtest
            marketplaceAddress: '', // Set after deploying marketplace to regtest
            adminAddress: 'bcrt1pamas9lkyeukw4yumnv5fjqyl04w6e7ccj5pss4kew5tkml2k8exqu992z3',
            explorerTxUrl: '',
        },
    ],
    [
        networks.opnetTestnet,
        {
            rpcUrl: 'https://testnet.opnet.org',
            factoryAddress: 'opt1sqzy8zvyf8qh04cjf4vl8s7rg7s7w0vqr7sft9zuj',
            registryAddress: 'opt1sqrq064ddxwytjd5fd33derp96szly02cvcnfjp7r',
            marketplaceAddress: 'opt1sqpxmjr7dmdam4p6lmjqtvwccdaf8gun5zvhrc3ex',
            adminAddress: 'opt1pamas9lkyeukw4yumnv5fjqyl04w6e7ccj5pss4kew5tkml2k8exqq7cgng',
            explorerTxUrl: 'https://mempool.space/signet/tx/',
        },
    ],
    [
        networks.bitcoin,
        {
            rpcUrl: 'https://api.opnet.org',
            factoryAddress: '', // Set after deploying factory to mainnet
            registryAddress: '', // Set after deploying registry to mainnet
            marketplaceAddress: '', // Set after deploying marketplace to mainnet
            adminAddress: '',
            explorerTxUrl: 'https://mempool.space/tx/',
        },
    ],
]);

export function getNetworkConfig(network: Network): NetworkConfig {
    const config = NETWORK_CONFIGS.get(network);
    if (!config) {
        throw new Error(`Unsupported network`);
    }
    return config;
}

export function getFactoryAddress(network: Network): string {
    return getNetworkConfig(network).factoryAddress;
}

export function getRpcUrl(network: Network): string {
    return getNetworkConfig(network).rpcUrl;
}

export function getRegistryAddress(network: Network): string {
    return getNetworkConfig(network).registryAddress;
}

export function getMarketplaceAddress(network: Network): string {
    return getNetworkConfig(network).marketplaceAddress;
}

export function getAdminAddress(network: Network): string {
    return getNetworkConfig(network).adminAddress;
}

export function getExplorerTxUrl(network: Network, txId: string): string | null {
    const base = getNetworkConfig(network).explorerTxUrl;
    if (!base) return null;
    return `${base}${txId}`;
}
