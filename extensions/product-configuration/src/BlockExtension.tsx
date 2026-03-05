import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Button,
  InlineStack,
  Text,
  Badge,
  ProgressIndicator,
  Box,
  Image,
} from '@shopify/ui-extensions-react/admin';
import { useBundleConfig } from './hooks/useBundleConfig';

const TARGET = 'admin.product-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const api = useApi();
  const { data, i18n, navigation } = api as Record<string, any>;
  const productId = (data as Record<string, any>)?.selected?.[0]?.id || "gid://shopify/Product/0";

  const { config, isLoading } = useBundleConfig(productId);

  if (isLoading) {
    return (
      <AdminBlock title={i18n.translate('blockTitle')}>
        <BlockStack gap="base">
          <ProgressIndicator size="base" />
        </BlockStack>
      </AdminBlock>
    );
  }

  const handleManage = () => {
    // Navigate to the action extension using the defined handle in shopify.extension.toml
    navigation.navigate('extension://bundle-config-action');
  };

  const groupCount = config?.groups.length || 0;
  const productCount = config?.groups.reduce((acc, g) => acc + g.products.length, 0) || 0;

  return (
    <AdminBlock title={i18n.translate('blockTitle')}>
      <BlockStack gap="base">
        {/* Top-level summary */}
        <Box padding="base" paddingBlock="small">
          <InlineStack blockAlignment="center" inlineAlignment="space-between">
            <BlockStack gap="small">
              <InlineStack gap="small" blockAlignment="center">
                <Text fontWeight="bold">{groupCount}</Text>
                <Text>
                  {groupCount === 1 ? i18n.translate('name') : i18n.translate('blockTitle')}
                </Text>
              </InlineStack>
              <Text>
                {productCount} {productCount === 1 ? i18n.translate('product') : i18n.translate('products')}
              </Text>
            </BlockStack>
            
            <Button onClick={handleManage}>
              {i18n.translate('manageBundles')}
            </Button>
          </InlineStack>
        </Box>
        
        {/* Detailed group previews */}
        {groupCount > 0 && (
          <BlockStack gap="base">
            {config?.groups.slice(0, 2).map((group) => (
              <Box 
                key={group.id} 
                padding="base"
              >
                
                <BlockStack gap="small">
                  <InlineStack blockAlignment="center" inlineAlignment="space-between">
                    <Text fontWeight="bold">{group.name || i18n.translate('unnamedGroup')}</Text>
                    <Badge tone="info">{group.products.length}</Badge>
                  </InlineStack>
                  
                  {/* Product thumbnails container */}
                  <InlineStack gap="base" blockAlignment="center">
                    {group.products.slice(0, 3).map((product, pIdx) => (
                      <Box 
                        key={`${group.id}-p-${pIdx}`} 
                        minBlockSize={44}
                        minInlineSize={44}
                        maxBlockSize={64}
                        maxInlineSize={64}
                      >
                        {(product as Record<string, any>)._imageUrl ? (
                          <Image
                            source={(product as Record<string, any>)._imageUrl}
                            alt={(product as Record<string, any>).title || ''}
                          />
                        ) : (
                          /* Fallback placeholder */
                          <Box 
                            padding="base" 
                            minBlockSize={44} 
                            minInlineSize={44}
                          />
                        )}
                      </Box>
                    ))}
                    
                    {group.products.length > 3 && (
                      <Badge tone="info">+{group.products.length - 3}</Badge>
                    )}
                  </InlineStack>
                </BlockStack>
              </Box>
            ))}
            
            {groupCount > 2 && (
              <Box paddingBlockStart="base">
                <Text>
                  +{groupCount - 2} more groups
                </Text>
              </Box>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
