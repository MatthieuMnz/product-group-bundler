// @ts-nocheck
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

export function useProductPicker() {
  const { resourcePicker, query } = useApi();

  const pickProducts = useCallback(async (selectedIds: string[] = []): Promise<PickedProduct[]> => {
    try {
      const selected = await (resourcePicker as any)({
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
      const productIds = selected.map((p: any) => p.id);
      const productMeta = await fetchProductMeta(query, productIds);

      return selected.map((product: any) => {
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
    queryFn: any,
    productIds: string[]
  ): Promise<Map<string, ProductMetaResult>> => {
    const map = new Map<string, ProductMetaResult>();
    try {
      const res = await queryFn(`
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
              variants: node.variants.edges.map((e: any) => ({
                id: e.node.id,
                title: e.node.title,
                price: e.node.price,
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
    queryFn: any,
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

