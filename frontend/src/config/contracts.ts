import { networks, Network } from '@btc-vision/bitcoin';

interface NetworkConfig {
    readonly rpcUrl: string;
    readonly factoryAddress: string;
    readonly adminAddress: string;
}

const NETWORK_CONFIGS: ReadonlyMap<Network, NetworkConfig> = new Map([
    [
        networks.regtest,
        {
            rpcUrl: 'https://regtest.opnet.org',
            factoryAddress: 'opr1sqpk7rhjxjn6vqex54t48kjjsl9n8fk77rcfjhdpl',
            adminAddress: 'bcrt1pamas9lkyeukw4yumnv5fjqyl04w6e7ccj5pss4kew5tkml2k8exqu992z3',
        },
    ],
    [
        networks.opnetTestnet,
        {
            rpcUrl: 'https://testnet.opnet.org',
            factoryAddress: 'opt1sqzy8zvyf8qh04cjf4vl8s7rg7s7w0vqr7sft9zuj',
            adminAddress: 'opt1pamas9lkyeukw4yumnv5fjqyl04w6e7ccj5pss4kew5tkml2k8exqq7cgng',
        },
    ],
    [
        networks.bitcoin,
        {
            rpcUrl: 'https://api.opnet.org',
            factoryAddress: '', // Set after deploying factory to mainnet
            adminAddress: '',
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

export function getAdminAddress(network: Network): string {
    return getNetworkConfig(network).adminAddress;
}
