import { BlockStack, Button, InlineStack, Text, NumberField, Select, useApi } from '@shopify/ui-extensions-react/admin';
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
          options={[
            { label: i18n.translate('fixedAmount'), value: 'fixed_amount' },
            { label: i18n.translate('percentage'), value: 'percentage' },
          ]}
          value={product.discountType}
          onChange={(val: string) => onChange({ discountType: val as any })}
        />
        <NumberField
          label={i18n.translate('discountValue')}
          value={product.discountValue}
          onChange={(val: string | number) => onChange({ discountValue: Number(val) || 0 })}
          suffix={product.discountType === 'percentage' ? '%' : undefined}
          min={0}
        />
      </InlineStack>
    </BlockStack>
  );
}
