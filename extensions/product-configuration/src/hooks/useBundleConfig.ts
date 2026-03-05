import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@shopify/ui-extensions-react/admin';
import { BundleConfig } from '../utils/types';

export function useBundleConfig(productId: string) {
  const { query } = useApi();
  const [config, setConfig] = useState<BundleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appNamespaceRef = useRef<string | null>(null);

  const getNamespace = useCallback(async () => {
    if (appNamespaceRef.current) return appNamespaceRef.current;
    
    // Fetch the app ID to construct the proper namespace (app--APP_ID)
    const appRes = await query<Record<string, any>>(`
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
  }, [query]);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const namespace = await getNamespace();
      
      // 1. Fetch the metafield config first
      const res = await query<Record<string, any>>(`
        query GetBundleGroups($productId: ID!, $namespace: String!) {
          product(id: $productId) {
            metafield(namespace: $namespace, key: "bundle_groups") {
              id
              value
            }
          }
        }`, { variables: { productId, namespace } });
        
      if (res.data?.product?.metafield?.value) {
        const parsedConfig = JSON.parse(res.data.product.metafield.value);
        
        // 2. Extract up to 3 product IDs from EACH of the first 2 groups to fetch images for the preview
        const previewGids: string[] = [];
        parsedConfig.groups.slice(0, 2).forEach((g: Record<string, any>) => {
          g.products.slice(0, 3).forEach((p: Record<string, any>) => previewGids.push(p.productId));
        });
        
        if (previewGids.length > 0) {
          const imageRes = await query<Record<string, any>>(`
            query GetProductImages($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on Product {
                  id
                  title
                  featuredImage {
                    url(transform: { maxWidth: 80 })
                  }
                }
              }
            }`, { variables: { ids: previewGids } });
            
          if (imageRes.data?.nodes) {
            const imageMap = new Map<string, { title: string, imageUrl?: string }>();
            imageRes.data.nodes.forEach((node: Record<string, any>) => {
              if (node && node.id) {
                imageMap.set(node.id, {
                  title: node.title,
                  imageUrl: node.featuredImage?.url
                });
              }
            });
            
            // 3. Hydrate the config with images for the preview
            parsedConfig.groups = parsedConfig.groups.map((g: Record<string, any>) => ({
              ...g,
              products: g.products.map((p: Record<string, any>) => {
                const meta = imageMap.get(p.productId);
                return {
                  ...p,
                  _imageUrl: meta?.imageUrl,
                  title: p.title || meta?.title
                };
              })
            }));
          }
        }
        
        setConfig(parsedConfig);
      } else {
        setConfig({ version: 1, groups: [] });
      }
    } catch (e) {
      console.error(e);
      setConfig({ version: 1, groups: [] });
    } finally {
      setIsLoading(false);
    }
  }, [productId, query, getNamespace]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async (newConfig: BundleConfig) => {
    try {
      const namespace = await getNamespace();
      const res = await query<Record<string, any>>(`
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
