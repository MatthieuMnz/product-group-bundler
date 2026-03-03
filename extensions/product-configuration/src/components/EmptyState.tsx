import { BlockStack, Button, Text } from '@shopify/ui-extensions-react/admin';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <BlockStack inlineAlignment="center" gap="base">
      <Text>No bundle groups configured yet.</Text>
      <Button onClick={onAdd}>Add Bundle Group</Button>
    </BlockStack>
  );
}
