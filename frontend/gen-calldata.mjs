import { BinaryWriter } from '@btc-vision/transaction';

const writer = new BinaryWriter();
writer.writeStringWithLength('Template');           // name
writer.writeStringWithLength('TMPL');               // symbol
writer.writeStringWithLength('ipfs://template/');   // baseURI
writer.writeU256(1n);                               // maxSupply
writer.writeU256(0n);                               // mintPrice
writer.writeU256(1n);                               // maxPerWallet
writer.writeStringWithLength('');                    // collectionBanner
writer.writeStringWithLength('');                    // collectionIcon
writer.writeStringWithLength('');                    // collectionWebsite
writer.writeStringWithLength('Template contract');   // collectionDescription

const buf = Buffer.from(writer.getBuffer());
const hex = buf.toString('hex');
const base64 = buf.toString('base64');

console.log('=== HEX (no prefix) ===');
console.log(hex);
console.log('');
console.log('=== HEX (0x prefix) ===');
console.log('0x' + hex);
console.log('');
console.log('=== BASE64 ===');
console.log(base64);
console.log('');
console.log('Length:', buf.length, 'bytes');
