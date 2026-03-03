import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@shopify/ui-extensions-react/admin';
import { BundleConfig } from '../utils/types';

export function useBundleConfig(productId: string) {
  const { query } = useApi();
  const [config, setConfig] = useState<BundleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appNamespaceRef = useRef<string | null>(null);

  const getNamespace = async () => {
    if (appNamespaceRef.current) return appNamespaceRef.current;
    
    // Fetch the app ID to construct the proper namespace (app--APP_ID)
    const appRes = await query<any>(`
      query {
        app {
          id
        }
      }
    `);
    
    const appIdGid = appRes.data?.app?.id;
    if (appIdGid) {
      // Extract the numerical ID from gid://shopify/App/123456
      const numericId = appIdGid.split('/').pop();
      appNamespaceRef.current = `app--${numericId}`;
    } else {
      // Fallback
      appNamespaceRef.current = "app--product-group-bundler"; 
    }
    
    return appNamespaceRef.current;
  };

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const namespace = await getNamespace();
      const res = await query<any>(`
        query GetBundleGroups($productId: ID!, $namespace: String!) {
          product(id: $productId) {
            metafield(namespace: $namespace, key: "bundle_groups") {
              id
              value
            }
          }
        }`, { variables: { productId, namespace } });
        
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
      const namespace = await getNamespace();
      const res = await query<any>(`
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              value
            }
            userErrors {
              field
              message
            }
          }
        }`, {
          variables: {
            metafields: [
              {
                ownerId: productId,
                namespace: namespace,
                key: "bundle_groups",
                type: "json",
                value: JSON.stringify(newConfig)
              }
            ]
          }
        });
      
      if (res.data?.metafieldsSet?.userErrors?.length) {
        throw new Error(res.data.metafieldsSet.userErrors[0].message);
      }
      setConfig(newConfig);
    } catch (e) {
      console.error("Failed to save config", e);
      throw e;
    }
  };

  return { config, isLoading, saveConfig, setConfig };
}
