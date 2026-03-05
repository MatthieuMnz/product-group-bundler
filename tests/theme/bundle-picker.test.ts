// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../extensions/theme-extension/assets/bundle-picker.js";

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("bundle-picker payload", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    Object.defineProperty(window, "Shopify", {
      value: { routes: { root: "/" } },
      writable: true,
      configurable: true,
    });
  });

  it("submits parent and selected child bundle items", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const form = document.createElement("form");
    form.setAttribute("action", "/cart/add");
    const variantInput = document.createElement("input");
    variantInput.setAttribute("name", "id");
    variantInput.setAttribute("value", "111");
    form.appendChild(variantInput);

    const picker = document.createElement("pgb-bundle-picker");
    picker.setAttribute(
      "data-bundle-config",
      JSON.stringify({
        version: 1,
        groups: [
          {
            id: "group-1",
            name: "Accessories",
            products: [
              {
                productId: "gid://shopify/Product/2",
                variantIds: [],
                discountValue: 5,
                title: "Accessory",
              },
            ],
          },
        ],
      })
    );
    picker.setAttribute("data-product-gid", "gid://shopify/Product/1");
    picker.setAttribute("data-heading", "Bundle");

    form.appendChild(picker);
    document.body.appendChild(form);
    await flush();

    const checkbox = picker.querySelector(".pgb-checkbox") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.checked = true;
    checkbox.setAttribute("data-variant-id", "222");

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(request.body);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ id: 111, quantity: 1 });
    expect(body.items[1]).toMatchObject({
      id: 222,
      quantity: 1,
      parent_id: 111,
      properties: {
        _bundle_parent_product_id: "gid://shopify/Product/1",
        _bundle_group_id: "group-1",
      },
    });
  });
});
