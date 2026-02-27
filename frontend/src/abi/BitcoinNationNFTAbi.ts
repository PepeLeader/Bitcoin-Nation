import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI, type BitcoinInterfaceAbi } from 'opnet';
import { OP721Abi, OP721Events } from './OP721Abi';

const BitcoinNationNFTCustom: BitcoinInterfaceAbi = [
    {
        name: 'ownerMint',
        inputs: [{ name: 'to', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'tokenId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'mint',
        inputs: [{ name: 'quantity', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'firstTokenId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'mintWithURI',
        inputs: [
            { name: 'to', type: ABIDataTypes.ADDRESS },
            { name: 'uri', type: ABIDataTypes.STRING },
        ],
        outputs: [{ name: 'tokenId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setMintingOpen',
        inputs: [{ name: 'open', type: ABIDataTypes.BOOL }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'mintPrice',
        inputs: [],
        outputs: [{ name: 'price', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'maxPerWallet',
        inputs: [],
        outputs: [{ name: 'maxPerWallet', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isMintingOpen',
        inputs: [],
        outputs: [{ name: 'isOpen', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'owner',
        inputs: [],
        outputs: [{ name: 'owner', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'mintedBy',
        inputs: [{ name: 'account', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'availableSupply',
        inputs: [],
        outputs: [{ name: 'available', type: ABIDataTypes.UINT256 }],
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
    {
        name: 'ownerTweakedKey',
        inputs: [],
        outputs: [{ name: 'tweakedKey', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'transferOwnership',
        inputs: [
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
            { name: 'newOwnerTweakedKey', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setMintPrice',
        inputs: [{ name: 'newPrice', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setPlatformFeePercent',
        inputs: [{ name: 'newPercent', type: ABIDataTypes.UINT256 }],
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
];

export const BitcoinNationNFTAbi = [
    ...OP721Abi,
    ...BitcoinNationNFTCustom,
    ...OP721Events,
    ...OP_NET_ABI,
] as BitcoinInterfaceAbi;
