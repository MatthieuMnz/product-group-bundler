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
        <Text>{i18n.translate('saving')}</Text>
      </AdminBlock>
    );
  }

  const handleManage = () => {
    // Navigate to the action extension
    // The handle is defined in shopify.extension.toml
    navigation.navigate('extension://bundle-config-action');
  };

  const groupCount = config?.groups.length || 0;
  const productCount = config?.groups.reduce((acc, g) => acc + g.products.length, 0) || 0;

  return (
    <AdminBlock title={i18n.translate('blockTitle')}>
      <BlockStack gap="base">
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
        
        {groupCount > 0 && (
          <InlineStack gap="extraTight">
            {config?.groups.slice(0, 3).map((group) => (
              <Badge key={group.id} tone="info">
                {group.name || i18n.translate('unnamedGroup')}
              </Badge>
            ))}
            {groupCount > 3 && (
              <Text size="small" appearance="subdued">+{groupCount - 3} more</Text>
            )}
          </InlineStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
