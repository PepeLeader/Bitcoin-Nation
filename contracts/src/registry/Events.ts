import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

export class CollectionSubmittedEvent extends NetEvent {
    public constructor(submitter: Address, collectionAddress: Address) {
        const data: BytesWriter = new BytesWriter(64);
        data.writeAddress(submitter);
        data.writeAddress(collectionAddress);

        super('CollectionSubmitted', data);
    }
}

export class CollectionApprovedEvent extends NetEvent {
    public constructor(collectionAddress: Address) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeAddress(collectionAddress);

        super('SubmissionApproved', data);
    }
}

export class CollectionRejectedEvent extends NetEvent {
    public constructor(collectionAddress: Address) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeAddress(collectionAddress);

        super('SubmissionRejected', data);
    }
}

export class AdminTransferredEvent extends NetEvent {
    public constructor(previousAdmin: Address, newAdmin: Address) {
        const data: BytesWriter = new BytesWriter(64);
        data.writeAddress(previousAdmin);
        data.writeAddress(newAdmin);

        super('AdminTransferred', data);
    }
}

export class SubmissionFeeUpdatedEvent extends NetEvent {
    public constructor(newFee: u256) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeU256(newFee);

        super('SubmissionFeeUpdated', data);
    }
}
