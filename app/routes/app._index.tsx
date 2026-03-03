import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // Check if Cart Transform is already created
  const response = await admin.graphql(
    `#graphql
    query {
      cartTransforms(first: 1) {
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
    hasCartTransform: cartTransforms.length > 0,
    functionId: process.env.SHOPIFY_BUNDLE_DISCOUNT_ID
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const functionId = process.env.SHOPIFY_BUNDLE_DISCOUNT_ID;
  if (!functionId) {
    return { error: "Function ID not found in environment. Please ensure the extension is deployed or pushed." };
  }

  if (formData.get("action") === "setupCartTransform") {
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
      {
        variables: {
          functionId: functionId
        }
      }
    );
    
    const parsed = await response.json();
    if (parsed.data?.cartTransformCreate?.userErrors?.length) {
      return { error: parsed.data.cartTransformCreate.userErrors[0].message };
    }
    
    return { success: true };
  }
  
  return null;
};

export default function Index() {
  const { hasCartTransform } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Cart Transform function installed successfully!");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleSetup = () => {
    fetcher.submit({ action: "setupCartTransform" }, { method: "POST" });
  };

  return (
    <s-page heading="Product Group Bundler">
      <s-section heading="Welcome to Product Group Bundler">
        <s-paragraph>
          This app allows you to create flexible product bundles directly on your product pages.
          Navigate to your products to start adding bundle groups.
        </s-paragraph>
      </s-section>
      
      <s-section heading="App Setup">
        {hasCartTransform ? (
          <s-box>
            <s-text>✅ Cart Transform function is active. Bundle discounts will be applied automatically in the cart.</s-text>
          </s-box>
        ) : (
          <s-box>
            <s-paragraph>
              <s-text>⚠️ Cart Transform function is not active. Discounts will not be applied in the cart.</s-text>
            </s-paragraph>
            <br />
            <s-button 
              onClick={handleSetup} 
              loading={fetcher.state !== "idle"}
            >
              Activate Bundle Discounts
            </s-button>
          </s-box>
        )}
      </s-section>
      
      <s-section heading="Next Steps">
        <s-unordered-list>
          <s-list-item>Add the "Bundle Picker" app block to your default Product template in the Theme Editor.</s-list-item>
          <s-list-item>Go to a Product in your Shopify Admin and find the "Bundle Groups" block to configure discounts.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
