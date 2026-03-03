// @ts-nocheck
import { BlockStack, Button, Text, useApi } from '@shopify/ui-extensions-react/admin';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { i18n } = useApi();

  return (
    <BlockStack inlineAlignment="center" gap="base">
      <Text>{i18n.translate('noGroups')}</Text>
      <Button onClick={onAdd}>{i18n.translate('addGroup')}</Button>
    </BlockStack>
  );
}
