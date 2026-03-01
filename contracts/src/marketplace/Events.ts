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

export class ReservationCreatedEvent extends NetEvent {
    public constructor(buyer: Address, listingId: u256, reservationId: u256, expiryBlock: u256) {
        const data: BytesWriter = new BytesWriter(128);
        data.writeAddress(buyer);
        data.writeU256(listingId);
        data.writeU256(reservationId);
        data.writeU256(expiryBlock);

        super('ReservationCreated', data);
    }
}

export class ReservationFulfilledEvent extends NetEvent {
    public constructor(
        buyer: Address,
        seller: Address,
        collection: Address,
        tokenId: u256,
        price: u256,
        reservationId: u256,
    ) {
        const data: BytesWriter = new BytesWriter(192);
        data.writeAddress(buyer);
        data.writeAddress(seller);
        data.writeAddress(collection);
        data.writeU256(tokenId);
        data.writeU256(price);
        data.writeU256(reservationId);

        super('ReservationFulfilled', data);
    }
}

export class ReservationCancelledEvent extends NetEvent {
    public constructor(buyer: Address, listingId: u256, reservationId: u256) {
        const data: BytesWriter = new BytesWriter(96);
        data.writeAddress(buyer);
        data.writeU256(listingId);
        data.writeU256(reservationId);

        super('ReservationCancelled', data);
    }
}

export class ReservationExpiredEvent extends NetEvent {
    public constructor(buyer: Address, listingId: u256, reservationId: u256, blacklistUntil: u256) {
        const data: BytesWriter = new BytesWriter(128);
        data.writeAddress(buyer);
        data.writeU256(listingId);
        data.writeU256(reservationId);
        data.writeU256(blacklistUntil);

        super('ReservationExpired', data);
    }
}
