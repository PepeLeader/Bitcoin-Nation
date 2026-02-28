/**
 * Bitcoin Nation — Contract Deployment Script
 *
 * Deploys all contracts to OPNet:
 *   1. BitcoinNationNFT (template) — OP721 template used by the factory
 *   2. BitcoinNationFactory — Factory that clones the template for each new collection
 *   3. CollectionRegistry — Standalone registry for external collection submissions
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in your mnemonic
 *   2. Fund your regtest wallet at the p2tr address printed below
 *   3. Run: npm run deploy
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    Address,
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
import { type Signer, toXOnly, toHex, address as btcAddress } from '@btc-vision/bitcoin';
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
        throw new Error(`Unknown network: ${NETWORK_NAME}. Use "regtest" or "mainnet".`);
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

/**
 * Build constructor calldata for the NFT template deployment.
 * The template is never used directly — it's cloned by the factory —
 * but onDeployment still runs, so we pass valid (placeholder) values.
 *
 * @param ownerPubKey           Hex public key for the owner address placeholder.
 * @param ownerTweakedKeyHex    Hex tweaked key from the P2TR address.
 */
function buildNFTTemplateCalldata(ownerPubKey: string, ownerTweakedKeyHex: string): Uint8Array {
    const writer: BinaryWriter = new BinaryWriter();
    writer.writeStringWithLength('Template');          // name
    writer.writeStringWithLength('TMPL');              // symbol
    writer.writeStringWithLength('');                  // baseURI
    writer.writeU256(1n);                              // maxSupply (placeholder, template is never minted directly)
    writer.writeU256(0n);                              // mintPrice
    writer.writeU256(0n);                              // maxPerWallet
    writer.writeStringWithLength('');                  // collectionBanner
    writer.writeStringWithLength('');                  // collectionIcon
    writer.writeStringWithLength('');                  // collectionWebsite
    writer.writeStringWithLength('Bitcoin Nation NFT Template');  // collectionDescription
    const ownerAddr: Address = Address.fromString(ownerPubKey);
    writer.writeAddress(ownerAddr);                    // treasury (placeholder = deployer)
    writer.writeU256(BigInt('0x' + ownerTweakedKeyHex)); // treasuryTweakedKey
    writer.writeAddress(ownerAddr);                    // owner
    writer.writeU256(BigInt('0x' + ownerTweakedKeyHex)); // ownerTweakedKey
    return writer.getBuffer();
}

/**
 * Build constructor calldata for the factory deployment.
 * The factory's onDeployment reads:
 *   1. Address — template contract address
 *   2. u256   — admin tweaked public key (from deployer's P2TR address)
 */
function buildFactoryCalldata(templatePubKey: string, adminTweakedKeyHex: string): Uint8Array {
    const writer: BinaryWriter = new BinaryWriter();
    const addr: Address = Address.fromString(templatePubKey);
    writer.writeAddress(addr);
    writer.writeU256(BigInt('0x' + adminTweakedKeyHex));
    return writer.getBuffer();
}

/**
 * Build constructor calldata for the registry deployment.
 * The registry's onDeployment reads:
 *   1. u256 — admin tweaked public key (from deployer's P2TR address)
 */
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

    console.error('\n  ERROR: Set MNEMONIC or WIF_KEY in scripts/.env');
    console.error('  Copy .env.example to .env and fill in your credentials.\n');
    return process.exit(1);
}

