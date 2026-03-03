import { BundleConfig, BundleGroup } from "./types";

export function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15);
}

export function validateConfig(config: BundleConfig, currentProductId: string): string[] {
  const errors: string[] = [];

  config.groups.forEach((group, groupIndex) => {
    if (!group.name.en || !group.name.fr) {
      errors.push(`Group ${groupIndex + 1} must have an English and French name.`);
    }

    group.products.forEach((product) => {
      if (product.productId === currentProductId) {
        errors.push(`Cannot add the current product to its own bundle group (${group.name.en}).`);
      }
      if (product.discountValue < 0) {
        errors.push(`Discount value must be zero or positive.`);
      }
      if (product.discountType === 'percentage' && product.discountValue > 100) {
        errors.push(`Percentage discount cannot exceed 100%.`);
      }
    });

    // Check for duplicates in same group
    const productIds = group.products.map(p => p.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      errors.push(`Duplicate products found in group: ${group.name.en}`);
    }
  });

  return errors;
}
