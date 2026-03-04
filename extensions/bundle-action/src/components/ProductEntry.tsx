// @ts-nocheck
import { BlockStack, Button, Checkbox, InlineStack, Text, NumberField, useApi } from '@shopify/ui-extensions-react/admin';
import { BundleProduct } from '../utils/types';
import { useState } from 'react';

interface ProductEntryProps {
  product: BundleProduct;
  onChange: (update: Partial<BundleProduct>) => void;
  onRemove: () => void;
}

export function ProductEntry({ product, onChange, onRemove }: ProductEntryProps) {
  const { i18n } = useApi();
  const displayName = product.title || product.handle || product.productId;
  const hasVariantRestriction = product.variantIds && product.variantIds.length > 0;
  const [showVariantPicker, setShowVariantPicker] = useState(hasVariantRestriction);

  const handleToggleVariantMode = (useAll: boolean) => {
    if (useAll) {
      setShowVariantPicker(false);
      onChange({ variantIds: [] });
    } else {
      setShowVariantPicker(true);
    }
  };

  const handleVariantToggle = (variantId: string, checked: boolean) => {
    const current = product.variantIds || [];
    if (checked) {
      onChange({ variantIds: [...current, variantId] });
    } else {
      onChange({ variantIds: current.filter(id => id !== variantId) });
    }
  };

  const variants = product._variants || [];
  const hasMultipleVariants = variants.length > 1;

  return (
    <BlockStack gap="small">
      <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
        <Text fontWeight="bold">{displayName}</Text>
        <Button onClick={onRemove} tone="critical">✕</Button>
      </InlineStack>

      <InlineStack gap="base" blockAlignment="end">
        <NumberField
          label={i18n.translate('discountValue')}
          value={product.discountValue}
          onChange={(val: string | number) => onChange({ discountValue: Number(val) || 0 })}
          min={0}
        />
      </InlineStack>

      {hasMultipleVariants && (
        <BlockStack gap="small">
          <Text fontWeight="bold" size="small">{i18n.translate('variants')}</Text>
          <InlineStack gap="base">
            <Button
              variant={!showVariantPicker ? 'primary' : 'secondary'}
              size="small"
              onClick={() => handleToggleVariantMode(true)}
            >
              {i18n.translate('variantsAll')}
            </Button>
            <Button
              variant={showVariantPicker ? 'primary' : 'secondary'}
              size="small"
              onClick={() => handleToggleVariantMode(false)}
            >
              {i18n.translate('variantsSelect')}
            </Button>
          </InlineStack>

          {showVariantPicker && (
            <BlockStack gap="extraTight">
              {variants.map(v => (
                <Checkbox
                  key={v.id}
                  label={`${v.title}${v.price ? ` — $${v.price}` : ''}`}
                  checked={product.variantIds?.includes(v.id) || false}
                  onChange={(checked: boolean) => handleVariantToggle(v.id, checked)}
                />
              ))}
            </BlockStack>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}

