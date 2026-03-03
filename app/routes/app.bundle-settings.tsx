import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query {
      cartTransforms(first: 10) {
        nodes {
          id
          functionId
        }
      }
    }`
  );

  const parsed = await response.json();
  const cartTransforms = parsed.data?.cartTransforms?.nodes || [];

  return {
    cartTransforms,
    hasCartTransform: cartTransforms.length > 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "activate") {
    // Dynamically find the bundle-discount function ID via GraphQL
    const fnResponse = await admin.graphql(
      `#graphql
      query {
        shopifyFunctions(first: 25) {
          nodes {
            id
            title
            apiType
            app {
              title
            }
          }
        }
      }`
    );

    const fnParsed = await fnResponse.json();
    const functions = fnParsed.data?.shopifyFunctions?.nodes || [];
    const bundleFunction = functions.find(
      (fn: any) => fn.apiType === "cart_transform"
    );

    if (!bundleFunction) {
      return { error: "Cart Transform function not found. Please ensure the extension is built and pushed." };
    }

    const response = await admin.graphql(
      `#graphql
      mutation cartTransformCreate($functionId: String!) {
        cartTransformCreate(functionId: $functionId, blockOnFailure: false) {
          cartTransform {
            id
            functionId
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { functionId: bundleFunction.id } }
    );

    const parsed = await response.json();
    if (parsed.data?.cartTransformCreate?.userErrors?.length) {
      return { error: parsed.data.cartTransformCreate.userErrors[0].message };
    }

    return { success: true, message: "Cart Transform activated!" };
  }

  if (actionType === "deactivate") {
    const cartTransformId = formData.get("cartTransformId");
    if (!cartTransformId) {
      return { error: "No Cart Transform ID provided." };
    }

    const response = await admin.graphql(
      `#graphql
      mutation cartTransformDelete($id: ID!) {
        cartTransformDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { id: cartTransformId } }
    );

    const parsed = await response.json();
    if (parsed.data?.cartTransformDelete?.userErrors?.length) {
      return { error: parsed.data.cartTransformDelete.userErrors[0].message };
    }

    return { success: true, message: "Cart Transform deactivated." };
  }

  return null;
};

export default function BundleSettings() {
  const { cartTransforms, hasCartTransform } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(fetcher.data.message || "Done!");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="Bundle Discount Settings">
      <s-section heading="Cart Transform Function">
        <s-paragraph>
          <s-text>
            The Cart Transform function applies bundle discounts automatically when customers add bundled products to their cart. It reads the discount configuration from the product metafield and adjusts prices at checkout.
          </s-text>
        </s-paragraph>

        {hasCartTransform ? (
          <s-box>
            <s-text>✅ Cart Transform is active. Bundle discounts are being applied.</s-text>
            <br />
            {cartTransforms.map((ct: any) => (
              <s-box key={ct.id}>
                <s-text>ID: {ct.id}</s-text>
                <br />
                <s-button
                  tone="critical"
                  onClick={() =>
                    fetcher.submit(
                      { action: "deactivate", cartTransformId: ct.id },
                      { method: "POST" }
                    )
                  }
                  loading={fetcher.state !== "idle"}
                >
                  Deactivate
                </s-button>
              </s-box>
            ))}
          </s-box>
        ) : (
          <s-box>
            <s-text>⚠️ Cart Transform is not active. Bundle discounts will not be applied.</s-text>
            <br />
            <s-button
              variant="primary"
              onClick={() =>
                fetcher.submit({ action: "activate" }, { method: "POST" })
              }
              loading={fetcher.state !== "idle"}
            >
              Activate Bundle Discounts
            </s-button>
          </s-box>
        )}
      </s-section>

      <s-section heading="How It Works">
        <s-unordered-list>
          <s-list-item>When a customer adds a bundled product to their cart, the Cart Transform function runs automatically.</s-list-item>
          <s-list-item>It reads the bundle configuration from the parent product's metafield.</s-list-item>
          <s-list-item>It validates the bundle relationship and applies the configured discount.</s-list-item>
          <s-list-item>The discounted price is shown in the cart and checkout.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
