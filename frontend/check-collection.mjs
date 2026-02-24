import { JSONRpcProvider, getContract, ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';
import { networks } from '@btc-vision/bitcoin';

const abi = [
    {
        name: 'metadata',
        inputs: [],
        outputs: [
            { name: 'name', type: ABIDataTypes.STRING },
            { name: 'symbol', type: ABIDataTypes.STRING },
            { name: 'icon', type: ABIDataTypes.STRING },
            { name: 'banner', type: ABIDataTypes.STRING },
            { name: 'description', type: ABIDataTypes.STRING },
            { name: 'website', type: ABIDataTypes.STRING },
            { name: 'totalSupply', type: ABIDataTypes.UINT256 },
            { name: 'domainSeparator', type: ABIDataTypes.BYTES32 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'collectionInfo',
        inputs: [],
        outputs: [
            { name: 'icon', type: ABIDataTypes.STRING },
            { name: 'banner', type: ABIDataTypes.STRING },
            { name: 'description', type: ABIDataTypes.STRING },
            { name: 'website', type: ABIDataTypes.STRING },
        ],
        type: BitcoinAbiTypes.Function,
    },
    ...OP_NET_ABI,
];

const provider = new JSONRpcProvider({
    url: 'https://regtest.opnet.org',
    network: networks.regtest,
});

// The collection address from the URL: 0xc57e2ee74dfdc20df241ff...
// Let's get it from the factory
const COLLECTION_ADDRESS = process.argv[2];

if (!COLLECTION_ADDRESS) {
    console.log('Usage: node check-collection.mjs <collection-address>');
    console.log('  address can be opr1... or 0x...');
    process.exit(1);
}

try {
    const contract = getContract(COLLECTION_ADDRESS, abi, provider, networks.regtest);

    console.log('--- metadata() ---');
    const meta = await contract.metadata();
    if (meta.revert) {
        console.log('REVERT:', meta.revert);
    } else {
        console.log('name:', JSON.stringify(meta.properties.name));
        console.log('symbol:', JSON.stringify(meta.properties.symbol));
        console.log('icon:', JSON.stringify(meta.properties.icon));
        console.log('banner:', JSON.stringify(meta.properties.banner));
        console.log('description:', JSON.stringify(meta.properties.description));
        console.log('website:', JSON.stringify(meta.properties.website));
        console.log('totalSupply:', meta.properties.totalSupply?.toString());
    }

    console.log('');
    console.log('--- collectionInfo() ---');
    const info = await contract.collectionInfo();
    if (info.revert) {
        console.log('REVERT:', info.revert);
    } else {
        console.log('icon:', JSON.stringify(info.properties.icon));
        console.log('banner:', JSON.stringify(info.properties.banner));
        console.log('description:', JSON.stringify(info.properties.description));
        console.log('website:', JSON.stringify(info.properties.website));
    }
} catch (e) {
    console.log('Error:', e.message);
}
