export interface VariantInfo {
  id: string;
  title: string;
  price?: string;
  imageUrl?: string;
}

export interface VariantDiscount {
  id: string;
  discountValue: number;
}

export interface BundleProduct {
  productId: string;
  handle?: string;
  title?: string;
  variantIds: string[];
  discountValue: number;
  variantDiscounts?: VariantDiscount[];
  _variants?: VariantInfo[];
  _imageUrl?: string;
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

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function normalizeVariantId(value: string): string {
  const suffix = value.split("/").pop();
  return suffix || value;
}

export function variantIdMatches(candidate: string, current: string): boolean {
  return candidate === current || normalizeVariantId(candidate) === normalizeVariantId(current);
}

export function createEmptyBundleConfig(): BundleConfig {
  return { version: 1, groups: [] };
}

export function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);
}

export function stripTransientBundleFields(config: BundleConfig): BundleConfig {
  return {
    ...config,
    groups: config.groups.map((group) => ({
      ...group,
      products: group.products.map((product) => {
        const cleanProduct: BundleProduct = { ...product };
        delete cleanProduct._variants;
        delete cleanProduct._imageUrl;
        delete cleanProduct._price;
        return cleanProduct;
      }),
    })),
  };
}

export function validateConfig(config: BundleConfig, currentProductId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  config.groups.forEach((group, groupIndex) => {
    if (!group.name || group.name.trim() === "") {
      errors.push(`Le groupe ${groupIndex + 1} doit avoir un nom.`);
    }

    group.products.forEach((product) => {
      if (product.productId === currentProductId) {
        errors.push(`Impossible d'ajouter le produit actuel à son propre groupe de lots (${group.name}).`);
      }
      if (product.discountValue < 0) {
        errors.push("La valeur de la remise doit etre superieure ou egale a zero.");
      }
      if (!product.handle) {
        warnings.push(
          `Le produit ${product.title || product.productId} dans le groupe "${group.name}" n'a pas de handle. Il ne sera pas affiche sur la vitrine.`
        );
      }
      if (product.discountValue > 1000) {
        warnings.push(
          `La remise de ${product.discountValue}$ pour "${product.title || product.productId}" dans "${group.name}" semble elevee. Veuillez verifier.`
        );
      }
    });

    const productIds = group.products.map((product) => product.productId);
    if (new Set(productIds).size !== productIds.length) {
      errors.push(`Produits en double trouves dans le groupe : ${group.name}`);
    }
  });

  return { errors, warnings };
}

export function parseBundleConfig(raw: string): BundleConfig | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.groups)) {
      return null;
    }

    const groups: BundleGroup[] = parsed.groups
      .filter((group): group is Record<string, unknown> => isRecord(group))
      .map((group) => {
        const productsRaw = Array.isArray(group.products) ? group.products : [];
        const products: BundleProduct[] = productsRaw
          .filter((product): product is Record<string, unknown> => isRecord(product))
          .map((product) => {
            const variantIds = Array.isArray(product.variantIds)
              ? product.variantIds.filter((id): id is string => typeof id === "string")
              : [];
            const variantDiscounts = Array.isArray(product.variantDiscounts)
              ? product.variantDiscounts
                  .filter((discount): discount is Record<string, unknown> => isRecord(discount))
                  .map((discount) => ({
                    id: typeof discount.id === "string" ? discount.id : "",
                    discountValue: toFiniteNumber(discount.discountValue, 0),
                  }))
                  .filter((discount) => discount.id.length > 0 && discount.discountValue > 0)
              : [];

            return {
              productId: typeof product.productId === "string" ? product.productId : "",
              handle: typeof product.handle === "string" ? product.handle : undefined,
              title: typeof product.title === "string" ? product.title : undefined,
              variantIds,
              discountValue: toFiniteNumber(product.discountValue, 0),
              variantDiscounts,
            };
          })
          .filter((product) => product.productId.length > 0);

        return {
          id: typeof group.id === "string" ? group.id : "",
          name: typeof group.name === "string" ? group.name : "",
          sortOrder: toFiniteNumber(group.sortOrder, 0),
          products,
        };
      })
      .filter((group) => group.id.length > 0);

    return {
      version: toFiniteNumber(parsed.version, 1),
      groups,
    };
  } catch {
    return null;
  }
}
