import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

interface BundleGroup {
  id: string;
  name: string;
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

  const appRes = await admin.graphql(`
    query {
      app {
        id
      }
    }
  `);
  const appParsed = await appRes.json();
  const appIdGid = appParsed.data?.app?.id;
  const numericId = appIdGid ? appIdGid.split('/').pop() : '';
  const namespace = numericId ? `app--${numericId}` : "app--product-group-bundler";

  const response = await admin.graphql(
    `#graphql
    query ProductsWithBundles($namespace: String!, $query: String!) {
      products(
        first: 50,
        query: $query
      ) {
        edges {
          node {
            id
            title
            handle
            featuredImage {
              url(transform: { maxWidth: 100 })
            }
            metafield(namespace: $namespace, key: "bundle_groups") {
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`,
    {
      variables: {
        namespace,
        query: `metafields.${namespace}.bundle_groups:*`
      }
    }
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
    <s-page heading="Produits avec des lots">
      <s-section>
        {products.length === 0 ? (
          <s-box>
            <s-text>Aucun produit n'a de groupe de lots configuré pour le moment.</s-text>
            <br />
            <s-text>
              Pour commencer, allez sur un produit dans l'Admin Shopify et configurez les groupes de lots dans la fiche de configuration « Groupes de lots ».
            </s-text>
          </s-box>
        ) : (
          <s-box>
            <s-text>{products.length} produit{products.length !== 1 ? 's' : ''} avec des groupes de lots</s-text>
            <br />
            <s-box padding-block-start="base">
              {products.map((product: ProductWithBundles) => (
                <s-box key={product.id} padding-block-end="base" border-block-end="base">
                  <s-box padding="base">
                    <s-text><b>{product.title}</b></s-text>
                    <s-text tone="neutral">
                      {product.groupCount} groupe{product.groupCount !== 1 ? 's' : ''} · {product.totalProducts} produit{product.totalProducts !== 1 ? 's' : ''} associé{product.totalProducts !== 1 ? 's' : ''}
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
