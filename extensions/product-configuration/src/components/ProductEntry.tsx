import { BlockStack, Button, InlineStack, Select, Text, NumberField } from '@shopify/ui-extensions-react/admin';
import { BundleProduct } from '../utils/types';

interface ProductEntryProps {
  product: BundleProduct;
  onChange: (update: Partial<BundleProduct>) => void;
  onRemove: () => void;
}

export function ProductEntry({ product, onChange, onRemove }: ProductEntryProps) {
  const displayName = product.title || product.handle || product.productId;

  return (
    <BlockStack gap="base">
      <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
        <Text fontWeight="bold">{displayName}</Text>
        <Button onClick={onRemove} tone="critical">Remove</Button>
      </InlineStack>

      <InlineStack gap="base" blockAlignment="end">
        <Select
          label="Discount Type"
          value={product.discountType}
          options={[
            { label: 'Amount off ($)', value: 'fixed_amount' },
            { label: 'Percentage off (%)', value: 'percentage' }
          ]}
          onChange={(val: string) => onChange({ discountType: val as any })}
        />
        <NumberField
          label="Discount Value"
          value={product.discountValue}
          onChange={(val: string | number) => onChange({ discountValue: Number(val) || 0 })}
          min={0}
        />
      </InlineStack>
    </BlockStack>
  );
}
