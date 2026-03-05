import { describe, expect, it } from "vitest";
import {
  createEmptyBundleConfig,
  stripTransientBundleFields,
  validateConfig,
} from "../../shared/bundle-domain";

describe("bundle-domain", () => {
  it("validates duplicate and self-referenced products", () => {
    const config = {
      version: 1,
      groups: [
        {
          id: "g-1",
          name: "Accessories",
          sortOrder: 0,
          products: [
            {
              productId: "gid://shopify/Product/1",
              variantIds: [],
              discountValue: 10,
            },
            {
              productId: "gid://shopify/Product/1",
              variantIds: [],
              discountValue: 10,
            },
          ],
        },
      ],
    };

    const result = validateConfig(config, "gid://shopify/Product/1");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(" ")).toContain("double");
    expect(result.errors.join(" ")).toContain("propre groupe");
  });

  it("strips transient UI-only fields before save", () => {
    const config = {
      version: 1,
      groups: [
        {
          id: "g-1",
          name: "Accessories",
          sortOrder: 0,
          products: [
            {
              productId: "gid://shopify/Product/2",
              variantIds: [],
              discountValue: 5,
              _imageUrl: "https://example.com/image.jpg",
              _price: "10.00",
              _variants: [{ id: "v1", title: "Default" }],
            },
          ],
        },
      ],
    };

    const cleaned = stripTransientBundleFields(config);
    expect(cleaned.groups[0].products[0]._imageUrl).toBeUndefined();
    expect(cleaned.groups[0].products[0]._price).toBeUndefined();
    expect(cleaned.groups[0].products[0]._variants).toBeUndefined();
  });

  it("creates an empty starter config", () => {
    expect(createEmptyBundleConfig()).toEqual({ version: 1, groups: [] });
  });
});
