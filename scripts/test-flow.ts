/**
 * Bitcoin Nation — Full Flow Test Script
 *
 * Tests the complete reservation system on regtest:
 *   1. Read-only checks (admin, creationFee, collectionCount)
 *   2. Create collection (with 100k sat creation fee output)
 *   3. Apply for minting approval
 *   4. Admin approves collection
 *   5. Open minting
 *   6. Reserve NFTs (with 90/10 fee split outputs)
 *   7. Claim reserved NFTs
 *   8. Verify final state
 *
 * Usage: npx tsx test-flow.ts
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    Address,
    AddressTypes,
    Mnemonic,
    MLDSASecurityLevel,
    EcKeyPair,
    type UTXO,
} from '@btc-vision/transaction';
import type { Signer, PsbtOutputExtendedAddress } from '@btc-vision/bitcoin';
import { address as btcAddress, networks, toSatoshi } from '@btc-vision/bitcoin';
import type { UniversalSigner } from '@btc-vision/ecpair';
import type { QuantumBIP32Interface } from '@btc-vision/transaction';
import { getContract, JSONRpcProvider, TransactionOutputFlags } from 'opnet';
import { BitcoinNationFactoryAbi } from '../contracts/abis/BitcoinNationFactory.abi.js';
import { BitcoinNationNFTAbi } from '../contracts/abis/BitcoinNationNFT.abi.js';
import { OP721Abi } from '../contracts/abis/OP721.abi.js';

// Combine ABIs, deduplicating by name to avoid "Duplicate event" errors
const nftNames = new Set(BitcoinNationNFTAbi.map((e: { name?: string }) => e.name));
const CombinedNFTAbi = [
    ...BitcoinNationNFTAbi,
    ...OP721Abi.filter((e: { name?: string }) => e.name && !nftNames.has(e.name)),
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MNEMONIC: string | undefined = process.env['MNEMONIC'];
const WIF_KEY: string | undefined = process.env['WIF_KEY'];
const NETWORK_NAME: string = process.env['NETWORK'] ?? 'regtest';

const NETWORK_MAP: Readonly<Record<string, typeof networks.regtest>> = {
    regtest: networks.regtest,
    testnet: networks.opnetTestnet,
    mainnet: networks.bitcoin,
} as const;

const RPC_MAP: Readonly<Record<string, string>> = {
    regtest: 'https://regtest.opnet.org',
    testnet: 'https://testnet.opnet.org',
    mainnet: 'https://api.opnet.org',
} as const;

const network = NETWORK_MAP[NETWORK_NAME] ?? networks.regtest;
const RPC_URL = RPC_MAP[NETWORK_NAME] ?? 'https://regtest.opnet.org';

const deploymentPath: string = resolve(import.meta.dirname, 'deployment.json');
const deployment: { factoryAddress: string; walletAddress: string } = JSON.parse(
    readFileSync(deploymentPath, 'utf-8'),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Wallet {
    readonly keypair: Signer | UniversalSigner;
    readonly mldsaKeypair: QuantumBIP32Interface | null;
    readonly p2tr: string;
    readonly address?: Address;
}

function deriveWallet(): Wallet {
    if (MNEMONIC && !MNEMONIC.includes('replace with real')) {
        const mnemonic: Mnemonic = new Mnemonic(MNEMONIC, '', network, MLDSASecurityLevel.LEVEL2);
        return mnemonic.deriveOPWallet(AddressTypes.P2TR, 0);
    }

    if (WIF_KEY) {
        const signer = EcKeyPair.fromWIF(WIF_KEY, network);
        const address: string = EcKeyPair.getTaprootAddress(signer, network);
        return { keypair: signer, mldsaKeypair: null, p2tr: address };
    }

    console.error('ERROR: Set MNEMONIC or WIF_KEY in scripts/.env');
    return process.exit(1);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a new block to be mined by polling block number.
 * Testnet uses ~10 min Signet blocks; regtest is near-instant.
 */
