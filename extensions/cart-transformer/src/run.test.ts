import { describe, it, expect } from "vitest";
import { run } from "./run";
import { CurrencyCode, type RunInput } from "../generated/api";

describe("cart-transformer", () => {
  it("should return no operations if there are no bundled products", () => {
    const input: RunInput = {
      cart: {
        lines: [
          {
            id: "gid://shopify/CartLine/1",
            quantity: 1,
            cost: {
              amountPerQuantity: { amount: "10.00", currencyCode: CurrencyCode.Usd },
            },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/1",
              product: {
                id: "gid://shopify/Product/1",
              },
            },
          },
        ],
      },
    };

    const result = run(input);
    expect(result.operations).toEqual([]);
  });

  it("should apply discount when a child product is present", () => {
    const config = {
      version: 1,
      groups: [
        {
          id: "group-1",
          name: "Group 1",
          sortOrder: 0,
          products: [
            {
              productId: "gid://shopify/Product/2",
              variantIds: [],
              discountValue: 2.0,
            },
          ],
        },
      ],
    };

    const input: RunInput = {
      cart: {
        lines: [
          // Parent
          {
            id: "gid://shopify/CartLine/1",
            quantity: 1,
            cost: {
              amountPerQuantity: { amount: "10.00", currencyCode: CurrencyCode.Usd },
            },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/1",
              product: {
                id: "gid://shopify/Product/1",
                bundleGroups: {
                  value: JSON.stringify(config),
                },
              },
            },
          },
          // Child
          {
            id: "gid://shopify/CartLine/2",
            quantity: 1,
            bundleParentProductId: { value: "gid://shopify/Product/1" },
            bundleGroupId: { value: "group-1" },
            cost: {
              amountPerQuantity: { amount: "5.00", currencyCode: CurrencyCode.Usd },
            },
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/2",
              product: {
                id: "gid://shopify/Product/2",
              },
            },
          },
        ],
      },
    };

    const result = run(input);
    expect(result.operations.length).toBe(1);
    expect(result.operations[0].update?.price?.adjustment?.fixedPricePerUnit?.amount).toBe("3.00");
  });
});
