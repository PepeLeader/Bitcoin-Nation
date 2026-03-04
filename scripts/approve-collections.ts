/**
 * Approve all factory + registry collections on the new marketplace contract.
 *
 * Usage: npm run approve-collections
 */

import 'dotenv/config';
import {
    AddressTypes,
    type QuantumBIP32Interface,
    Mnemonic,
    MLDSASecurityLevel,
} from '@btc-vision/transaction';
import { type Signer } from '@btc-vision/bitcoin';
import type { UniversalSigner } from '@btc-vision/ecpair';
import {
    JSONRpcProvider,
    getContract,
    ABIDataTypes,
    BitcoinAbiTypes,
    OP_NET_ABI,
    type BitcoinInterfaceAbi,
} from 'opnet';
import { networks, type Network } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal ABIs using proper opnet types
const FactoryAbi: BitcoinInterfaceAbi = [
    {
        name: 'collectionCount',
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'collectionAtIndex',
        inputs: [{ name: 'index', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];

const RegistryAbi: BitcoinInterfaceAbi = [
    {
        name: 'submissionCount',
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionAtIndex',
        inputs: [{ name: 'index', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];

const MarketplaceAbi: BitcoinInterfaceAbi = [
    {
        name: 'approveCollection',
        inputs: [{ name: 'collection', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isCollectionApproved',
        inputs: [{ name: 'collection', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'approved', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];

// ---------------------------------------------------------------------------
const MNEMONIC = process.env['MNEMONIC'];
const NETWORK_NAME = process.env['NETWORK'] ?? 'regtest';

const NETWORK_MAP: Record<string, Network> = {
    regtest: networks.regtest,
    testnet: networks.opnetTestnet,
    mainnet: networks.bitcoin,
};

const RPC_URLS: Record<string, string> = {
    regtest: 'https://regtest.opnet.org',
    testnet: 'https://testnet.opnet.org',
    mainnet: 'https://api.opnet.org',
};

interface Wallet {
    keypair: Signer | UniversalSigner;
    mldsaKeypair: QuantumBIP32Interface | null;
    p2tr: string;
}

function deriveWallet(network: Network): Wallet {
    if (!MNEMONIC) {
        console.error('ERROR: Set MNEMONIC in .env');
        process.exit(1);
    }
    const mnemonic = new Mnemonic(MNEMONIC, '', network, MLDSASecurityLevel.LEVEL2);
    return mnemonic.deriveOPWallet(AddressTypes.P2TR, 0);
}

async function main(): Promise<void> {
    const network = NETWORK_MAP[NETWORK_NAME]!;
    const rpcUrl = RPC_URLS[NETWORK_NAME]!;
    const provider = new JSONRpcProvider({ url: rpcUrl, network });

    console.log(`\n  === Approve Collections on New Marketplace ===`);
    console.log(`  Network: ${NETWORK_NAME}`);

    const wallet = deriveWallet(network);
    console.log(`  Wallet: ${wallet.p2tr}\n`);

    // Read deployment info
    const deployment = JSON.parse(
        readFileSync(resolve(import.meta.dirname, 'deployment.json'), 'utf-8'),
    ) as Record<string, string>;

    const factoryAddr = deployment.factoryAddress!;
    const registryAddr = deployment.registryAddress!;
    const marketplaceAddr = deployment.marketplaceAddress!;

    console.log(`  Factory:     ${factoryAddr}`);
    console.log(`  Registry:    ${registryAddr}`);
    console.log(`  Marketplace: ${marketplaceAddr}\n`);

    // Collect all collection addresses
    const collectionAddresses: string[] = [];

    // From factory
    console.log('  Querying factory collections...');
    const factory = getContract(factoryAddr, FactoryAbi, provider, network) as any;
    const countResult = await factory.collectionCount();
    const factoryCount = countResult.properties.count as bigint;
    console.log(`  Factory collections: ${factoryCount.toString()}`);

    for (let i = 0n; i < factoryCount; i++) {
        const addrResult = await factory.collectionAtIndex(i);
        const addr = String(addrResult.properties.collectionAddress);
        collectionAddresses.push(addr);
        console.log(`    [${i.toString()}] ${addr}`);
    }

    // From registry
    if (registryAddr) {
        console.log('\n  Querying registry submissions...');
        const registry = getContract(registryAddr, RegistryAbi, provider, network) as any;
        const regCountResult = await registry.submissionCount();
        const regCount = regCountResult.properties.count as bigint;
        console.log(`  Registry submissions: ${regCount.toString()}`);

        for (let i = 0n; i < regCount; i++) {
            const addrResult = await registry.submissionAtIndex(i);
            const addr = String(addrResult.properties.collectionAddress);
            if (!collectionAddresses.includes(addr)) {
                collectionAddresses.push(addr);
                console.log(`    [${i.toString()}] ${addr}`);
            }
        }
    }

    if (collectionAddresses.length === 0) {
        console.log('\n  No collections found. Nothing to approve.');
        await provider.close();
        return;
    }

    console.log(`\n  Total unique collections to approve: ${collectionAddresses.length}\n`);

    // Approve each collection on the marketplace
    const marketplace = getContract(marketplaceAddr, MarketplaceAbi, provider, network) as any;

    // Resolve wallet address to a full Address object with both ML-DSA + legacy keys
    const senderAddress = await provider.getPublicKeyInfo(wallet.p2tr, true);
    marketplace.setSender(senderAddress);

    for (const addr of collectionAddresses) {
        console.log(`  Approving ${addr}...`);

        try {
            // Check if already approved
            const checkResult = await marketplace.isCollectionApproved(Address.fromString(addr));
            if (checkResult.properties.approved) {
                console.log(`    Already approved, skipping.`);
                continue;
            }

            const simulation = await marketplace.approveCollection(Address.fromString(addr));

            if (simulation.revert) {
                console.log(`    REVERT: ${simulation.revert}`);
                continue;
            }

            await simulation.sendTransaction({
                signer: wallet.keypair,
                mldsaSigner: wallet.mldsaKeypair,
                refundTo: wallet.p2tr,
                maximumAllowedSatToSpend: 30_000n,
                feeRate: 10,
                network,
            });

            console.log(`    Approved!`);

            // Small delay between transactions
            await new Promise((r) => setTimeout(r, 2000));
        } catch (err) {
            console.log(`    ERROR: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    console.log('\n  Done!\n');
    await provider.close();
}

main().catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
});
