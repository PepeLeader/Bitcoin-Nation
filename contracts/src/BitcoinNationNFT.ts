import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    AddressMemoryMap,
    Blockchain,
    BytesWriter,
    Calldata,
    EMPTY_POINTER,
    Network,
    Networks,
    OP721,
    OP721InitParameters,
    Revert,
    SafeMath,
    Segwit,
    StoredAddress,
    StoredBoolean,
    StoredU256,
} from '@btc-vision/btc-runtime/runtime';

const MAX_MINT_PER_TX: u256 = u256.fromU64(10);

@final
export class BitcoinNationNFT extends OP721 {
    private readonly mintPricePointer: u16 = Blockchain.nextPointer;
    private readonly mintingOpenPointer: u16 = Blockchain.nextPointer;
    private readonly maxPerWalletPointer: u16 = Blockchain.nextPointer;
    private readonly mintsPerAddressPointer: u16 = Blockchain.nextPointer;
    private readonly ownerPointer: u16 = Blockchain.nextPointer;
    private readonly treasuryPointer: u16 = Blockchain.nextPointer;
    private readonly platformFeePercentPointer: u16 = Blockchain.nextPointer;
    private readonly treasuryTweakedKeyPointer: u16 = Blockchain.nextPointer;
    private readonly ownerTweakedKeyPointer: u16 = Blockchain.nextPointer;

    private readonly _mintPrice: StoredU256 = new StoredU256(this.mintPricePointer, EMPTY_POINTER);
    private readonly _mintingOpen: StoredBoolean = new StoredBoolean(this.mintingOpenPointer, false);
    private readonly _maxPerWallet: StoredU256 = new StoredU256(
        this.maxPerWalletPointer,
        EMPTY_POINTER,
    );
    private readonly _mintsPerAddress: AddressMemoryMap = new AddressMemoryMap(
        this.mintsPerAddressPointer,
    );
    private readonly _owner: StoredAddress = new StoredAddress(this.ownerPointer);
    private readonly _treasury: StoredAddress = new StoredAddress(this.treasuryPointer);
    private readonly _platformFeePercent: StoredU256 = new StoredU256(
        this.platformFeePercentPointer,
        EMPTY_POINTER,
    );
    private readonly _treasuryTweakedKey: StoredU256 = new StoredU256(
        this.treasuryTweakedKeyPointer,
        EMPTY_POINTER,
    );
    private readonly _ownerTweakedKey: StoredU256 = new StoredU256(
        this.ownerTweakedKeyPointer,
        EMPTY_POINTER,
    );

    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const name: string = calldata.readStringWithLength();
        const symbol: string = calldata.readStringWithLength();
        const baseURI: string = calldata.readStringWithLength();
        const maxSupply: u256 = calldata.readU256();
        const mintPrice: u256 = calldata.readU256();
        const maxPerWallet: u256 = calldata.readU256();
        const collectionBanner: string = calldata.readStringWithLength();
        const collectionIcon: string = calldata.readStringWithLength();
        const collectionWebsite: string = calldata.readStringWithLength();
        const collectionDescription: string = calldata.readStringWithLength();
        const treasury: Address = calldata.readAddress();
        const treasuryTweakedKey: u256 = calldata.readU256();

        this.instantiate(
            new OP721InitParameters(
                name,
                symbol,
                baseURI,
                maxSupply,
                collectionBanner,
                collectionIcon,
                collectionWebsite,
                collectionDescription,
            ),
        );

        this._mintPrice.value = mintPrice;
        this._maxPerWallet.value = maxPerWallet;
        this._owner.value = Blockchain.tx.origin;
        this._treasury.value = treasury;
        this._platformFeePercent.value = u256.fromU64(10);

