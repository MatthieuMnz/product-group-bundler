import { BundleConfig, BundleGroup } from "./types";

export function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15);
}

export function validateConfig(config: BundleConfig, currentProductId: string): string[] {
  const errors: string[] = [];

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
      if (product.discountType === 'percentage' && product.discountValue > 100) {
        errors.push(`La remise en pourcentage ne peut pas dépasser 100 %.`);
      }
    });

    // Check for duplicates in same group
    const productIds = group.products.map(p => p.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      errors.push(`Produits en double trouvés dans le groupe : ${group.name}`);
    }
  });

  return errors;
}
