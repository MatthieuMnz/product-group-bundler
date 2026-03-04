// @ts-nocheck
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
  Divider,
} from '@shopify/ui-extensions-react/admin';
import { useBundleConfig } from './hooks/useBundleConfig';

const TARGET = 'admin.product-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const api = useApi();
  const { data, i18n, navigation } = api as any;
  const productId = (data as any)?.selected?.[0]?.id || "gid://shopify/Product/0";

  const { config, isLoading } = useBundleConfig(productId);

  if (isLoading) {
    return (
      <AdminBlock title={i18n.translate('blockTitle')}>
        <BlockStack gap="base">
          <ProgressIndicator />
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
        <Box padding="base" paddingBlock="small" borderWidth="small" borderRadius="base" borderColor="subdued" background="bg-surface-secondary">
          <InlineStack blockAlignment="center" inlineAlignment="space-between">
            <BlockStack gap="extraTight">
              <InlineStack gap="small" blockAlignment="center">
                <Text fontWeight="bold">{groupCount}</Text>
                <Text appearance="subdued">
                  {groupCount === 1 ? i18n.translate('name') : i18n.translate('blockTitle')}
                </Text>
              </InlineStack>
              <Text size="small" appearance="subdued">
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
            {config?.groups.slice(0, 2).map((group, index) => (
              <Box 
                key={group.id} 
                padding="base"
                borderWidth="small"
                borderColor="subdued"
                borderRadius="base"
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
                        borderWidth="small" 
                        borderColor="subdued" 
                        borderRadius="base"
                        minBlockSize="44px"
                        minInlineSize="44px"
                        maxBlockSize="64px"
                        maxInlineSize="64px"
                        overflow="hidden"
                      >
                        {product._imageUrl ? (
                          <Image
                            source={product._imageUrl}
                            alt={product.title || ''}
                            fit="cover"
                          />
                        ) : (
                          /* Fallback placeholder */
                          <Box 
                            padding="base" 
                            minBlockSize="44px" 
                            minInlineSize="44px"
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
                <Text size="small" appearance="subdued">
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