async function main(): Promise<void> {
    const network: Network = getNetwork();
    const rpcUrl: string = getRpcUrl();

    console.log(`\n  Network:  ${NETWORK_NAME}`);
    console.log(`  RPC URL:  ${rpcUrl}\n`);

    // Derive wallet
    const wallet: DeployerWallet = deriveWallet(network);
    const walletAddress: string = wallet.p2tr;

    console.log(`  Wallet address (p2tr): ${walletAddress}`);
    console.log('  Fund this address with regtest BTC before deploying.\n');

    // Connect provider
    const provider: JSONRpcProvider = new JSONRpcProvider({ url: rpcUrl, network });

    // Check UTXOs
    const utxos: UTXO[] = await provider.utxoManager.getUTXOs({
        address: walletAddress,
    });

    if (utxos.length === 0) {
        console.error('  ERROR: No UTXOs found for this wallet.');
        console.error('  Fund the address above with regtest BTC and try again.\n');
        await provider.close();
        process.exit(1);
    }

    const totalSats: bigint = utxos.reduce(
        (sum: bigint, u: UTXO) => sum + u.value,
        0n,
    );
    console.log(`  UTXOs: ${utxos.length} (total: ${totalSats} sats)\n`);

    const factory: TransactionFactory = new TransactionFactory();

    // -----------------------------------------------------------------------
    // Step 1: Deploy NFT Template
    // -----------------------------------------------------------------------
    console.log('  [1/3] Deploying BitcoinNationNFT template...');

    const nftBytecode: Uint8Array = readWasm('BitcoinNationNFT.wasm');
    // Use deployer's x-only public key as placeholder treasury for the template
    const deployerXOnly: Uint8Array = toXOnly(wallet.keypair.publicKey);
    const deployerXOnlyHex: string = toHex(deployerXOnly);
    // Extract tweaked key from the P2TR address (scriptPubKey bytes 2..34)
    const p2trScript: Buffer = btcAddress.toOutputScript(walletAddress, network);
    const tweakedKeyHex: string = toHex(p2trScript.subarray(2, 34));
    const nftCalldata: Uint8Array = buildNFTTemplateCalldata(deployerXOnlyHex, tweakedKeyHex);

    console.log(`  Bytecode size: ${nftBytecode.length} bytes`);

    const nftChallenge = await provider.getChallenge();

    const nftDeployParams: IDeploymentParameters = {
        from: walletAddress,
        utxos,
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network,
        feeRate: 10,
        priorityFee: 0n,
        gasSatFee: 20_000n,
        bytecode: nftBytecode,
        calldata: nftCalldata,
        challenge: nftChallenge,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
    };

    const nftDeployment = await factory.signDeployment(nftDeployParams);
    const templateAddress: string = nftDeployment.contractAddress;
    const templatePubKey: string = nftDeployment.contractPubKey;

    console.log(`  Template contract address: ${templateAddress}`);
    console.log(`  Template public key:       ${templatePubKey}`);

    // Broadcast funding TX
    const nftFunding = await provider.sendRawTransaction(nftDeployment.transaction[0], false);
    console.log(`  Funding TX:    success=${String(nftFunding.success)} result=${nftFunding.result ?? 'none'} error=${nftFunding.error ?? 'none'}`);
    if (!nftFunding.success) {
        throw new Error(`NFT funding broadcast failed: ${nftFunding.error ?? nftFunding.result ?? 'unknown'}`);
    }

    // Broadcast reveal TX
    const nftReveal = await provider.sendRawTransaction(nftDeployment.transaction[1], false);
    console.log(`  Reveal TX:     success=${String(nftReveal.success)} result=${nftReveal.result ?? 'none'} error=${nftReveal.error ?? 'none'}`);
    if (!nftReveal.success) {
        throw new Error(`NFT reveal broadcast failed: ${nftReveal.error ?? nftReveal.result ?? 'unknown'}`);
    }
    console.log('  Template deployed!\n');

    // -----------------------------------------------------------------------
    // Step 2: Deploy Factory (with template address as constructor arg)
    // -----------------------------------------------------------------------
    console.log('  [2/3] Deploying BitcoinNationFactory...');

    const factoryBytecode: Uint8Array = readWasm('BitcoinNationFactory.wasm');
    const factoryCalldata: Uint8Array = buildFactoryCalldata(templatePubKey, tweakedKeyHex);

    console.log(`  Bytecode size: ${factoryBytecode.length} bytes`);

    // Use refund UTXOs from previous deployment
    const updatedUtxos: UTXO[] = nftDeployment.utxos;

    const factoryChallenge = await provider.getChallenge();

    const factoryDeployParams: IDeploymentParameters = {
        from: walletAddress,
        utxos: updatedUtxos,
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network,
        feeRate: 10,
        priorityFee: 0n,
        gasSatFee: 15_000n,
        bytecode: factoryBytecode,
        calldata: factoryCalldata,
        challenge: factoryChallenge,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
    };

    const factoryDeployment = await factory.signDeployment(factoryDeployParams);
    const factoryAddress: string = factoryDeployment.contractAddress;

    console.log(`  Factory contract address: ${factoryAddress}`);

    // Broadcast
    const factoryFunding = await provider.sendRawTransaction(factoryDeployment.transaction[0], false);
    console.log(`  Funding TX:    success=${String(factoryFunding.success)} result=${factoryFunding.result ?? 'none'} error=${factoryFunding.error ?? 'none'}`);
    if (!factoryFunding.success) {
        throw new Error(`Factory funding broadcast failed: ${factoryFunding.error ?? factoryFunding.result ?? 'unknown'}`);
    }

    const factoryReveal = await provider.sendRawTransaction(factoryDeployment.transaction[1], false);
    console.log(`  Reveal TX:     success=${String(factoryReveal.success)} result=${factoryReveal.result ?? 'none'} error=${factoryReveal.error ?? 'none'}`);
    if (!factoryReveal.success) {
        throw new Error(`Factory reveal broadcast failed: ${factoryReveal.error ?? factoryReveal.result ?? 'unknown'}`);
    }
    console.log('  Factory deployed!\n');

    // -----------------------------------------------------------------------
    // Step 3: Deploy CollectionRegistry
    // -----------------------------------------------------------------------
    console.log('  [3/3] Deploying CollectionRegistry...');

    const registryBytecode: Uint8Array = readWasm('CollectionRegistry.wasm');
    const registryCalldata: Uint8Array = buildRegistryCalldata(tweakedKeyHex);

    console.log(`  Bytecode size: ${registryBytecode.length} bytes`);

    const registryUtxos: UTXO[] = factoryDeployment.utxos;
    const registryChallenge = await provider.getChallenge();

    const registryDeployParams: IDeploymentParameters = {
        from: walletAddress,
        utxos: registryUtxos,
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network,
        feeRate: 10,
        priorityFee: 0n,
        gasSatFee: 15_000n,
        bytecode: registryBytecode,
        calldata: registryCalldata,
        challenge: registryChallenge,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
    };

    const registryDeployment = await factory.signDeployment(registryDeployParams);
    const registryAddress: string = registryDeployment.contractAddress;

    console.log(`  Registry contract address: ${registryAddress}`);

    const registryFunding = await provider.sendRawTransaction(registryDeployment.transaction[0], false);
    console.log(`  Funding TX:    success=${String(registryFunding.success)} result=${registryFunding.result ?? 'none'} error=${registryFunding.error ?? 'none'}`);
    if (!registryFunding.success) {
        throw new Error(`Registry funding broadcast failed: ${registryFunding.error ?? registryFunding.result ?? 'unknown'}`);
    }

    const registryReveal = await provider.sendRawTransaction(registryDeployment.transaction[1], false);
    console.log(`  Reveal TX:     success=${String(registryReveal.success)} result=${registryReveal.result ?? 'none'} error=${registryReveal.error ?? 'none'}`);
    if (!registryReveal.success) {
        throw new Error(`Registry reveal broadcast failed: ${registryReveal.error ?? registryReveal.result ?? 'unknown'}`);
    }
    console.log('  Registry deployed!\n');

    // -----------------------------------------------------------------------
    // Save deployment info
    // -----------------------------------------------------------------------
    const deploymentInfo = {
        network: NETWORK_NAME,
        walletAddress,
        templateAddress,
        factoryAddress,
        registryAddress,
        timestamp: new Date().toISOString(),
    };

    const outPath: string = resolve(import.meta.dirname, 'deployment.json');
    writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2), 'utf-8');

    console.log('  ======================================');
    console.log('  Deployment complete!');
    console.log(`  Template: ${templateAddress}`);
    console.log(`  Factory:  ${factoryAddress}`);
    console.log(`  Registry: ${registryAddress}`);
    console.log(`  Saved to: ${outPath}`);
    console.log('  ======================================\n');

    console.log('  Next steps:');
    console.log('  1. Update frontend/src/config/contracts.ts with the factory and registry addresses');
    console.log('  2. Run the frontend: cd ../frontend && npm run dev');
    console.log('  3. Connect your wallet and create a collection!\n');

    await provider.close();
}

main().catch((err: unknown) => {
    console.error('\n  Deployment failed:', err);
    process.exit(1);
});
