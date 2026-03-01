import { getContract, type BitcoinInterfaceAbi } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { providerService } from './ProviderService';
import { BitcoinNationNFTAbi } from '../abi/BitcoinNationNFTAbi';
import { BitcoinNationFactoryAbi } from '../abi/BitcoinNationFactoryAbi';
import { CollectionRegistryAbi } from '../abi/CollectionRegistryAbi';
import { NFTMarketplaceAbi } from '../abi/NFTMarketplaceAbi';
import { getFactoryAddress, getRegistryAddress, getMarketplaceAddress } from '../config/contracts';
import type { IBitcoinNationNFTFull, IBitcoinNationFactory, ICollectionRegistry, INFTMarketplace } from '../../contracts-types';

// The opnet getContract() returns a dynamic proxy typed as BaseContract<T> & Omit<T, ...>.
// We store the raw return value and cast on retrieval since the proxy implements all ABI methods.
type CachedContract = ReturnType<typeof getContract>;

class ContractService {
    static #instance: ContractService | undefined;
    readonly #cache = new Map<string, CachedContract>();

    private constructor() {}

    static getInstance(): ContractService {
        if (!ContractService.#instance) {
            ContractService.#instance = new ContractService();
        }
        return ContractService.#instance;
    }

    // getContract() returns a dynamic proxy whose methods are generated from the ABI at runtime.
    // TypeScript can't verify the proxy implements IBitcoinNationFactory, but it does — the ABI
    // definition guarantees all methods are present. This is the only cast boundary in the app.
    getFactory(network: Network): IBitcoinNationFactory {
        const address: string = getFactoryAddress(network);
        return this.#getOrCreate(address, BitcoinNationFactoryAbi, network) as unknown as IBitcoinNationFactory;
    }

    getRegistry(network: Network): ICollectionRegistry {
        const address: string = getRegistryAddress(network);
        return this.#getOrCreate(address, CollectionRegistryAbi, network) as unknown as ICollectionRegistry;
    }

    getMarketplace(network: Network): INFTMarketplace {
        const address: string = getMarketplaceAddress(network);
        return this.#getOrCreate(address, NFTMarketplaceAbi, network) as unknown as INFTMarketplace;
    }

    getNFTContract(address: string, network: Network): IBitcoinNationNFTFull {
        return this.#getOrCreate(address, BitcoinNationNFTAbi, network) as unknown as IBitcoinNationNFTFull;
    }

    clearCache(): void {
        this.#cache.clear();
    }

    #getOrCreate(
        address: string,
        abi: BitcoinInterfaceAbi,
        network: Network,
    ): CachedContract {
        const key: string = `${network.bech32}:${address}`;

        const existing: CachedContract | undefined = this.#cache.get(key);
        if (existing) return existing;

        const provider = providerService.getProvider(network);
        const contract: CachedContract = getContract(address, abi, provider, network);
        this.#cache.set(key, contract);
        return contract;
    }
}

export const contractService = ContractService.getInstance();
