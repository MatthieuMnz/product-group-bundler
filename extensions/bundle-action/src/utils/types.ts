export interface VariantInfo {
  id: string;
  title: string;
  price?: string;
}

export interface BundleProduct {
  productId: string;
  handle?: string;
  title?: string;
  variantIds: string[];
  discountValue: number;
  /** Transient — populated at runtime for UI, not persisted to metafield */
  _variants?: VariantInfo[];
}

export interface BundleGroup {
  id: string;
  name: string;
  sortOrder: number;
  products: BundleProduct[];
}

export interface BundleConfig {
  version: number;
  groups: BundleGroup[];
}
