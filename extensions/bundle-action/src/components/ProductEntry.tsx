// @ts-nocheck
import { BlockStack, Box, Button, Checkbox, Image, InlineStack, Text, NumberField, Divider, useApi } from '@shopify/ui-extensions-react/admin';
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

  // Calculate price preview
  const originalPrice = product._price ? parseFloat(product._price) : null;
  const discountValue = product.discountValue || 0;
  const bundlePrice = originalPrice !== null ? Math.max(0, originalPrice - discountValue) : null;

  return (
    <Box padding="base" borderWidth="small" borderRadius="base" borderColor="subdued">
      <BlockStack gap="base">
        {/* Product header row: thumbnail + info + remove */}
        <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
          <InlineStack gap="base" blockAlignment="center">
            {/* Product thumbnail */}
            {product._imageUrl ? (
              <Box borderWidth="small" borderRadius="base" borderColor="subdued" minInlineSize="44px" minBlockSize="44px" maxInlineSize="64px" maxBlockSize="64px" overflow="hidden">
                <Image
                  source={product._imageUrl}
                  alt={displayName}
                  fit="cover"
                />
              </Box>
            ) : (
              <Box borderWidth="small" borderRadius="base" borderColor="subdued" minInlineSize="44px" minBlockSize="44px" maxInlineSize="64px" maxBlockSize="64px" padding="base" />
            )}
            {/* Product info */}
            <BlockStack gap="extraTight">
              <Text fontWeight="bold">{displayName}</Text>
            </BlockStack>
          </InlineStack>
          <Button onClick={onRemove} tone="critical" variant="tertiary">✕</Button>
        </InlineStack>

        {/* Pricing & Discount row */}
        <Box paddingBlockStart="small">
          <InlineStack gap="large" blockAlignment="center" inlineAlignment="start">
            <BlockStack gap="extraTight">
              <Text size="small" appearance="subdued">{i18n.translate('originalPrice') || 'Original price'}</Text>
              <Text>{originalPrice !== null ? `$${originalPrice.toFixed(2)}` : '-'}</Text>
            </BlockStack>
            
            <Box maxInlineSize="120px">
              <NumberField
                label={i18n.translate('discountValue') || 'Discount'}
                value={product.discountValue}
                onChange={(val: string | number) => onChange({ discountValue: Number(val) || 0 })}
                min={0}
              />
            </Box>

            <BlockStack gap="extraTight">
              <Text size="small" appearance="subdued">{i18n.translate('bundlePrice') || 'Bundle price'}</Text>
              {bundlePrice !== null ? (
                <Text appearance={discountValue > 0 ? 'success' : 'default'} fontWeight={discountValue > 0 ? 'bold' : 'normal'}>
                  ${bundlePrice.toFixed(2)}
                </Text>
              ) : (
                <Text>-</Text>
              )}
            </BlockStack>
          </InlineStack>
        </Box>

        {/* Variant section */}
        {hasMultipleVariants && (
          <Box paddingBlockStart="base">
            <Box padding="base" borderWidth="small" borderRadius="base" borderColor="subdued" background="bg-surface-secondary">
              <BlockStack gap="base">
                <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
                  <Text fontWeight="bold" size="small">{i18n.translate('variants') || 'Variants'}</Text>
                  <InlineStack gap="tight">
                    <Button
                      variant={!showVariantPicker ? 'primary' : 'secondary'}
                      onClick={() => handleToggleVariantMode(true)}
                    >
                      {i18n.translate('variantsAll') || 'All variants'}
                    </Button>
                    <Button
                      variant={showVariantPicker ? 'primary' : 'secondary'}
                      onClick={() => handleToggleVariantMode(false)}
                    >
                      {i18n.translate('variantsSelect') || 'Specific variants'}
                    </Button>
                  </InlineStack>
                </InlineStack>

                {showVariantPicker && (
                  <Box paddingBlockStart="small" paddingInlineStart="base">
                    <BlockStack gap="tight">
                      {variants.map(v => (
                        <Checkbox
                          key={v.id}
                          label={`${v.title}${v.price ? ` — $${v.price}` : ''}`}
                          checked={product.variantIds?.includes(v.id) || false}
                          onChange={(checked: boolean) => handleVariantToggle(v.id, checked)}
                        />
                      ))}
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Box>
          </Box>
        )}
      </BlockStack>
    </Box>
  );
}
