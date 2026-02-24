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
