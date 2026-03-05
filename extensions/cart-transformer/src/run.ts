import type { RunInput, FunctionRunResult, CartOperation } from "../generated/api";

interface BundleProduct {
  productId: string;
  handle?: string;
  variantIds: string[];
  discountValue: number;
  variantDiscounts?: { id: string; discountValue: number }[];
}

interface BundleGroup {
  id: string;
  name: string;
  sortOrder: number;
  products: BundleProduct[];
}

interface BundleConfig {
  version: number;
  groups: BundleGroup[];
}

export function run(input: RunInput): FunctionRunResult {
  const operations: CartOperation[] = [];

  // Build a map of product GID → config and record in-cart status natively in one pass
  const parentMetafields = new Map<string, BundleConfig>();
  const parentProductIdsInCart = new Set<string>();

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename === "ProductVariant") {
      parentProductIdsInCart.add(line.merchandise.product.id);
      
      const metafield = line.merchandise.product.bundleGroups;
      if (metafield?.value && !parentMetafields.has(line.merchandise.product.id)) {
        try {
          const config: BundleConfig = JSON.parse(metafield.value);
          parentMetafields.set(line.merchandise.product.id, config);
        } catch {
          // Invalid JSON
        }
      }
    }
  }

  // Process bundled lines
  for (const line of input.cart.lines) {
    const parentIdAttr = line.bundleParentProductId?.value;
    const groupIdAttr = line.bundleGroupId?.value;
    const merchandise = line.merchandise;

    if (!parentIdAttr || !groupIdAttr) continue;
    if (merchandise.__typename !== "ProductVariant") continue;

    // Validate: parent must be in the cart
    if (!parentProductIdsInCart.has(parentIdAttr)) continue;

    // Get parent's bundle config
    const config = parentMetafields.get(parentIdAttr);
    if (!config) continue;

    // Find the group
    const group = config.groups.find((g) => g.id === groupIdAttr);
    if (!group) continue;

    // Find this product in the group
    const childProductId = merchandise.product.id;
    const bundleProduct = group.products.find((p) => p.productId === childProductId);
    if (!bundleProduct) continue;

    // Validate variant restriction
    if (
      bundleProduct.variantIds &&
      bundleProduct.variantIds.length > 0 &&
      !bundleProduct.variantIds.includes(merchandise.id)
    ) {
      continue;
    }

    // Calculate and apply discount
    let discountValue = bundleProduct.discountValue;

    if (bundleProduct.variantDiscounts) {
      const variantDiscount = bundleProduct.variantDiscounts.find(
        (v) => v.id === merchandise.id || v.id === merchandise.id.split('/').pop()
      );
      if (variantDiscount) {
        discountValue = variantDiscount.discountValue;
      }
    }

    // Skip if no discount to apply
    if (!discountValue || discountValue <= 0) continue;

    const originalPrice = parseFloat(line.cost.amountPerQuantity.amount);

    // Guard against NaN (e.g. if amount is missing or malformed)
    if (isNaN(originalPrice)) continue;

    const newPrice = Math.max(0, originalPrice - discountValue);

    operations.push({
      update: {
        cartLineId: line.id,
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: newPrice.toFixed(2),
            },
          },
        },
      },
    });
  }

  return { operations };
}
