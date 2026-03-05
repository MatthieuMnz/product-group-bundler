import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  ResourceItem,
  ResourceList,
  Select,
  Spinner,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { AlertCircleIcon, ImageIcon } from "@shopify/polaris-icons";

interface BundleGroup {
  id: string;
  name?: string;
  products: { productId: string }[] | unknown;
}

interface BundleConfig {
  version: number;
  groups: BundleGroup[] | unknown;
}

interface ProductWithBundles {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  groupCount: number;
  totalProducts: number;
  isInvalidConfig: boolean;
}

type StatusFilter = "all" | "active" | "draft" | "archived";
type SortValue =
  | "UPDATED_AT_DESC"
  | "UPDATED_AT_ASC"
  | "TITLE_ASC"
  | "TITLE_DESC"
  | "CREATED_AT_DESC"
  | "CREATED_AT_ASC";

const DEFAULT_STATUS: StatusFilter = "all";
const DEFAULT_SORT: SortValue = "UPDATED_AT_DESC";
const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = new Set([10, 25, 50]);

const STATUS_OPTIONS = [
  { label: "Tous les statuts", value: "all" },
  { label: "Actif", value: "active" },
  { label: "Brouillon", value: "draft" },
  { label: "Archivé", value: "archived" },
];

const SORT_OPTIONS = [
  { label: "Dernière mise à jour (récent)", value: "UPDATED_AT_DESC" },
  { label: "Dernière mise à jour (ancien)", value: "UPDATED_AT_ASC" },
  { label: "Titre (A-Z)", value: "TITLE_ASC" },
  { label: "Titre (Z-A)", value: "TITLE_DESC" },
  { label: "Création (récent)", value: "CREATED_AT_DESC" },
  { label: "Création (ancien)", value: "CREATED_AT_ASC" },
];

const PAGE_SIZE_OPTIONS = [
  { label: "10 / page", value: "10" },
  { label: "25 / page", value: "25" },
  { label: "50 / page", value: "50" },
];

const SORT_CONFIG: Record<SortValue, { sortKey: string; reverse: boolean }> = {
  UPDATED_AT_DESC: { sortKey: "UPDATED_AT", reverse: true },
  UPDATED_AT_ASC: { sortKey: "UPDATED_AT", reverse: false },
  TITLE_ASC: { sortKey: "TITLE", reverse: false },
  TITLE_DESC: { sortKey: "TITLE", reverse: true },
  CREATED_AT_DESC: { sortKey: "CREATED_AT", reverse: true },
  CREATED_AT_ASC: { sortKey: "CREATED_AT", reverse: false },
};

function parseStatus(raw: string | null): StatusFilter {
  if (raw === "active" || raw === "draft" || raw === "archived" || raw === "all") {
    return raw;
  }
  return DEFAULT_STATUS;
}

function parseSort(raw: string | null): SortValue {
  if (
    raw === "UPDATED_AT_DESC" ||
    raw === "UPDATED_AT_ASC" ||
    raw === "TITLE_ASC" ||
    raw === "TITLE_DESC" ||
    raw === "CREATED_AT_DESC" ||
    raw === "CREATED_AT_ASC"
  ) {
    return raw;
  }
  return DEFAULT_SORT;
}

function parsePageSize(raw: string | null): number {
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && ALLOWED_PAGE_SIZES.has(parsed)) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
}

function buildProductsQuery(namespace: string, q: string, status: StatusFilter): string {
  const queryParts = [`metafields.${namespace}.bundle_groups:*`];
  const trimmedQuery = q.trim();

  if (trimmedQuery) {
    queryParts.push(trimmedQuery);
  }

  if (status !== "all") {
    queryParts.push(`status:${status}`);
  }

  return queryParts.join(" ");
}

function parseBundleMetrics(rawValue: string | null | undefined) {
  if (!rawValue) {
    return {
      groupCount: 0,
      totalProducts: 0,
      isInvalidConfig: false,
    };
  }

  try {
    const config = JSON.parse(rawValue) as BundleConfig;
    if (!config || typeof config !== "object" || !Array.isArray(config.groups)) {
      return {
        groupCount: 0,
        totalProducts: 0,
        isInvalidConfig: true,
      };
    }

    let hasInvalidStructure = false;
    const totalProducts = config.groups.reduce((sum, group) => {
      if (!group || typeof group !== "object" || !Array.isArray(group.products)) {
        hasInvalidStructure = true;
        return sum;
      }
      return sum + group.products.length;
    }, 0);

    return {
      groupCount: config.groups.length,
      totalProducts,
      isInvalidConfig: hasInvalidStructure,
    };
  } catch {
    return {
      groupCount: 0,
      totalProducts: 0,
      isInvalidConfig: true,
    };
  }
}

