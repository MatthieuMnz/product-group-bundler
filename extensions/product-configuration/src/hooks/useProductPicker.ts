import { useApi } from '@shopify/ui-extensions-react/admin';
import { useCallback } from 'react';

export function useProductPicker() {
  const { intents } = useApi();

  const pickProducts = useCallback(async (selectedIds: string[] = []) => {
    try {
      const result = await (intents as any).launchUrl('shopify:admin/pickers/products', {
        selectionIds: selectedIds,
        multiple: true,
      });

      if (result?.selection) {
        return result.selection as { id: string; title: string; handle: string }[];
      }
    } catch (e) {
      console.error(e);
      return [];
    }
    return [];
  }, [intents]);

  return { pickProducts };
}
