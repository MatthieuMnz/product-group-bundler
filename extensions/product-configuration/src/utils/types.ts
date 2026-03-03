export interface BundleProduct {
  productId: string;
  handle?: string;
  title?: string;
  variantIds: string[];
  discountType: "fixed_amount" | "percentage";
  discountValue: number;
}

export interface BundleGroup {
  id: string;
  name: {
    en: string;
    fr: string;
  };
  sortOrder: number;
  products: BundleProduct[];
}

export interface BundleConfig {
  version: number;
  groups: BundleGroup[];
}
