export interface VariantInfo {
  id: string;
  title: string;
  price?: string;
  imageUrl?: string;
}

export interface BundleProduct {
  productId: string;
  handle?: string;
  title?: string;
  variantIds: string[];
  discountValue: number;
  /** Custom discounts for specific variants */
  variantDiscounts?: { id: string; discountValue: number }[];
  /** Transient — populated at runtime for UI, not persisted to metafield */
  _variants?: VariantInfo[];
  /** Transient — product featured image URL for admin preview */
  _imageUrl?: string;
  /** Transient — product price string for admin preview (first variant price) */
  _price?: string;
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
