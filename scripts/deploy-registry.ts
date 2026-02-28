/**
 * Bitcoin Nation — CollectionRegistry Deployment Script
 *
 * Deploys ONLY the CollectionRegistry contract (does NOT redeploy factory or template).
 * Use this when adding the registry to an existing deployment.
 *
 * Usage:
 *   1. Ensure .env has MNEMONIC and NETWORK set
 *   2. Build the registry: cd ../contracts && npm run build:registry
 *   3. Run: npm run deploy:registry
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    AddressTypes,
    BinaryWriter,
    EcKeyPair,
    type IDeploymentParameters,
    type QuantumBIP32Interface,
    TransactionFactory,
    Mnemonic,
    MLDSASecurityLevel,
    type UTXO,
} from '@btc-vision/transaction';
import { type Signer, address as btcAddress, toHex } from '@btc-vision/bitcoin';
import type { UniversalSigner } from '@btc-vision/ecpair';
import { JSONRpcProvider } from 'opnet';
import { networks, type Network } from '@btc-vision/bitcoin';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MNEMONIC: string | undefined = process.env['MNEMONIC'];
const WIF_KEY: string | undefined = process.env['WIF_KEY'];
const NETWORK_NAME: string = process.env['NETWORK'] ?? 'regtest';

const RPC_URLS: Readonly<Record<string, string>> = {
    regtest: 'https://regtest.opnet.org',
    testnet: 'https://testnet.opnet.org',
    mainnet: 'https://api.opnet.org',
} as const;

const NETWORK_MAP: Readonly<Record<string, Network>> = {
    regtest: networks.regtest,
    testnet: networks.opnetTestnet,
    mainnet: networks.bitcoin,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNetwork(): Network {
    const net: Network | undefined = NETWORK_MAP[NETWORK_NAME];
    if (!net) {
        throw new Error(`Unknown network: ${NETWORK_NAME}. Use "regtest", "testnet", or "mainnet".`);
    }
    return net;
}

function getRpcUrl(): string {
    const url: string | undefined = RPC_URLS[NETWORK_NAME];
    if (!url) {
        throw new Error(`No RPC URL for network: ${NETWORK_NAME}`);
    }
    return url;
}

function readWasm(filename: string): Uint8Array {
    const fullPath: string = resolve(import.meta.dirname, '..', 'contracts', 'build', filename);
    console.log(`  Reading bytecode: ${fullPath}`);
    const buffer: Buffer = readFileSync(fullPath);
    return new Uint8Array(buffer);
}

function buildRegistryCalldata(adminTweakedKeyHex: string): Uint8Array {
    const writer: BinaryWriter = new BinaryWriter();
    writer.writeU256(BigInt('0x' + adminTweakedKeyHex));
    return writer.getBuffer();
}

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

interface DeployerWallet {
    readonly keypair: Signer | UniversalSigner;
    readonly mldsaKeypair: QuantumBIP32Interface | null;
    readonly p2tr: string;
}

function deriveWallet(network: Network): DeployerWallet {
    if (MNEMONIC && !MNEMONIC.includes('replace with real')) {
        console.log('  Using mnemonic wallet (ECDSA + ML-DSA)');
        const mnemonic: Mnemonic = new Mnemonic(
            MNEMONIC,
            '',
            network,
            MLDSASecurityLevel.LEVEL2,
        );
        return mnemonic.deriveOPWallet(AddressTypes.P2TR, 0);
    }

    if (WIF_KEY) {
        console.log('  Using WIF key wallet (ECDSA only)');
        const signer = EcKeyPair.fromWIF(WIF_KEY, network);
        const address: string = EcKeyPair.getTaprootAddress(signer, network);
        return {
            keypair: signer,
            mldsaKeypair: null,
            p2tr: address,
        };
    }

    console.error('\n  ERROR: Set MNEMONIC or WIF_KEY in .env');
    return process.exit(1);
}

async function main(): Promise<void> {
    const network: Network = getNetwork();
    const rpcUrl: string = getRpcUrl();

    console.log(`\n  === CollectionRegistry Deployment ===`);
    console.log(`  Network:  ${NETWORK_NAME}`);
    console.log(`  RPC URL:  ${rpcUrl}\n`);

    // Derive wallet
    const wallet: DeployerWallet = deriveWallet(network);
    const walletAddress: string = wallet.p2tr;

    console.log(`  Wallet address (p2tr): ${walletAddress}\n`);

    // Connect provider
    const provider: JSONRpcProvider = new JSONRpcProvider({ url: rpcUrl, network });

    // Check UTXOs
    const utxos: UTXO[] = await provider.utxoManager.getUTXOs({
        address: walletAddress,
    });

    if (utxos.length === 0) {
        console.error('  ERROR: No UTXOs found for this wallet.');
        console.error('  Fund the address above and try again.\n');
        await provider.close();
        process.exit(1);
    }

    const totalSats: bigint = utxos.reduce(
        (sum: bigint, u: UTXO) => sum + u.value,
        0n,
    );
    console.log(`  UTXOs: ${utxos.length} (total: ${totalSats} sats)\n`);

    // Extract tweaked key from the P2TR address
    const p2trScript: Buffer = btcAddress.toOutputScript(walletAddress, network);
    const tweakedKeyHex: string = toHex(p2trScript.subarray(2, 34));

    // Deploy CollectionRegistry
    console.log('  Deploying CollectionRegistry...');

    const registryBytecode: Uint8Array = readWasm('CollectionRegistry.wasm');
    const registryCalldata: Uint8Array = buildRegistryCalldata(tweakedKeyHex);

    console.log(`  Bytecode size: ${registryBytecode.length} bytes`);

    const factory: TransactionFactory = new TransactionFactory();
    const challenge = await provider.getChallenge();

    const deployParams: IDeploymentParameters = {
        from: walletAddress,
        utxos,
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network,
        feeRate: 10,
        priorityFee: 0n,
        gasSatFee: 15_000n,
        bytecode: registryBytecode,
        calldata: registryCalldata,
        challenge,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
    };

    const deployment = await factory.signDeployment(deployParams);
    const registryAddress: string = deployment.contractAddress;

    console.log(`  Registry contract address: ${registryAddress}`);

    // Broadcast funding TX
    const funding = await provider.sendRawTransaction(deployment.transaction[0], false);
    console.log(`  Funding TX:    success=${String(funding.success)} result=${funding.result ?? 'none'} error=${funding.error ?? 'none'}`);
    if (!funding.success) {
        throw new Error(`Registry funding broadcast failed: ${funding.error ?? funding.result ?? 'unknown'}`);
    }

    // Broadcast reveal TX
    const reveal = await provider.sendRawTransaction(deployment.transaction[1], false);
    console.log(`  Reveal TX:     success=${String(reveal.success)} result=${reveal.result ?? 'none'} error=${reveal.error ?? 'none'}`);
    if (!reveal.success) {
        throw new Error(`Registry reveal broadcast failed: ${reveal.error ?? reveal.result ?? 'unknown'}`);
    }
    console.log('  Registry deployed!\n');

    // Save/update deployment info
    const outPath: string = resolve(import.meta.dirname, 'deployment.json');
    let deploymentInfo: Record<string, unknown> = {};

    if (existsSync(outPath)) {
        try {
            deploymentInfo = JSON.parse(readFileSync(outPath, 'utf-8')) as Record<string, unknown>;
        } catch {
            // Start fresh if parse fails
        }
    }

    deploymentInfo.registryAddress = registryAddress;
    deploymentInfo.registryDeployedAt = new Date().toISOString();

    writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2), 'utf-8');

    console.log('  ======================================');
    console.log('  Registry deployment complete!');
    console.log(`  Address: ${registryAddress}`);
    console.log(`  Saved to: ${outPath}`);
    console.log('  ======================================\n');

    console.log('  Next steps:');
    console.log(`  1. Update frontend/src/config/contracts.ts registryAddress for ${NETWORK_NAME}`);
    console.log('  2. Clear Vite cache: rm -rf frontend/node_modules/.vite');
    console.log('  3. Test submission flow on the frontend\n');

    await provider.close();
}

main().catch((err: unknown) => {
    console.error('\n  Deployment failed:', err);
    process.exit(1);
});
