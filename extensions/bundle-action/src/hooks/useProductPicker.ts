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

      // Fetch variant details for selected products
      const productIds = selected.map((p: any) => p.id);
      const variantMap = await fetchVariantsForProducts(query, productIds);

      return selected.map((product: any) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        variants: variantMap.get(product.id) || [],
      }));
    } catch (e) {
      console.error('Product picker error:', e);
      return [];
    }
  }, [resourcePicker, query]);

  const fetchVariantsForProducts = async (
    queryFn: any,
    productIds: string[]
  ): Promise<Map<string, PickedVariant[]>> => {
    const map = new Map<string, PickedVariant[]>();
    try {
      const ids = productIds.map(id => `"${id}"`).join(', ');
      const res = await queryFn(`
        query GetProductVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
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
            map.set(
              node.id,
              node.variants.edges.map((e: any) => ({
                id: e.node.id,
                title: e.node.title,
                price: e.node.price,
              }))
            );
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch variants:', e);
    }
    return map;
  };

  return { pickProducts, fetchVariantsForProducts };
}

