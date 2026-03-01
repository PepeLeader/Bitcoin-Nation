import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI, type BitcoinInterfaceAbi } from 'opnet';

const MarketplaceEvents: BitcoinInterfaceAbi = [
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
    {
        name: 'NFTDelisted',
        values: [
            { name: 'seller', type: ABIDataTypes.ADDRESS },
            { name: 'listingId', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'MarketplaceCollectionApproved',
        values: [
            { name: 'collection', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'MarketplaceCollectionRevoked',
        values: [
            { name: 'collection', type: ABIDataTypes.ADDRESS },
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
        name: 'ReservationCreated',
        values: [
            { name: 'buyer', type: ABIDataTypes.ADDRESS },
            { name: 'listingId', type: ABIDataTypes.UINT256 },
            { name: 'reservationId', type: ABIDataTypes.UINT256 },
            { name: 'expiryBlock', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'ReservationFulfilled',
        values: [
            { name: 'buyer', type: ABIDataTypes.ADDRESS },
            { name: 'seller', type: ABIDataTypes.ADDRESS },
            { name: 'collection', type: ABIDataTypes.ADDRESS },
            { name: 'tokenId', type: ABIDataTypes.UINT256 },
            { name: 'price', type: ABIDataTypes.UINT256 },
            { name: 'reservationId', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'ReservationCancelled',
        values: [
            { name: 'buyer', type: ABIDataTypes.ADDRESS },
            { name: 'listingId', type: ABIDataTypes.UINT256 },
            { name: 'reservationId', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'ReservationExpired',
        values: [
            { name: 'buyer', type: ABIDataTypes.ADDRESS },
            { name: 'listingId', type: ABIDataTypes.UINT256 },
            { name: 'reservationId', type: ABIDataTypes.UINT256 },
            { name: 'blacklistUntil', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
];

export const NFTMarketplaceAbi: BitcoinInterfaceAbi = [
    // Collection approval
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
    // Listing management
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
        inputs: [{ name: 'listingId', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    // Reservation methods
    {
        name: 'reserve',
        inputs: [
            { name: 'listingId', type: ABIDataTypes.UINT256 },
            { name: 'buyerTweakedKey', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'reservationId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'fulfillReservation',
        inputs: [{ name: 'reservationId', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'cancelReservation',
        inputs: [{ name: 'reservationId', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'expireReservation',
        inputs: [{ name: 'reservationId', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    // View methods
    {
        name: 'getListing',
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
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isCollectionApproved',
        inputs: [{ name: 'collection', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'approved', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getReservation',
        inputs: [{ name: 'reservationId', type: ABIDataTypes.UINT256 }],
        outputs: [
            { name: 'listingId', type: ABIDataTypes.UINT256 },
            { name: 'buyer', type: ABIDataTypes.ADDRESS },
            { name: 'expiryBlock', type: ABIDataTypes.UINT256 },
            { name: 'active', type: ABIDataTypes.BOOL },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'reservationCount',
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isBlacklisted',
        inputs: [{ name: 'account', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'blacklisted', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getBlacklistExpiry',
        inputs: [{ name: 'account', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'blockNumber', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'platformFeeNumerator',
        inputs: [],
        outputs: [{ name: 'numerator', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'admin',
        inputs: [],
        outputs: [{ name: 'admin', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'treasury',
        inputs: [],
        outputs: [{ name: 'treasury', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'treasuryTweakedKey',
        inputs: [],
        outputs: [{ name: 'tweakedKey', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    // Admin methods
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
    ...MarketplaceEvents,
    ...OP_NET_ABI,
];
