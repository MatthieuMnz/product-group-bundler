import { BlockStack, Button, InlineStack, Select, Text, TextField, NumberField } from '@shopify/ui-extensions-react/admin';
import { BundleProduct } from '../utils/types';

interface ProductEntryProps {
  product: BundleProduct;
  onChange: (update: Partial<BundleProduct>) => void;
  onRemove: () => void;
}

export function ProductEntry({ product, onChange, onRemove }: ProductEntryProps) {
  return (
    <BlockStack gap="base">
      <TextField 
        label="Product Handle (Temporary till picker enabled)"
        value={product.handle || ''}
        onChange={(val: string) => onChange({ handle: val, productId: `gid://shopify/Product/${val}` })}
      />
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
        <Button onClick={onRemove} tone="critical">Remove</Button>
      </InlineStack>
    </BlockStack>
  );
}