async function getAppNamespace(admin: any): Promise<string> {
  try {
    const appRes = await admin.graphql(`
      query {
        app {
          id
        }
      }
    `);
    const appParsed = await appRes.json();
    const appIdGid = appParsed.data?.app?.id;
    const numericId = appIdGid ? appIdGid.split("/").pop() : "";
    return numericId ? `app--${numericId}` : "app--product-group-bundler";
  } catch {
    return "app--product-group-bundler";
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = parseStatus(url.searchParams.get("status"));
  const sort = parseSort(url.searchParams.get("sort"));
  const pageSize = parsePageSize(url.searchParams.get("pageSize"));
  const after = (url.searchParams.get("after") ?? "").trim();
  const before = (url.searchParams.get("before") ?? "").trim();

  const namespace = await getAppNamespace(admin);
  const productQuery = buildProductsQuery(namespace, q, status);
  const sortConfig = SORT_CONFIG[sort];

  const variables = {
    namespace,
    query: productQuery,
    first: before ? null : pageSize,
    after: before ? null : after || null,
    last: before ? pageSize : null,
    before: before || null,
    sortKey: sortConfig.sortKey,
    reverse: sortConfig.reverse,
  };

  try {
    const response = await admin.graphql(
      `#graphql
      query ProductsWithBundles(
        $namespace: String!
        $query: String!
        $first: Int
        $after: String
        $last: Int
        $before: String
        $sortKey: ProductSortKeys!
        $reverse: Boolean!
      ) {
        products(
          first: $first
          after: $after
          last: $last
          before: $before
          query: $query
          sortKey: $sortKey
          reverse: $reverse
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
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }`,
      { variables },
    );

    const parsed = (await response.json()) as any;

    if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
      throw new Error(parsed.errors[0]?.message || "Erreur Shopify Admin GraphQL");
    }

    const edges = parsed.data?.products?.edges || [];
    const pageInfo = parsed.data?.products?.pageInfo || {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    };

    const products: ProductWithBundles[] = edges.map((edge: any) => {
      const node = edge.node;
      const metrics = parseBundleMetrics(node.metafield?.value);

      return {
        id: node.id,
        title: node.title,
        handle: node.handle,
        imageUrl: node.featuredImage?.url || null,
        groupCount: metrics.groupCount,
        totalProducts: metrics.totalProducts,
        isInvalidConfig: metrics.isInvalidConfig,
      };
    });

    return {
      products,
      pageInfo,
      controls: {
        q,
        status,
        sort,
        pageSize,
      },
      hasFilters: Boolean(q) || status !== DEFAULT_STATUS || sort !== DEFAULT_SORT || pageSize !== DEFAULT_PAGE_SIZE,
      namespace,
      shopDomain: session.shop,
      error: null,
    };
  } catch (error) {
    return {
      products: [] as ProductWithBundles[],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
      controls: {
        q,
        status,
        sort,
        pageSize,
      },
      hasFilters: Boolean(q) || status !== DEFAULT_STATUS || sort !== DEFAULT_SORT || pageSize !== DEFAULT_PAGE_SIZE,
      namespace,
      shopDomain: session.shop,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
};

export default function Bundles() {
  const { products, pageInfo, controls, hasFilters, error, shopDomain } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state !== "idle";

  const [queryValue, setQueryValue] = useState(controls.q);
  const [statusValue, setStatusValue] = useState<StatusFilter>(controls.status);
  const [sortValue, setSortValue] = useState<SortValue>(controls.sort);
  const [pageSizeValue, setPageSizeValue] = useState(String(controls.pageSize));

  useEffect(() => {
    setQueryValue(controls.q);
    setStatusValue(controls.status);
    setSortValue(controls.sort);
    setPageSizeValue(String(controls.pageSize));
  }, [controls.pageSize, controls.q, controls.sort, controls.status]);

  const buildBaseParams = () => {
    const params = new URLSearchParams();
    const trimmedQuery = queryValue.trim();

    if (trimmedQuery) params.set("q", trimmedQuery);
    if (statusValue !== DEFAULT_STATUS) params.set("status", statusValue);
    if (sortValue !== DEFAULT_SORT) params.set("sort", sortValue);
    if (Number(pageSizeValue) !== DEFAULT_PAGE_SIZE) params.set("pageSize", pageSizeValue);
    return params;
  };

  const applyFilters = () => {
    const params = buildBaseParams();
    submit(params, { method: "get", action: "/app/bundles" });
  };

  const resetFilters = () => {
    setQueryValue("");
    setStatusValue(DEFAULT_STATUS);
    setSortValue(DEFAULT_SORT);
    setPageSizeValue(String(DEFAULT_PAGE_SIZE));
    submit(new URLSearchParams(), { method: "get", action: "/app/bundles" });
  };

  const submitWithCursor = (cursorType: "after" | "before", cursor: string | null | undefined) => {
    if (!cursor) return;
    const params = new URLSearchParams();
    if (controls.q) params.set("q", controls.q);
    if (controls.status !== DEFAULT_STATUS) params.set("status", controls.status);
    if (controls.sort !== DEFAULT_SORT) params.set("sort", controls.sort);
    if (controls.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(controls.pageSize));
    params.set(cursorType, cursor);
    submit(params, { method: "get", action: "/app/bundles" });
  };

  const hasNoResults = !error && products.length === 0 && hasFilters;
  const hasNoData = !error && products.length === 0 && !hasFilters;

  return (
    <Page title="Produits avec des lots configurés">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="end" gap="300">
                  <div style={{ minWidth: 280, flex: 1 }}>
                    <TextField
                      label="Recherche"
                      value={queryValue}
                      onChange={setQueryValue}
                      autoComplete="off"
                      placeholder="Titre, handle, mot-clé Shopify..."
                      clearButton
                      onClearButtonClick={() => setQueryValue("")}
                    />
                  </div>
                  <div style={{ minWidth: 180 }}>
                    <Select label="Statut" options={STATUS_OPTIONS} value={statusValue} onChange={(value) => setStatusValue(value as StatusFilter)} />
                  </div>
                  <div style={{ minWidth: 250 }}>
                    <Select label="Tri" options={SORT_OPTIONS} value={sortValue} onChange={(value) => setSortValue(value as SortValue)} />
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <Select
                      label="Taille de page"
                      options={PAGE_SIZE_OPTIONS}
                      value={pageSizeValue}
                      onChange={(value) => setPageSizeValue(value)}
                    />
                  </div>
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {`${products.length} résultat${products.length !== 1 ? "s" : ""} sur cette page`}
                  </Text>
                  <InlineStack gap="200">
                    <Button onClick={resetFilters} disabled={!hasFilters || isLoading}>
                      Réinitialiser
                    </Button>
                    <Button variant="primary" onClick={applyFilters} loading={isLoading}>
                      Appliquer
                    </Button>
                  </InlineStack>
                </InlineStack>
                {isLoading ? (
                  <InlineStack gap="200" blockAlign="center">
                    <Spinner size="small" />
                    <Text as="span" variant="bodySm" tone="subdued">
                      Mise à jour des résultats...
                    </Text>
                  </InlineStack>
                ) : null}
              </BlockStack>
            </Card>

            {error ? (
              <Banner tone="critical" title="Impossible de charger les lots">
                <p>{error}</p>
              </Banner>
            ) : null}

            <Card padding="0">
              {hasNoData ? (
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
              ) : null}

              {hasNoResults ? (
                <Box padding="400">
                  <EmptyState
                    heading="Aucun résultat pour ces filtres"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    action={{ content: "Réinitialiser les filtres", onAction: resetFilters }}
                  >
                    <p>Essayez de modifier la recherche, le statut ou le tri.</p>
                  </EmptyState>
                </Box>
              ) : null}

              {!error && products.length > 0 ? (
                <ResourceList
                  resourceName={{ singular: "produit", plural: "produits" }}
                  items={products}
                  renderItem={(product: ProductWithBundles) => {
                    const productAdminUrl = `https://${shopDomain}/admin/products/${product.id.split("/").pop()}`;
                    const media = product.imageUrl ? (
                      <Thumbnail source={product.imageUrl} alt={product.title} size="medium" />
                    ) : (
                      <Thumbnail source={ImageIcon} alt={product.title} size="medium" />
                    );

                    return (
                      <ResourceItem
                        id={product.id}
                        url={productAdminUrl}
                        external
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
                              {`${product.groupCount} groupe${product.groupCount !== 1 ? "s" : ""}`}
                            </Badge>
                            <Badge tone="new">
                              {`${product.totalProducts} produit${product.totalProducts !== 1 ? "s" : ""} associé${product.totalProducts !== 1 ? "s" : ""}`}
                            </Badge>
                            {product.isInvalidConfig ? (
                              <Badge tone="warning" icon={AlertCircleIcon}>
                                Configuration invalide
                              </Badge>
                            ) : null}
                          </InlineStack>
                        </InlineStack>
                      </ResourceItem>
                    );
                  }}
                />
              ) : null}

              {!error && products.length > 0 ? (
                <Box padding="400" borderBlockStartWidth="025" borderColor="border">
                  <InlineStack align="space-between">
                    <Button
                      disabled={!pageInfo.hasPreviousPage || isLoading}
                      onClick={() => submitWithCursor("before", pageInfo.startCursor)}
                    >
                      Page précédente
                    </Button>
                    <Button
                      disabled={!pageInfo.hasNextPage || isLoading}
                      onClick={() => submitWithCursor("after", pageInfo.endCursor)}
                    >
                      Page suivante
                    </Button>
                  </InlineStack>
                </Box>
              ) : null}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
