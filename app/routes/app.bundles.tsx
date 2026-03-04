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

import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  EmptyState,
  Box,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

export default function Bundles() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <Page title="Produits avec des lots">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {products.length === 0 ? (
              <Box padding="400">
                <EmptyState
                  heading="Aucun lot configuré"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{ content: "Aller aux produits", url: "shopify:admin/products" }}
                >
                  <p>
                    Pour commencer, allez sur un produit dans l'Admin Shopify et configurez les groupes de lots dans le bloc « Groupes de lots ».
                  </p>
                </EmptyState>
              </Box>
            ) : (
              <ResourceList
                resourceName={{ singular: "produit", plural: "produits" }}
                items={products}
                renderItem={(product: ProductWithBundles) => {
                  const media = product.imageUrl ? (
                    <Thumbnail source={product.imageUrl} alt={product.title} size="medium" />
                  ) : (
                    <Thumbnail source={ImageIcon} alt={product.title} size="medium" />
                  );

                  return (
                    <ResourceItem
                      id={product.id}
                      url={`shopify:admin/products/${product.id.split('/').pop()}`}
                      media={media}
                      accessibilityLabel={`Voir les détails de ${product.title}`}
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <Box>
                          <Text variant="bodyMd" fontWeight="bold" as="h3">
                            {product.title}
                          </Text>
                          <Text variant="bodySm" tone="subdued" as="p">
                            {product.handle}
                          </Text>
                        </Box>
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone="info">
                            {`${product.groupCount} groupe${product.groupCount !== 1 ? 's' : ''}`}
                          </Badge>
                          <Badge tone="new">
                            {`${product.totalProducts} produit${product.totalProducts !== 1 ? 's' : ''} associé${product.totalProducts !== 1 ? 's' : ''}`}
                          </Badge>
                        </InlineStack>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
