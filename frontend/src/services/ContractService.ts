import { getContract, type IOP_NETContract, type BitcoinInterfaceAbi } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { providerService } from './ProviderService';
import { BitcoinNationNFTAbi } from '../abi/BitcoinNationNFTAbi';
import { BitcoinNationFactoryAbi } from '../abi/BitcoinNationFactoryAbi';
import { getFactoryAddress } from '../config/contracts';
import type { IBitcoinNationNFTFull, IBitcoinNationFactory } from '../../contracts-types';

class ContractService {
    static #instance: ContractService | undefined;
    readonly #cache = new Map<string, IOP_NETContract>();

    private constructor() {}

    static getInstance(): ContractService {
        if (!ContractService.#instance) {
            ContractService.#instance = new ContractService();
        }
        return ContractService.#instance;
    }

    getFactory(network: Network): IBitcoinNationFactory {
        const address = getFactoryAddress(network);
        return this.#getOrCreate<IBitcoinNationFactory>(
            address,
            BitcoinNationFactoryAbi as unknown as BitcoinInterfaceAbi,
            network,
        );
    }

    getNFTContract(address: string, network: Network): IBitcoinNationNFTFull {
        return this.#getOrCreate<IBitcoinNationNFTFull>(
            address,
            BitcoinNationNFTAbi as unknown as BitcoinInterfaceAbi,
            network,
        );
    }

    clearCache(): void {
        this.#cache.clear();
    }

    #getOrCreate<T extends IOP_NETContract>(
        address: string,
        abi: BitcoinInterfaceAbi,
        network: Network,
    ): T {
        const key = `${network.bech32}:${address}`;

        const existing = this.#cache.get(key);
        if (existing) return existing as T;

        const provider = providerService.getProvider(network);
        const contract = getContract<T>(address, abi, provider, network) as unknown as T;
        this.#cache.set(key, contract as unknown as IOP_NETContract);
        return contract;
    }
}

export const contractService = ContractService.getInstance();
