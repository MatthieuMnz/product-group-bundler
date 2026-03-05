import { BundleConfig } from "./types";

export function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15);
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: BundleConfig, currentProductId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  config.groups.forEach((group, groupIndex) => {
    if (!group.name || group.name.trim() === '') {
      errors.push(`Le groupe ${groupIndex + 1} doit avoir un nom.`);
    }

    group.products.forEach((product) => {
      if (product.productId === currentProductId) {
        errors.push(`Impossible d'ajouter le produit actuel à son propre groupe de lots (${group.name}).`);
      }
      if (product.discountValue < 0) {
        errors.push(`La valeur de la remise doit être supérieure ou égale à zéro.`);
      }
      // Warn if product is missing a handle (needed for storefront)
      if (!product.handle) {
        warnings.push(`Le produit ${product.title || product.productId} dans le groupe "${group.name}" n'a pas de handle. Il ne sera pas affiché sur la vitrine.`);
      }
      // Warn about unreasonably high discounts
      if (product.discountValue > 1000) {
        warnings.push(`La remise de ${product.discountValue}$ pour "${product.title || product.productId}" dans "${group.name}" semble élevée. Veuillez vérifier.`);
      }
    });

    // Check for duplicates in same group
    const productIds = group.products.map(p => p.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      errors.push(`Produits en double trouvés dans le groupe : ${group.name}`);
    }
  });

  return { errors, warnings };
}

