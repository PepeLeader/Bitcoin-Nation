import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const NFTMarketplaceEvents = [
    {
        name: 'NFTListed',
        values: [
            { name: 'seller', type: ABIDataTypes.ADDRESS },
            { name: 'collection', type: ABIDataTypes.ADDRESS },
            { name: 'tokenId', type: ABIDataTypes.UINT256 },
            { name: 'price', type: ABIDataTypes.UINT256 },
            { name: 'listingId', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'NFTDelisted',
        values: [
            { name: 'seller', type: ABIDataTypes.ADDRESS },
            { name: 'listingId', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'NFTSold',
        values: [
            { name: 'buyer', type: ABIDataTypes.ADDRESS },
            { name: 'seller', type: ABIDataTypes.ADDRESS },
            { name: 'collection', type: ABIDataTypes.ADDRESS },
            { name: 'tokenId', type: ABIDataTypes.UINT256 },
            { name: 'price', type: ABIDataTypes.UINT256 },
            { name: 'listingId', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
];

export const NFTMarketplaceAbi = [
    {
        name: 'approveCollection',
        inputs: [{ name: 'collection', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'revokeCollection',
        inputs: [{ name: 'collection', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'list',
        inputs: [
            { name: 'collection', type: ABIDataTypes.ADDRESS },
            { name: 'tokenId', type: ABIDataTypes.UINT256 },
            { name: 'price', type: ABIDataTypes.UINT256 },
            { name: 'sellerTweakedKey', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'listingId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'delist',
        inputs: [{ name: 'listingId', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'buy',
        payable: true,
        inputs: [{ name: 'listingId', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getListing',
        constant: true,
        inputs: [{ name: 'listingId', type: ABIDataTypes.UINT256 }],
        outputs: [
            { name: 'collection', type: ABIDataTypes.ADDRESS },
            { name: 'tokenId', type: ABIDataTypes.UINT256 },
            { name: 'seller', type: ABIDataTypes.ADDRESS },
            { name: 'price', type: ABIDataTypes.UINT256 },
            { name: 'sellerTweakedKey', type: ABIDataTypes.UINT256 },
            { name: 'active', type: ABIDataTypes.BOOL },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'listingCount',
        constant: true,
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isCollectionApproved',
        constant: true,
        inputs: [{ name: 'collection', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'approved', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'platformFeeNumerator',
        constant: true,
        inputs: [],
        outputs: [{ name: 'numerator', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'admin',
        constant: true,
        inputs: [],
        outputs: [{ name: 'admin', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'treasury',
        constant: true,
        inputs: [],
        outputs: [{ name: 'treasury', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'treasuryTweakedKey',
        constant: true,
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
        name: 'setTreasury',
        inputs: [
            { name: 'newTreasury', type: ABIDataTypes.ADDRESS },
            { name: 'newTreasuryTweakedKey', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setPlatformFee',
        inputs: [{ name: 'newNumerator', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    ...NFTMarketplaceEvents,
    ...OP_NET_ABI,
];

export default NFTMarketplaceAbi;
