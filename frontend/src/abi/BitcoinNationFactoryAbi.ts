import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI, type BitcoinInterfaceAbi } from 'opnet';

const FactoryEvents: BitcoinInterfaceAbi = [
    {
        name: 'CollectionCreated',
        values: [
            { name: 'creator', type: ABIDataTypes.ADDRESS },
            { name: 'collectionAddress', type: ABIDataTypes.ADDRESS },
            { name: 'collectionIndex', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'CollectionApproved',
        values: [
            { name: 'collectionAddress', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'CollectionRejected',
        values: [
            { name: 'collectionAddress', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'AdminTransferred',
        values: [
            { name: 'previousAdmin', type: ABIDataTypes.ADDRESS },
            { name: 'newAdmin', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'CreationFeeUpdated',
        values: [
            { name: 'newFee', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
];

export const BitcoinNationFactoryAbi: BitcoinInterfaceAbi = [
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
            { name: 'ownerTweakedKey', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
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
    {
        name: 'applyForMint',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'approveCollection',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'rejectCollection',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'approvalStatus',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'status', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'collectionCreator',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'creator', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'admin',
        inputs: [],
        outputs: [{ name: 'admin', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'creationFee',
        inputs: [],
        outputs: [{ name: 'fee', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'adminTweakedKey',
        inputs: [],
        outputs: [{ name: 'tweakedKey', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'transferAdmin',
        inputs: [
            { name: 'newAdmin', type: ABIDataTypes.ADDRESS },
            { name: 'newAdminTweakedKey', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setCreationFee',
        inputs: [{ name: 'newFee', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    ...FactoryEvents,
    ...OP_NET_ABI,
];
