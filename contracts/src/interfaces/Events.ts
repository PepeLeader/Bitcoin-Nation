import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

export class CollectionCreatedEvent extends NetEvent {
    public constructor(creator: Address, collectionAddress: Address, collectionIndex: u256) {
        const data: BytesWriter = new BytesWriter(96);
        data.writeAddress(creator);
        data.writeAddress(collectionAddress);
        data.writeU256(collectionIndex);

        super('CollectionCreated', data);
    }
}

export class CollectionApprovedEvent extends NetEvent {
    public constructor(collectionAddress: Address) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeAddress(collectionAddress);

        super('CollectionApproved', data);
    }
}

export class CollectionRejectedEvent extends NetEvent {
    public constructor(collectionAddress: Address) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeAddress(collectionAddress);

        super('CollectionRejected', data);
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

export class CreationFeeUpdatedEvent extends NetEvent {
    public constructor(newFee: u256) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeU256(newFee);

        super('CreationFeeUpdated', data);
    }
}
