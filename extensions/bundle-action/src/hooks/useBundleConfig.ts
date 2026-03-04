import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@shopify/ui-extensions-react/admin';
import { BundleConfig, BundleProduct } from '../utils/types';

export function useBundleConfig(productId: string) {
  const { query } = useApi();
  const [config, setConfig] = useState<BundleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
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

  const saveConfig = useCallback(async (newConfig: BundleConfig, isSilentAutoSave = false) => {
    if (!isSilentAutoSave) setIsSaving(true);
    setError(null);
    try {
      const namespace = await getNamespace();
      // Strip transient fields (like _variants) before saving
      const cleanConfig: BundleConfig = {
        ...newConfig,
        groups: newConfig.groups.map(g => ({
          ...g,
          products: g.products.map(p => {
            const { _variants, ...rest } = p as any;
            return rest as BundleProduct;
          }),
        })),
      };
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
                value: JSON.stringify(cleanConfig)
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
      setError(e as Error);
      throw e;
    } finally {
      if (!isSilentAutoSave) setIsSaving(false);
    }
  }, [productId, query]);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
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
        let parsedConfig = JSON.parse(res.data.product.metafield.value) as BundleConfig;
        
        // Auto-resolve missing handles
        const productsMissingHandles = [];
        for (const group of parsedConfig.groups) {
          for (const product of group.products) {
            if (!product.handle) {
              productsMissingHandles.push(product);
            }
          }
        }

        if (productsMissingHandles.length > 0) {
          setIsResolving(true);
          const idsToFetch = productsMissingHandles.map(p => `"${p.productId}"`).join(', ');
          try {
            const handleRes = await query<any>(`
              query GetHandles {
                nodes(ids: [${idsToFetch}]) {
                  ... on Product {
                    id
                    handle
                    title
                  }
                }
              }
            `);

            const handleMap = new Map();
            if (handleRes.data?.nodes) {
              handleRes.data.nodes.forEach((node: any) => {
                if (node && node.id) handleMap.set(node.id, { handle: node.handle, title: node.title });
              });
            }

            let needsSave = false;
            parsedConfig = {
              ...parsedConfig,
              groups: parsedConfig.groups.map(g => ({
                ...g,
                products: g.products.map(p => {
                  if (!p.handle && handleMap.has(p.productId)) {
                    needsSave = true;
                    const resolved = handleMap.get(p.productId);
                    return { ...p, handle: resolved.handle, title: resolved.title || p.title };
                  }
                  return p;
                })
              }))
            };

            // Silently save the resolved handles back to the metafield
            if (needsSave) {
              await saveConfig(parsedConfig, true);
            }
          } catch (resolveError) {
            console.error("Failed to auto-resolve handles:", resolveError);
          } finally {
            setIsResolving(false);
          }
        }
        
        setConfig(parsedConfig);
      } else {
        setConfig({ version: 1, groups: [] });
      }
    } catch (e) {
      console.error(e);
      setError(e as Error);
      setConfig({ version: 1, groups: [] });
    } finally {
      setIsLoading(false);
    }
  }, [productId, query, saveConfig]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, isLoading, isSaving, isResolving, error, saveConfig, setConfig };
}
