import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@shopify/ui-extensions-react/admin';
import { BundleConfig } from '../utils/types';

export function useBundleConfig(productId: string) {
  const { query } = useApi();
  const [config, setConfig] = useState<BundleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await query<any>(`
        query GetBundleGroups($productId: ID!) {
          product(id: $productId) {
            metafield(namespace: "app--product-group-bundler", key: "bundle_groups") {
              id
              value
            }
          }
        }`, { variables: { productId } });
        
      if (res.data?.product?.metafield?.value) {
        setConfig(JSON.parse(res.data.product.metafield.value));
      } else {
        setConfig({ version: 1, groups: [] });
      }
    } catch (e) {
      console.error(e);
      setConfig({ version: 1, groups: [] });
    } finally {
      setIsLoading(false);
    }
  }, [productId, query]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async (newConfig: BundleConfig) => {
    try {
      const res = await query<any>(`
        mutation SaveBundleGroups($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors {
              field
              message
            }
          }
        }`, {
          variables: {
            input: {
              id: productId,
              metafields: [
                {
                  namespace: "app--product-group-bundler",
                  key: "bundle_groups",
                  type: "json",
                  value: JSON.stringify(newConfig)
                }
              ]
            }
          }
        });
      
      if (res.data?.productUpdate?.userErrors?.length) {
        throw new Error(res.data.productUpdate.userErrors[0].message);
      }
      setConfig(newConfig);
    } catch (e) {
      console.error("Failed to save config", e);
      throw e;
    }
  };

  return { config, isLoading, saveConfig, setConfig };
}
