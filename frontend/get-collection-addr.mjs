import { JSONRpcProvider, getContract, ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';
import { networks } from '@btc-vision/bitcoin';

const abi = [
    {
        name: 'collectionAtIndex',
        inputs: [{ name: 'index', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];

const provider = new JSONRpcProvider({
    url: 'https://regtest.opnet.org',
    network: networks.regtest,
});

const FACTORY = 'opr1sqq7wdma4c0a3nxeqf43zrza8ygk0wgszey25p8un';
const factory = getContract(FACTORY, abi, provider, networks.regtest);

const result = await factory.collectionAtIndex(0n);
if (result.revert) {
    console.log('REVERT:', result.revert);
} else {
    const addr = result.properties.collectionAddress;
    // Convert to hex string
    const hex = Buffer.from(addr).toString('hex');
    console.log('Collection address (hex):', '0x' + hex);
    console.log('Collection address (raw):', addr);
}
