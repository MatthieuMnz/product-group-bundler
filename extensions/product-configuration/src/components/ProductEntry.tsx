import { BlockStack, Button, InlineStack, Select, Text, NumberField, useApi } from '@shopify/ui-extensions-react/admin';
import { BundleProduct } from '../utils/types';

interface ProductEntryProps {
  product: BundleProduct;
  onChange: (update: Partial<BundleProduct>) => void;
  onRemove: () => void;
}

export function ProductEntry({ product, onChange, onRemove }: ProductEntryProps) {
  const { i18n } = useApi();
  const displayName = product.title || product.handle || product.productId;

  return (
    <BlockStack gap="small">
      <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
        <Text fontWeight="bold">{displayName}</Text>
        <Button onClick={onRemove} tone="critical">✕</Button>
      </InlineStack>

      <InlineStack gap="base" blockAlignment="end">
        <Select
          label={i18n.translate('discountType')}
          value={product.discountType}
          options={[
            { label: i18n.translate('discountFixed'), value: 'fixed_amount' },
            { label: i18n.translate('discountPercentage'), value: 'percentage' }
          ]}
          onChange={(val: string) => onChange({ discountType: val as any })}
        />
        <NumberField
          label={i18n.translate('discountValue')}
          value={product.discountValue}
          onChange={(val: string | number) => onChange({ discountValue: Number(val) || 0 })}
          min={0}
        />
      </InlineStack>
    </BlockStack>
  );
}
