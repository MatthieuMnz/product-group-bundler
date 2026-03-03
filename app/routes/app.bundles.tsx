import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

interface BundleGroup {
  id: string;
  name: { en: string; fr: string };
  products: { productId: string }[];
}

interface BundleConfig {
  version: number;
  groups: BundleGroup[];
}

interface ProductWithBundles {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  groupCount: number;
  totalProducts: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query ProductsWithBundles {
      products(
        first: 50,
        query: "metafields.app--product-group-bundler.bundle_groups:*"
      ) {
        edges {
          node {
            id
            title
            handle
            featuredImage {
              url(transform: { maxWidth: 100 })
            }
            metafield(namespace: "app--product-group-bundler", key: "bundle_groups") {
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`
  );

  const parsed = await response.json();
  const edges = parsed.data?.products?.edges || [];

  const products: ProductWithBundles[] = edges.map((edge: any) => {
    const node = edge.node;
    let groupCount = 0;
    let totalProducts = 0;

    if (node.metafield?.value) {
      try {
        const config: BundleConfig = JSON.parse(node.metafield.value);
        groupCount = config.groups.length;
        totalProducts = config.groups.reduce((sum: number, g: BundleGroup) => sum + g.products.length, 0);
      } catch {
        // Invalid JSON
      }
    }

    return {
      id: node.id,
      title: node.title,
      handle: node.handle,
      imageUrl: node.featuredImage?.url || null,
      groupCount,
      totalProducts,
    };
  });

  return { products };
};

export default function Bundles() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Products with Bundles">
      <s-section>
        {products.length === 0 ? (
          <s-box>
            <s-text>No products have bundle groups configured yet.</s-text>
            <br />
            <s-text>
              To get started, go to a product in Shopify Admin and configure bundle groups in the "Bundle Groups" configuration card.
            </s-text>
          </s-box>
        ) : (
          <s-box>
            <s-text>{products.length} product{products.length !== 1 ? 's' : ''} with bundle groups</s-text>
            <br />
            <s-box padding-block-start="base">
              {products.map((product: ProductWithBundles) => (
                <s-box key={product.id} padding-block-end="base" border-block-end="base">
                  <s-box padding="base">
                    <s-text><b>{product.title}</b></s-text>
                    <s-text tone="neutral">
                      {product.groupCount} group{product.groupCount !== 1 ? 's' : ''} · {product.totalProducts} bundled product{product.totalProducts !== 1 ? 's' : ''}
                    </s-text>
                  </s-box>
                </s-box>
              ))}
            </s-box>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
