import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

export class NFTListedEvent extends NetEvent {
    public constructor(
        seller: Address,
        collection: Address,
        tokenId: u256,
        price: u256,
        listingId: u256,
    ) {
        const data: BytesWriter = new BytesWriter(160);
        data.writeAddress(seller);
        data.writeAddress(collection);
        data.writeU256(tokenId);
        data.writeU256(price);
        data.writeU256(listingId);

        super('NFTListed', data);
    }
}

export class NFTSoldEvent extends NetEvent {
    public constructor(
        buyer: Address,
        seller: Address,
        collection: Address,
        tokenId: u256,
        price: u256,
        listingId: u256,
    ) {
        const data: BytesWriter = new BytesWriter(192);
        data.writeAddress(buyer);
        data.writeAddress(seller);
        data.writeAddress(collection);
        data.writeU256(tokenId);
        data.writeU256(price);
        data.writeU256(listingId);

        super('NFTSold', data);
    }
}

export class NFTDelistedEvent extends NetEvent {
    public constructor(seller: Address, listingId: u256) {
        const data: BytesWriter = new BytesWriter(64);
        data.writeAddress(seller);
        data.writeU256(listingId);

        super('NFTDelisted', data);
    }
}

export class MarketplaceCollectionApprovedEvent extends NetEvent {
    public constructor(collection: Address) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeAddress(collection);

        super('MarketplaceCollectionApproved', data);
    }
}

export class MarketplaceCollectionRevokedEvent extends NetEvent {
    public constructor(collection: Address) {
        const data: BytesWriter = new BytesWriter(32);
        data.writeAddress(collection);

        super('MarketplaceCollectionRevoked', data);
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
