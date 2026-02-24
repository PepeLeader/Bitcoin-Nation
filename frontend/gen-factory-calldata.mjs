import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';

/**
 * Generates factory deployment calldata from a template's P2OP address.
 *
 * OPNet contract addresses are 32-byte tweakedPubkey values internally.
 * P2OP addresses (opr1s...) only encode HASH160(tweakedPubkey) — 20 bytes,
 * which is irreversible. So we MUST use getPublicKeyInfo() RPC to get the
 * full 32-byte tweakedPubkey for use as calldata.
 */

const TEMPLATE_P2OP = 'opr1sqq9zqlds0tl0rwtcxpue4h6k0q5r297f3592d6yd';

const provider = new JSONRpcProvider({
    url: 'https://regtest.opnet.org',
    network: networks.regtest,
});

const info = await provider.getPublicKeyInfo(TEMPLATE_P2OP, true);
const tweakedPubkey = info.tweakedPubkey ?? info.originalPubKey;

if (!tweakedPubkey) {
    console.error('ERROR: Could not get tweakedPubkey for', TEMPLATE_P2OP);
    console.error('Response:', JSON.stringify(info, null, 2));
    process.exit(1);
}

// Ensure it's a clean 32-byte hex string
const hex = tweakedPubkey.replace(/^0x/, '');
if (hex.length !== 64) {
    console.error('ERROR: tweakedPubkey is not 32 bytes. Got', hex.length / 2, 'bytes:', hex);
    process.exit(1);
}

console.log('Template P2OP:', TEMPLATE_P2OP);
console.log('tweakedPubkey:', hex);
console.log('');
console.log('=== Factory deployment calldata (0x hex) ===');
console.log('0x' + hex);
console.log('');
console.log('=== BASE64 ===');
console.log(Buffer.from(hex, 'hex').toString('base64'));
