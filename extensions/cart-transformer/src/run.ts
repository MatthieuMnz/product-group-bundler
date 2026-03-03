import type { RunInput, FunctionRunResult, CartOperation } from "../generated/api";

interface BundleProduct {
  productId: string;
  handle?: string;
  variantIds: string[];
  discountType: "fixed_amount" | "percentage";
  discountValue: number;
}

interface BundleGroup {
  id: string;
  name: { en: string; fr: string };
  sortOrder: number;
  products: BundleProduct[];
}

interface BundleConfig {
  version: number;
  groups: BundleGroup[];
}

export function run(input: RunInput): FunctionRunResult {
  const operations: CartOperation[] = [];

  // Build a map of product GID → metafield value for all products in cart
  const parentMetafields = new Map<string, BundleConfig>();
  for (const line of input.cart.lines) {
    if (line.merchandise.__typename === "ProductVariant") {
      const metafield = line.merchandise.product.bundleGroups;
      if (metafield?.value) {
        try {
          const config: BundleConfig = JSON.parse(metafield.value);
          parentMetafields.set(line.merchandise.product.id, config);
        } catch {
          // Invalid JSON
        }
      }
    }
  }

  // Check if parent products are actually in the cart
  const parentProductIdsInCart = new Set<string>();
  for (const line of input.cart.lines) {
    if (line.merchandise.__typename === "ProductVariant") {
      parentProductIdsInCart.add(line.merchandise.product.id);
    }
  }

  // Process bundled lines
  for (const line of input.cart.lines) {
    const parentIdAttr = line.bundleParentProductId?.value;
    const groupIdAttr = line.bundleGroupId?.value;

    if (!parentIdAttr || !groupIdAttr) continue;
    if (line.merchandise.__typename !== "ProductVariant") continue;

    // Validate: parent must be in the cart
    if (!parentProductIdsInCart.has(parentIdAttr)) continue;

    // Get parent's bundle config
    const config = parentMetafields.get(parentIdAttr);
    if (!config) continue;

    // Find the group
    const group = config.groups.find((g) => g.id === groupIdAttr);
    if (!group) continue;

    // Find this product in the group
    const childProductId = line.merchandise.product.id;
    const bundleProduct = group.products.find((p) => p.productId === childProductId);
    if (!bundleProduct) continue;

    // Validate variant restriction
    if (
      bundleProduct.variantIds &&
      bundleProduct.variantIds.length > 0 &&
      !bundleProduct.variantIds.includes(line.merchandise.id)
    ) {
      continue;
    }

    // Calculate and apply discount
    const originalPrice = parseFloat(line.cost.amountPerQuantity.amount);

    if (bundleProduct.discountType === "percentage") {
      const newPrice = Math.max(0, originalPrice * (1 - bundleProduct.discountValue / 100));
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
    } else if (bundleProduct.discountType === "fixed_amount") {
      const newPrice = Math.max(0, originalPrice - bundleProduct.discountValue);
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
  }

  return { operations };
}
