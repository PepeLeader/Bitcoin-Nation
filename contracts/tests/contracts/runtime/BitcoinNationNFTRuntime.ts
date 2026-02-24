import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '@btc-vision/unit-test-framework';

interface NFTDeploymentParams {
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

export class BitcoinNationNFTRuntime extends ContractRuntime {
    private readonly ownerMintSelector: number = this.getSelector('ownerMint(address)');
    private readonly publicMintSelector: number = this.getSelector('publicMint(uint256)');
    private readonly mintWithURISelector: number = this.getSelector('mintWithURI(address,string)');
    private readonly setMintingOpenSelector: number = this.getSelector('setMintingOpen(bool)');
    private readonly mintPriceSelector: number = this.getSelector('mintPrice()');
    private readonly maxPerWalletSelector: number = this.getSelector('maxPerWallet()');
    private readonly isMintingOpenSelector: number = this.getSelector('isMintingOpen()');
    private readonly mintedBySelector: number = this.getSelector('mintedBy(address)');

    public constructor(
        deployer: Address,
        address: Address,
        deployParams: NFTDeploymentParams,
        gasLimit: bigint = 150_000_000_000n,
    ) {
        const deploymentCalldata = BitcoinNationNFTRuntime.encodeDeployment(deployParams);

        super({
            address,
            deployer,
            gasLimit,
            deploymentCalldata,
        });
    }

    public async ownerMint(to: Address): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.ownerMintSelector);
        calldata.writeAddress(to);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    public async publicMint(quantity: bigint): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.publicMintSelector);
        calldata.writeU256(quantity);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    public async mintWithURI(to: Address, uri: string): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.mintWithURISelector);
        calldata.writeAddress(to);
        calldata.writeStringWithLength(uri);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    public async setMintingOpen(open: boolean): Promise<boolean> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.setMintingOpenSelector);
        calldata.writeBoolean(open);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readBoolean();
    }

    public async mintPrice(): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.mintPriceSelector);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    public async maxPerWallet(): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.maxPerWalletSelector);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    public async isMintingOpen(): Promise<boolean> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.isMintingOpenSelector);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readBoolean();
    }

    public async mintedBy(account: Address): Promise<bigint> {
        const calldata: BinaryWriter = new BinaryWriter();
        calldata.writeSelector(this.mintedBySelector);
        calldata.writeAddress(account);

        const response: CallResponse = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader: BinaryReader = new BinaryReader(response.response);
        return reader.readU256();
    }

    protected override handleError(error: Error): Error {
        return new Error(`(BitcoinNationNFT: ${this.address}) OP_NET: ${error.message}`);
    }

    protected override defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode('../build/BitcoinNationNFT.wasm', this.address);
    }

    private static encodeDeployment(params: NFTDeploymentParams): Buffer {
        const writer: BinaryWriter = new BinaryWriter();
        writer.writeStringWithLength(params.name);
        writer.writeStringWithLength(params.symbol);
        writer.writeStringWithLength(params.baseURI);
        writer.writeU256(params.maxSupply);
        writer.writeU256(params.mintPrice);
        writer.writeU256(params.maxPerWallet);
        writer.writeStringWithLength(params.collectionBanner);
        writer.writeStringWithLength(params.collectionIcon);
        writer.writeStringWithLength(params.collectionWebsite);
        writer.writeStringWithLength(params.collectionDescription);
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
