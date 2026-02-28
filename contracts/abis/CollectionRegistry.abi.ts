import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const CollectionRegistryEvents = [
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
        values: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'SubmissionRejected',
        values: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'SubmissionFeeUpdated',
        values: [{ name: 'newFee', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Event,
    },
];

export const CollectionRegistryAbi = [
    {
        name: 'submitCollection',
        payable: true,
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
        constant: true,
        inputs: [],
        outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionAtIndex',
        constant: true,
        inputs: [{ name: 'index', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionStatus',
        constant: true,
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'status', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionSubmitter',
        constant: true,
        inputs: [{ name: 'collectionAddress', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'submitter', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'submissionFee',
        constant: true,
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
        constant: true,
        inputs: [],
        outputs: [{ name: 'admin', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'adminTweakedKey',
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
    ...CollectionRegistryEvents,
    ...OP_NET_ABI,
];

export default CollectionRegistryAbi;
