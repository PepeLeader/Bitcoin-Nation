import type { IOP721 } from './OP721';
import type { IBitcoinNationNFT } from './BitcoinNationNFT';

export type { IBitcoinNationFactory } from './BitcoinNationFactory';
export type { ICollectionRegistry } from './CollectionRegistry';
export type { INFTMarketplace } from './NFTMarketplace';

/**
 * Combined interface: OP721 base methods + BitcoinNationNFT custom methods.
 * The ABI contains all methods, so the runtime contract has them all.
 * This just gives TypeScript the full picture.
 */
export interface IBitcoinNationNFTFull extends IOP721, IBitcoinNationNFT {}
