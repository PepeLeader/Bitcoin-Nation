import { JSONRpcProvider, getContract, ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';
import { networks } from '@btc-vision/bitcoin';

const abi = [
    {
        name: 'collectionCount',
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'createCollection',
        inputs: [
            { name: 'name', type: ABIDataTypes.STRING },
            { name: 'symbol', type: ABIDataTypes.STRING },
            { name: 'baseURI', type: ABIDataTypes.STRING },
            { name: 'maxSupply', type: ABIDataTypes.UINT256 },
            { name: 'mintPrice', type: ABIDataTypes.UINT256 },
            { name: 'maxPerWallet', type: ABIDataTypes.UINT256 },
            { name: 'collectionBanner', type: ABIDataTypes.STRING },
            { name: 'collectionIcon', type: ABIDataTypes.STRING },
            { name: 'collectionWebsite', type: ABIDataTypes.STRING },
            { name: 'collectionDescription', type: ABIDataTypes.STRING },
        ],
        outputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];

const provider = new JSONRpcProvider({
    url: 'https://regtest.opnet.org',
    network: networks.regtest,
});

const NEW_FACTORY = 'opr1sqq7wdma4c0a3nxeqf43zrza8ygk0wgszey25p8un';
const TEMPLATE = 'opr1sqq9zqlds0tl0rwtcxpue4h6k0q5r297f3592d6yd';

// 1. Check factory has code
try {
    const code = await provider.getCode(NEW_FACTORY);
    console.log('Factory has code:', Boolean(code));
} catch (e) {
    console.log('Factory getCode error:', e.message);
}

// 2. Check template has code
try {
    const code = await provider.getCode(TEMPLATE);
    console.log('Template has code:', Boolean(code));
} catch (e) {
    console.log('Template getCode error:', e.message);
}

// 3. Check collectionCount
try {
    const factory = getContract(NEW_FACTORY, abi, provider, networks.regtest);
    const result = await factory.collectionCount();
    if (result.revert) {
        console.log('collectionCount REVERT:', result.revert);
    } else {
        console.log('Collection count:', result.properties.count.toString());
    }
} catch (e) {
    console.log('collectionCount error:', e.message);
}

// 4. Try simulate createCollection
try {
    const factory = getContract(NEW_FACTORY, abi, provider, networks.regtest);
    const result = await factory.createCollection(
        'Test',
        'TST',
        'ipfs://test/',
        1000n,
        0n,
        5n,
        '',
        '',
        '',
        'test',
    );
    if (result.revert) {
        console.log('createCollection REVERT:', result.revert);
    } else {
        console.log('createCollection OK, address:', result.properties.collectionAddress);
    }
} catch (e) {
    console.log('createCollection error:', e.message);
}
