import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI, type BitcoinInterfaceAbi } from 'opnet';

const RegistryEvents: BitcoinInterfaceAbi = [
    {
        name: 'CollectionSubmitted',
        values: [
            { name: 'submitter', type: ABIDataTypes.ADDRESS },
            { name: 'collectionAddress', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'SubmissionApproved',
        values: [
            { name: 'collectionAddress', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'SubmissionRejected',
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
        name: 'SubmissionFeeUpdated',
        values: [
            { name: 'newFee', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Event,
    },
];

export const CollectionRegistryAbi: BitcoinInterfaceAbi = [
    {
        name: 'submitCollection',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'approveSubmission',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'rejectSubmission',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionCount',
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionAtIndex',
        inputs: [{ name: 'index', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionStatus',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'status', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionSubmitter',
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'submitter', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionFee',
        inputs: [],
        outputs: [{ name: 'fee', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setSubmissionFee',
        inputs: [{ name: 'newFee', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'admin',
        inputs: [],
        outputs: [{ name: 'admin', type: ABIDataTypes.ADDRESS }],
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
    ...RegistryEvents,
    ...OP_NET_ABI,
];
