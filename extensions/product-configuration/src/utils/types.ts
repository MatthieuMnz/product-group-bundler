export interface BundleProduct {
  productId: string;
  handle?: string;
  title?: string;
  variantIds: string[];
  discountValue: number;
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
