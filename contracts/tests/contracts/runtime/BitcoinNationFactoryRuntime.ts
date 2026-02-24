import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '@btc-vision/unit-test-framework';

interface CollectionParams {
    readonly name: string;
    readonly symbol: string;
    readonly baseURI: string;
    readonly maxSupply: bigint;
    readonly mintPrice: bigint;
    readonly maxPerWallet: bigint;
    readonly collectionBanner: string;
    readonly collectionIcon: string;
    readonly collectionWebsite: string;
    readonly collectionDescription: string;
}

export class BitcoinNationFactoryRuntime extends ContractRuntime {
    private readonly createCollectionSelector: number = this.getSelector(
        'createCollection(string,string,string,uint256,uint256,uint256,string,string,string,string)',
    );
    private readonly collectionCountSelector: number = this.getSelector('collectionCount()');
    private readonly collectionAtIndexSelector: number = this.getSelector(
        'collectionAtIndex(uint256)',
    );
    private readonly applyForMintSelector: number = this.getSelector('applyForMint(address)');
    private readonly approveCollectionSelector: number = this.getSelector(
        'approveCollection(address)',
    );
    private readonly rejectCollectionSelector: number = this.getSelector(
        'rejectCollection(address)',
    );
    private readonly approvalStatusSelector: number = this.getSelector('approvalStatus(address)');
    private readonly collectionCreatorSelector: number = this.getSelector(
        'collectionCreator(address)',
    );
    private readonly adminSelector: number = this.getSelector('admin()');

    public constructor(
        deployer: Address,
        address: Address,
        templateAddress: Address,
        gasLimit: bigint = 150_000_000_000n,
    ) {
        const deploymentCalldata: Buffer =
            BitcoinNationFactoryRuntime.encodeDeployment(templateAddress);

        super({
            address,
            deployer,
            gasLimit,
            deploymentCalldata,
        });
    }

    public async createCollection(params: CollectionParams): Promise<Address> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.createCollectionSelector);
        calldata.writeStringWithLength(params.name);
        calldata.writeStringWithLength(params.symbol);
        calldata.writeStringWithLength(params.baseURI);
        calldata.writeU256(params.maxSupply);
        calldata.writeU256(params.mintPrice);
        calldata.writeU256(params.maxPerWallet);
        calldata.writeStringWithLength(params.collectionBanner);
        calldata.writeStringWithLength(params.collectionIcon);
        calldata.writeStringWithLength(params.collectionWebsite);
        calldata.writeStringWithLength(params.collectionDescription);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readAddress();
    }

    public async collectionCount(): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.collectionCountSelector);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    public async collectionAtIndex(index: bigint): Promise<Address> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.collectionAtIndexSelector);
        calldata.writeU256(index);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readAddress();
    }

    public async applyForMint(collectionAddress: Address): Promise<boolean> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.applyForMintSelector);
        calldata.writeAddress(collectionAddress);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readBoolean();
    }

    public async approveCollection(collectionAddress: Address): Promise<boolean> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.approveCollectionSelector);
        calldata.writeAddress(collectionAddress);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readBoolean();
    }

    public async rejectCollection(collectionAddress: Address): Promise<boolean> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.rejectCollectionSelector);
        calldata.writeAddress(collectionAddress);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readBoolean();
    }

    public async approvalStatus(collectionAddress: Address): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.approvalStatusSelector);
        calldata.writeAddress(collectionAddress);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    public async collectionCreator(collectionAddress: Address): Promise<Address> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.collectionCreatorSelector);
        calldata.writeAddress(collectionAddress);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readAddress();
    }

    public async admin(): Promise<Address> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.adminSelector);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readAddress();
    }

    protected override handleError(error: Error): Error {
        return new Error(`(BitcoinNationFactory: ${this.address}) OP_NET: ${error.message}`);
    }

    protected override defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode('../build/BitcoinNationFactory.wasm', this.address);
    }

    private static encodeDeployment(templateAddress: Address): Buffer {
        const writer: BinaryWriter = new BinaryWriter();
        writer.writeAddress(templateAddress);
        return Buffer.from(writer.getBuffer());
    }

    private getSelector(signature: string): number {
        return Number(`0x${this.abiCoder.encodeSelector(signature)}`);
    }

    private handleResponse(response: CallResponse): void {
        if (response.error) throw this.handleError(response.error);
        if (!response.response) throw new Error('No response to decode');
    }
}