async function waitForBlock(provider: JSONRpcProvider, label: string): Promise<void> {
    const startBlock: bigint = await provider.getBlockNumber();
    const maxWait: number = NETWORK_NAME === 'regtest' ? 60_000 : 720_000; // 1min regtest, 12min testnet
    const pollInterval: number = NETWORK_NAME === 'regtest' ? 3_000 : 15_000;
    const startTime: number = Date.now();

    process.stdout.write(`  Waiting for block (current: ${startBlock})...`);

    while (Date.now() - startTime < maxWait) {
        await sleep(pollInterval);
        const currentBlock: bigint = await provider.getBlockNumber();
        if (currentBlock > startBlock) {
            console.log(` confirmed at block ${currentBlock} (${label})`);
            await sleep(2000); // small buffer for indexing
            return;
        }
        process.stdout.write('.');
    }

    console.log(' timeout reached, continuing anyway');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function txParams(wallet: Wallet, maxSats: bigint, extras?: PsbtOutputExtendedAddress[]): any {
    return {
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        refundTo: wallet.p2tr,
        maximumAllowedSatToSpend: maxSats,
        feeRate: 10,
        network,
        ...(extras ? { extraOutputs: extras } : {}),
    };
}

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

function assert(condition: boolean, label: string): void {
    if (condition) {
        console.log(`  [${PASS}] ${label}`);
    } else {
        console.log(`  [${FAIL}] ${label}`);
        throw new Error(`Assertion failed: ${label}`);
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    console.log('\n=== Bitcoin Nation Full Flow Test ===\n');

    const wallet: Wallet = deriveWallet();
    const senderAddress: string = wallet.p2tr;
    console.log(`Wallet: ${senderAddress}`);
    console.log(`Factory: ${deployment.factoryAddress}\n`);

    const provider: JSONRpcProvider = new JSONRpcProvider({ url: RPC_URL, network });

    // Check UTXOs
    const utxos: UTXO[] = await provider.utxoManager.getUTXOs({ address: senderAddress });
    const totalSats: bigint = utxos.reduce((s: bigint, u: UTXO) => s + u.value, 0n);
    console.log(`UTXOs: ${utxos.length} (${totalSats} sats)\n`);

    if (utxos.length === 0) {
        console.error('No UTXOs. Fund the wallet first.');
        await provider.close();
        process.exit(1);
    }

    // Use wallet.address (derived locally) or fall back to RPC lookup
    let senderAddr: Address;
    if (wallet.address) {
        senderAddr = wallet.address;
        console.log(`Sender Address (local): ${senderAddr.toHex()}\n`);
    } else {
        senderAddr = await provider.getPublicKeyInfo(senderAddress, false);
        console.log(`Sender Address (RPC): ${senderAddr.toHex()}\n`);
    }

    // Get factory contract
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const factory: any = getContract(
        deployment.factoryAddress,
        BitcoinNationFactoryAbi,
        provider,
        network,
        senderAddr,
    );

    // -----------------------------------------------------------------------
    // Step 1: Read-only checks
    // -----------------------------------------------------------------------
    console.log('--- Step 1: Read-only checks ---');

    const adminResult = await factory.admin();
    console.log(`  Admin: ${String(adminResult.properties.admin)}`);

    const feeResult = await factory.creationFee();
    const creationFee: bigint = feeResult.properties.fee;
    console.log(`  Creation fee: ${creationFee} sats`);
    assert(creationFee === 100_000n, 'Creation fee is 100,000 sats');

    const countBefore = await factory.collectionCount();
    const countBeforeVal: bigint = countBefore.properties.count;
    console.log(`  Collections: ${countBeforeVal}\n`);

    // -----------------------------------------------------------------------
    // Step 2: Create collection (with creation fee output)
    // -----------------------------------------------------------------------
    console.log('--- Step 2: Create collection ---');

    const adminP2tr: string = deployment.walletAddress; // admin = deployer on regtest
    console.log(`  Admin P2TR:      ${adminP2tr}`);

    // Set transaction details with hasTo flag (index 1, NOT 0)
    factory.setTransactionDetails({
        inputs: [],
        outputs: [{
            to: adminP2tr,
            value: 100_000n,
            index: 1,
            flags: TransactionOutputFlags.hasTo,
        }],
    });

    const createSim = await factory.createCollection(
        'Test Reserve Collection',
        'TRC',
        'ipfs://QmTestBaseURI/',
        20n,       // maxSupply
        10_000n,   // mintPrice (10k sats)
        5n,        // maxPerWallet
        '',        // banner
        '',        // icon
        '',        // website
        'A test collection for the reservation system',
    );

    if (createSim.revert) {
        throw new Error(`createCollection reverted: ${createSim.revert}`);
    }

    const collectionAddress: string = String(createSim.properties.collectionAddress);
    console.log(`  New collection: ${collectionAddress}`);

    const extraOutputsCreate: PsbtOutputExtendedAddress[] = [
        { address: adminP2tr, value: toSatoshi(100_000n) },
    ];

    const createReceipt = await createSim.sendTransaction(
        txParams(wallet, 200_000n, extraOutputsCreate),
    );
    console.log(`  TX: ${createReceipt.transactionId}`);
    await waitForBlock(provider, 'createCollection');

    // Verify collection count increased
    const countAfter = await factory.collectionCount();
    const countAfterVal: bigint = countAfter.properties.count;
    assert(countAfterVal === countBeforeVal + 1n, `Collection count increased to ${countAfterVal}`);
    console.log();

    // -----------------------------------------------------------------------
    // Step 3: Apply for minting approval
    // -----------------------------------------------------------------------
    console.log('--- Step 3: Apply for minting approval ---');

    const collAddr: Address = Address.fromString(collectionAddress);

    const applySim = await factory.applyForMint(collAddr);
    if (applySim.revert) {
        throw new Error(`applyForMint reverted: ${applySim.revert}`);
    }

    const applyReceipt = await applySim.sendTransaction(txParams(wallet, 30_000n));
    console.log(`  TX: ${applyReceipt.transactionId}`);
    await waitForBlock(provider, 'applyForMint');

    const statusAfterApply = await factory.approvalStatus(collAddr);
    assert(statusAfterApply.properties.status === 1n, 'Status is PENDING (1)');
    console.log();

    // -----------------------------------------------------------------------
    // Step 4: Admin approves collection
    // -----------------------------------------------------------------------
    console.log('--- Step 4: Admin approves collection ---');

    const approveSim = await factory.approveCollection(collAddr);
    if (approveSim.revert) {
        throw new Error(`approveCollection reverted: ${approveSim.revert}`);
    }

    const approveReceipt = await approveSim.sendTransaction(txParams(wallet, 30_000n));
    console.log(`  TX: ${approveReceipt.transactionId}`);
    await waitForBlock(provider, 'approveCollection');

    const statusAfterApprove = await factory.approvalStatus(collAddr);
    assert(statusAfterApprove.properties.status === 2n, 'Status is APPROVED (2)');
    console.log();

    // -----------------------------------------------------------------------
    // Step 5: Open minting
    // -----------------------------------------------------------------------
    console.log('--- Step 5: Open minting ---');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nft: any = getContract(
        collectionAddress,
        CombinedNFTAbi,
        provider,
        network,
        senderAddr,
    );

    const openSim = await nft.setMintingOpen(true);
    if (openSim.revert) {
        throw new Error(`setMintingOpen reverted: ${openSim.revert}`);
    }

    const openReceipt = await openSim.sendTransaction(txParams(wallet, 30_000n));
    console.log(`  TX: ${openReceipt.transactionId}`);
    await waitForBlock(provider, 'setMintingOpen');

    const isOpenResult = await nft.isMintingOpen();
    assert(isOpenResult.properties.isOpen === true, 'Minting is open');
    console.log();

    // -----------------------------------------------------------------------
    // Step 6: Reserve NFTs (with fee split outputs)
    // -----------------------------------------------------------------------
    console.log('--- Step 6: Reserve 2 NFTs ---');

    const quantity: bigint = 2n;

    // Get mint price and tweaked keys for fee split verification
    const priceResult = await nft.mintPrice();
    const mintPrice: bigint = priceResult.properties.price;
    console.log(`  Mint price: ${mintPrice} sats`);

    const treasuryTweakedResult = await nft.treasuryTweakedKey();
    const ownerTweakedResult = await nft.ownerTweakedKey();
    const treasuryTweakedBigint: bigint = treasuryTweakedResult.properties.tweakedKey;
    const ownerTweakedBigint: bigint = ownerTweakedResult.properties.tweakedKey;

    // Convert tweaked keys to P2TR scriptPubKeys and bech32 addresses
    function bigintToBytes32BE(n: bigint): Uint8Array {
        const hex: string = n.toString(16).padStart(64, '0');
        const bytes: Uint8Array = new Uint8Array(32);
        for (let i: number = 0; i < 32; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }
    function tweakedKeyToScript(key: Uint8Array): Uint8Array {
        const script: Uint8Array = new Uint8Array(34);
        script[0] = 0x51; script[1] = 0x20;
        script.set(key, 2);
        return script;
    }

    const treasuryTweakedBytes: Uint8Array = bigintToBytes32BE(treasuryTweakedBigint);
    const ownerTweakedBytes: Uint8Array = bigintToBytes32BE(ownerTweakedBigint);
    const treasuryScript: Uint8Array = tweakedKeyToScript(treasuryTweakedBytes);
    const ownerScript: Uint8Array = tweakedKeyToScript(ownerTweakedBytes);
    const treasuryP2tr: string = btcAddress.fromOutputScript(treasuryScript, network);
    const ownerP2tr: string = btcAddress.fromOutputScript(ownerScript, network);
    console.log(`  Treasury P2TR: ${treasuryP2tr}`);
    console.log(`  Owner P2TR: ${ownerP2tr}`);

    // Calculate fee split
    const totalCost: bigint = mintPrice * quantity;
    const adminFee: bigint = totalCost * 10n / 100n;
    const creatorPayment: bigint = totalCost - adminFee;
    console.log(`  Total cost: ${totalCost} sats (admin: ${adminFee}, creator: ${creatorPayment})`);

    // Build outputs for fee split using hasTo flag
    const sameRecipient: boolean = treasuryP2tr === ownerP2tr;
    const reserveOutputs: { to: string; value: bigint; index: number; flags: number }[] = [];
    const extraOutputsReserve: PsbtOutputExtendedAddress[] = [];
    let outputIndex: number = 1;

    if (sameRecipient && totalCost > 0n) {
        // Single output covers both
        reserveOutputs.push({
            to: treasuryP2tr,
            value: totalCost,
            index: outputIndex++,
            flags: TransactionOutputFlags.hasTo,
        });
        extraOutputsReserve.push({ address: treasuryP2tr, value: toSatoshi(totalCost) });
    } else {
        if (adminFee > 0n) {
            reserveOutputs.push({
                to: treasuryP2tr,
                value: adminFee,
                index: outputIndex++,
                flags: TransactionOutputFlags.hasTo,
            });
            extraOutputsReserve.push({ address: treasuryP2tr, value: toSatoshi(adminFee) });
        }
        if (creatorPayment > 0n) {
            reserveOutputs.push({
                to: ownerP2tr,
                value: creatorPayment,
                index: outputIndex++,
                flags: TransactionOutputFlags.hasTo,
            });
            extraOutputsReserve.push({ address: ownerP2tr, value: toSatoshi(creatorPayment) });
        }
    }

    nft.setTransactionDetails({ inputs: [], outputs: reserveOutputs });

    const reserveSim = await nft.reserve(quantity);
    if (reserveSim.revert) {
        throw new Error(`reserve reverted: ${reserveSim.revert}`);
    }

    const reservedQty: bigint = reserveSim.properties.quantity;
    const reservationBlock: bigint = reserveSim.properties.reservationBlock;
    console.log(`  Reserved: ${reservedQty} NFTs at block ${reservationBlock}`);

    const reserveReceipt = await reserveSim.sendTransaction(
        txParams(wallet, totalCost + 50_000n, extraOutputsReserve),
    );
    console.log(`  TX: ${reserveReceipt.transactionId}`);
    await waitForBlock(provider, 'reserve');

    // Verify reservation
    const reservationResult = await nft.reservationOf(senderAddr);
    assert(reservationResult.properties.quantity === quantity, `Reservation quantity is ${quantity}`);
    assert(reservationResult.properties.active === true, 'Reservation is active');

    // Check available supply decreased
    const availResult = await nft.availableSupply();
    const available: bigint = availResult.properties.available;
    console.log(`  Available supply: ${available}`);
    assert(available === 20n - quantity, `Available supply is ${20n - quantity}`);
    console.log();

    // -----------------------------------------------------------------------
    // Step 7: Claim reserved NFTs
    // -----------------------------------------------------------------------
    console.log('--- Step 7: Claim reserved NFTs ---');

    const claimSim = await nft.claimReserved();
    if (claimSim.revert) {
        throw new Error(`claimReserved reverted: ${claimSim.revert}`);
    }

    const firstTokenId: bigint = claimSim.properties.firstTokenId;
    console.log(`  First token ID: ${firstTokenId}`);

    const claimReceipt = await claimSim.sendTransaction(txParams(wallet, 50_000n));
    console.log(`  TX: ${claimReceipt.transactionId}`);
    await waitForBlock(provider, 'claimReserved');

    // Verify reservation cleared
    const resAfterClaim = await nft.reservationOf(senderAddr);
    assert(resAfterClaim.properties.quantity === 0n, 'Reservation cleared after claim');

    // Verify tokens minted
    const totalSupplyResult = await nft.totalSupply();
    const totalSupply: bigint = totalSupplyResult.properties.totalSupply;
    console.log(`  Total supply: ${totalSupply}`);
    assert(totalSupply === quantity, `Total supply is ${quantity}`);

    // Verify available supply updated
    const availAfterClaim = await nft.availableSupply();
    const availableAfter: bigint = availAfterClaim.properties.available;
    console.log(`  Available supply: ${availableAfter}`);
    assert(availableAfter === 20n - quantity, `Available supply is ${20n - quantity}`);

    // Verify token ownership
    const ownerOfResult = await nft.ownerOf(firstTokenId);
    console.log(`  Token ${firstTokenId} owner: ${String(ownerOfResult.properties.owner)}`);
    console.log();

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    console.log('=== ALL TESTS PASSED ===\n');
    console.log(`  Collection: ${collectionAddress}`);
    console.log(`  Tokens minted: ${totalSupply}`);
    console.log(`  First token ID: ${firstTokenId}`);
    console.log();

    await provider.close();
}

main().catch((err: unknown) => {
    console.error('\n  TEST FAILED:', err);
    process.exit(1);
});
