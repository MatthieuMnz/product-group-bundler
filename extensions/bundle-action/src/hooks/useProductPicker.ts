import { useApi } from '@shopify/ui-extensions-react/admin';
import { useCallback } from 'react';

interface PickedVariant {
  id: string;
  title: string;
  price: string;
}

interface PickedProduct {
  id: string;
  title: string;
  handle: string;
  variants: PickedVariant[];
  imageUrl?: string;
}

type GraphqlResponse<T> = { data?: T };
type QueryFn = <T = unknown>(
  query: string,
  options?: { variables?: Record<string, unknown> }
) => Promise<GraphqlResponse<T>>;

type PickerSelection = {
  id: string;
  title: string;
  handle: string;
};

type ResourcePickerFn = (options: {
  type: 'product';
  multiple: boolean;
  action: 'select';
  selectionIds: Array<{ id: string }>;
  filter: { draft: boolean; archived: boolean };
}) => Promise<PickerSelection[]>;

export function useProductPicker() {
  const { resourcePicker, query } = useApi() as {
    resourcePicker?: unknown;
    query: QueryFn;
  };

  const pickProducts = useCallback(async (selectedIds: string[] = []): Promise<PickedProduct[]> => {
    try {
      if (typeof resourcePicker !== 'function') {
        return [];
      }

      const selected = await (resourcePicker as ResourcePickerFn)({
        type: 'product',
        multiple: true,
        action: 'select',
        selectionIds: selectedIds.map(id => ({ id })),
        filter: {
          draft: false,
          archived: false,
        },
      });

      if (!selected || selected.length === 0) return [];

      // Fetch variant details + images for selected products
      const productIds = selected.map((p) => p.id);
      const productMeta = await fetchProductMeta(query, productIds);

      return selected.map((product) => {
        const meta = productMeta.get(product.id);
        return {
          id: product.id,
          title: product.title,
          handle: product.handle,
          variants: meta?.variants || [],
          imageUrl: meta?.imageUrl || undefined,
        };
      });
    } catch (e) {
      console.error('Product picker error:', e);
      return [];
    }
  }, [resourcePicker, query]);

  interface ProductMetaResult {
    variants: PickedVariant[];
    imageUrl?: string;
  }

  const fetchProductMeta = async (
    queryFn: QueryFn,
    productIds: string[]
  ): Promise<Map<string, ProductMetaResult>> => {
    const map = new Map<string, ProductMetaResult>();
    try {
      const res = await queryFn<{
        nodes?: Array<{
          id?: string;
          featuredImage?: { url?: string };
          variants?: {
            edges?: Array<{
              node?: { id?: string; title?: string; price?: string };
            }>;
          };
        } | null>;
      }>(`
        query GetProductVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              featuredImage {
                url(transform: { maxWidth: 80 })
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                  }
                }
              }
            }
          }
        }
      `, { variables: { ids: productIds } });

      if (res.data?.nodes) {
        for (const node of res.data.nodes) {
          if (node?.id && node?.variants?.edges) {
            map.set(node.id, {
              variants: node.variants.edges
                .filter((edge) => Boolean(edge?.node?.id))
                .map((edge) => ({
                  id: edge?.node?.id ?? '',
                  title: edge?.node?.title ?? '',
                  price: edge?.node?.price ?? '0',
              })),
              imageUrl: node.featuredImage?.url || undefined,
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch product meta:', e);
    }
    return map;
  };

  // Backward-compat wrapper for GroupCard hydration
  const fetchVariantsForProducts = async (
    queryFn: QueryFn,
    productIds: string[]
  ): Promise<Map<string, PickedVariant[]>> => {
    const meta = await fetchProductMeta(queryFn, productIds);
    const variantMap = new Map<string, PickedVariant[]>();
    for (const [id, data] of meta) {
      variantMap.set(id, data.variants);
    }
    return variantMap;
  };

  return { pickProducts, fetchVariantsForProducts, fetchProductMeta };
}

