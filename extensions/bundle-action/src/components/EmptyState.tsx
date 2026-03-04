// @ts-nocheck
import { BlockStack, Box, Button, Text, Icon, useApi } from '@shopify/ui-extensions-react/admin';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { i18n } = useApi();

  return (
    <Box padding="large">
      <BlockStack inlineAlignment="center" gap="base">
        <Icon name="ProductsFilledMinor" />
        <Text fontWeight="bold">{i18n.translate('noGroups').split('.')[0]}.</Text>
        <Text appearance="subdued" size="small">
          {i18n.translate('emptyStateDescription')}
        </Text>
        <Box paddingBlockStart="base">
          <Button variant="primary" onClick={onAdd}>{i18n.translate('addGroup')}</Button>
        </Box>
      </BlockStack>
    </Box>
  );
}
