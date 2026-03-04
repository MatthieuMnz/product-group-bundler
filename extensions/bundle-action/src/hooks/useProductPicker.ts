// @ts-nocheck
import { useApi } from '@shopify/ui-extensions-react/admin';
import { useCallback } from 'react';

const TARGET = 'admin.product-details.block.render';

interface PickedProduct {
  id: string;
  title: string;
  handle: string;
}

export function useProductPicker() {
  const { resourcePicker } = useApi(TARGET as any);

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

      if (!selected) return []; // User cancelled

      return selected.map((product: any) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
      }));
    } catch (e) {
      console.error('Product picker error:', e);
      return [];
    }
  }, [resourcePicker]);

  return { pickProducts };
}