        // Store tweaked public keys for output payment verification
        this._treasuryTweakedKey.value = treasuryTweakedKey;
        this._ownerTweakedKey.value = u256.fromUint8ArrayBE(
            Blockchain.tx.origin.tweakedPublicKey,
        );
    }

    private onlyOwner(): void {
        if (!Blockchain.tx.sender.equals(this._owner.value)) {
            throw new Revert('Only owner can call this method');
        }
    }

    /**
     * Owner mints a single NFT to a specific address.
     */
    @method({ name: 'to', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @emit('Transferred')
    public ownerMint(calldata: Calldata): BytesWriter {
        this.onlyOwner();

        const to: Address = calldata.readAddress();
        const tokenId: u256 = this._nextTokenId.value;

        this._ensureSupplyAvailable(u256.One);
        this._mint(to, tokenId);
        this._nextTokenId.value = SafeMath.add(tokenId, u256.One);

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(tokenId);
        return writer;
    }

    /**
     * Mint NFTs with payment in a single transaction.
     * Payment is split: 90% to creator, 10% to treasury (admin).
     */
    @method({ name: 'quantity', type: ABIDataTypes.UINT256 })
    @returns({ name: 'firstTokenId', type: ABIDataTypes.UINT256 })
    @emit('Transferred')
    public mint(calldata: Calldata): BytesWriter {
        const quantity: u256 = calldata.readU256();
        const sender: Address = Blockchain.tx.sender;

        if (!this._mintingOpen.value) {
            throw new Revert('Minting is not open');
        }

        if (quantity == u256.Zero) {
            throw new Revert('Quantity must be greater than zero');
        }

        if (quantity > MAX_MINT_PER_TX) {
            throw new Revert('Exceeds max mint per transaction');
        }

        this._ensureSupplyAvailable(quantity);
        this._ensureWalletLimit(sender, quantity);

        // Verify payment outputs
        const mintPrice: u256 = this._mintPrice.value;
        const totalCost: u256 = SafeMath.mul(mintPrice, quantity);
        const feePercent: u256 = this._platformFeePercent.value;
        const adminFee: u256 = SafeMath.div(SafeMath.mul(totalCost, feePercent), u256.fromU64(100));
        const creatorPayment: u256 = SafeMath.sub(totalCost, adminFee);

        if (totalCost > u256.Zero) {
            const treasuryTweakedBytes: Uint8Array = this._treasuryTweakedKey.value.toUint8Array(true);
            const ownerTweakedBytes: Uint8Array = this._ownerTweakedKey.value.toUint8Array(true);
            const hrp: string = this._correctHrp();
            const treasuryP2tr: string = Segwit.p2tr(hrp, treasuryTweakedBytes);
            const ownerP2tr: string = Segwit.p2tr(hrp, ownerTweakedBytes);

            let foundAdmin: bool = false;
            let foundCreator: bool = false;

            // If treasury and owner share the same address, a single output satisfies both
            const sameRecipient: bool = treasuryP2tr == ownerP2tr;

            const outputs = Blockchain.tx.outputs;
            for (let i: i32 = 0; i < outputs.length; i++) {
                const output = outputs[i];
                const outputVal: u256 = u256.fromU64(output.value);

                // Dual-check: simulation provides output.to, on-chain provides scriptPublicKey
                const to: string | null = output.to;
                const script: Uint8Array | null = output.scriptPublicKey;

                // Check admin/treasury output
                if (!foundAdmin && adminFee > u256.Zero) {
                    const matchesTreasury: bool =
                        (to !== null && to == treasuryP2tr) ||
                        (script !== null && this._matchesP2TR(script, treasuryTweakedBytes));

                    if (matchesTreasury) {
                        if (sameRecipient) {
                            if (outputVal >= totalCost) {
                                foundAdmin = true;
                                foundCreator = true;
                            }
                        } else if (outputVal >= adminFee) {
                            foundAdmin = true;
                        }
                    }
                }

                // Check creator/owner output
                if (!foundCreator && creatorPayment > u256.Zero) {
                    const matchesOwner: bool =
                        (to !== null && to == ownerP2tr) ||
                        (script !== null && this._matchesP2TR(script, ownerTweakedBytes));

                    if (matchesOwner && outputVal >= creatorPayment) {
                        foundCreator = true;
                    }
                }
            }

            if (adminFee > u256.Zero && !foundAdmin) {
                throw new Revert('Platform fee not paid');
            }

            if (creatorPayment > u256.Zero && !foundCreator) {
                throw new Revert('Creator payment not included');
            }
        }

        // Mint tokens
        const firstTokenId: u256 = this._nextTokenId.value;
        let currentId: u256 = firstTokenId;

        for (let i: u256 = u256.Zero; i < quantity; i = SafeMath.add(i, u256.One)) {
            this._mint(sender, currentId);
            currentId = SafeMath.add(currentId, u256.One);
        }

        this._nextTokenId.value = currentId;

        // Update mints per address
        const currentMints: u256 = this._mintsPerAddress.get(sender);
        this._mintsPerAddress.set(sender, SafeMath.add(currentMints, quantity));

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(firstTokenId);
        return writer;
    }

    /**
     * Owner mints a single NFT with a custom metadata URI (for 1/1 NFTs).
     */
    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'uri', type: ABIDataTypes.STRING },
    )
    @returns({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @emit('Transferred')
    public mintWithURI(calldata: Calldata): BytesWriter {
        this.onlyOwner();

        const to: Address = calldata.readAddress();
        const uri: string = calldata.readStringWithLength();
        const tokenId: u256 = this._nextTokenId.value;

        this._ensureSupplyAvailable(u256.One);
        this._mint(to, tokenId);
        this._setTokenURI(tokenId, uri);
        this._nextTokenId.value = SafeMath.add(tokenId, u256.One);

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(tokenId);
        return writer;
    }

    /**
     * Toggle public minting on or off. Deployer only.
     */
    @method({ name: 'open', type: ABIDataTypes.BOOL })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setMintingOpen(calldata: Calldata): BytesWriter {
        this.onlyOwner();

        const open: bool = calldata.readBoolean();
        this._mintingOpen.value = open;

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * Returns the mint price in satoshis.
     */
    @view
    @method()
    @returns({ name: 'price', type: ABIDataTypes.UINT256 })
    public mintPrice(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._mintPrice.value);
        return writer;
    }

    /**
     * Returns the maximum number of tokens a single wallet can mint.
     */
    @view
    @method()
    @returns({ name: 'maxPerWallet', type: ABIDataTypes.UINT256 })
    public maxPerWallet(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._maxPerWallet.value);
        return writer;
    }

    /**
     * Returns whether public minting is open.
     */
    @view
    @method()
    @returns({ name: 'isOpen', type: ABIDataTypes.BOOL })
    public isMintingOpen(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(this._mintingOpen.value);
        return writer;
    }

    /**
     * Returns the owner (creator) of this collection.
     */
    @view
    @method()
    @returns({ name: 'owner', type: ABIDataTypes.ADDRESS })
    public owner(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(this._owner.value);
        return writer;
    }

    /**
     * Returns how many tokens an address has minted.
     */
    @view
    @method({ name: 'account', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public mintedBy(calldata: Calldata): BytesWriter {
        const account: Address = calldata.readAddress();
        const count: u256 = this._mintsPerAddress.get(account);

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(count);
        return writer;
    }

    /**
     * Returns available supply.
     * Returns 0 if unlimited (maxSupply == 0).
     */
    @view
    @method()
    @returns({ name: 'available', type: ABIDataTypes.UINT256 })
    public availableSupply(_calldata: Calldata): BytesWriter {
        const maxSup: u256 = this.maxSupply;
        const writer: BytesWriter = new BytesWriter(32);

        if (maxSup == u256.Zero) {
            writer.writeU256(u256.Zero);
        } else {
            if (this.totalSupply >= maxSup) {
                writer.writeU256(u256.Zero);
            } else {
                writer.writeU256(SafeMath.sub(maxSup, this.totalSupply));
            }
        }

        return writer;
    }

    /**
     * Returns the treasury (admin) address.
     */
    @view
    @method()
    @returns({ name: 'treasury', type: ABIDataTypes.ADDRESS })
    public treasury(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeAddress(this._treasury.value);
        return writer;
    }

    /**
     * Returns the treasury's tweaked public key for P2TR output construction.
     */
    @view
    @method()
    @returns({ name: 'tweakedKey', type: ABIDataTypes.UINT256 })
    public treasuryTweakedKey(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._treasuryTweakedKey.value);
        return writer;
    }

    /**
     * Returns the owner's tweaked public key for P2TR output construction.
     */
    @view
    @method()
    @returns({ name: 'tweakedKey', type: ABIDataTypes.UINT256 })
    public ownerTweakedKey(_calldata: Calldata): BytesWriter {
        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(this._ownerTweakedKey.value);
        return writer;
    }

    /**
     * Ensures enough supply remains for the requested quantity.
     */
    private _ensureSupplyAvailable(quantity: u256): void {
        const maxSup: u256 = this.maxSupply;

        if (maxSup > u256.Zero) {
            const afterMint: u256 = SafeMath.add(this.totalSupply, quantity);
            if (afterMint > maxSup) {
                throw new Revert('Exceeds max supply');
            }
        }
    }

    /**
     * Ensures the sender hasn't exceeded their per-wallet mint limit.
     */
    private _ensureWalletLimit(sender: Address, quantity: u256): void {
        const limit: u256 = this._maxPerWallet.value;

        if (limit > u256.Zero) {
            const alreadyMinted: u256 = this._mintsPerAddress.get(sender);
            const afterMint: u256 = SafeMath.add(alreadyMinted, quantity);
            if (afterMint > limit) {
                throw new Revert('Exceeds per-wallet mint limit');
            }
        }
    }

    /**
     * Returns the correct bech32 HRP for the current network.
     * Workaround for btc-runtime bug: Network.hrp() returns 'opt1' for OPNet
     * testnet but the correct HRP is 'opt' (the '1' is the bech32 separator).
     */
    private _correctHrp(): string {
        const n: Networks = Blockchain.network;
        if (n === Networks.Mainnet) return 'bc';
        if (n === Networks.Testnet) return 'tb';
        if (n === Networks.Regtest) return 'bcrt';
        if (n === Networks.OpnetTestnet) return 'opt';
        return Network.hrp(n);
    }

    /**
     * Checks if a P2TR scriptPublicKey matches a 32-byte tweaked public key.
     * P2TR script format: OP_1 (0x51) PUSH32 (0x20) <32-byte-tweaked-key>
     */
    private _matchesP2TR(script: Uint8Array, tweakedKey: Uint8Array): bool {
        if (script.length != 34 || script[0] != 0x51 || script[1] != 0x20) {
            return false;
        }
        for (let i: i32 = 0; i < 32; i++) {
            if (script[i + 2] != tweakedKey[i]) return false;
        }
        return true;
    }
}
