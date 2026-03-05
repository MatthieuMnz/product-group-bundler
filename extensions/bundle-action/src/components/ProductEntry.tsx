import { BlockStack, Box, Button, Checkbox, Divider, Image, InlineStack, Text, NumberField, useApi } from '@shopify/ui-extensions-react/admin';
import { BundleProduct } from '../utils/types';
import { useEffect, useMemo, useRef, useState } from 'react';

interface ProductEntryProps {
  product: BundleProduct;
  onChange: (update: Partial<BundleProduct>) => void;
  onRemove: () => void;
}

export function ProductEntry({ product, onChange, onRemove }: ProductEntryProps) {
  const { i18n } = useApi();
  const displayName = product.title || product.handle || product.productId;
  const hasVariantRestriction = Array.isArray(product.variantIds) && product.variantIds.length > 0;
  const [isVariantSectionOpen, setIsVariantSectionOpen] = useState(false);
  const initializedProductRef = useRef<string | null>(null);

  const handleVariantToggle = (variantId: string, checked: boolean) => {
    const current = Array.isArray(product.variantIds) ? product.variantIds : [];
    const currentDiscounts = Array.isArray(product.variantDiscounts) ? product.variantDiscounts : [];
    if (checked) {
      if (current.includes(variantId)) return;
      onChange({ variantIds: [...current, variantId] });
    } else {
      if (current.length <= 1) return;
      onChange({ 
        variantIds: current.filter(id => id !== variantId),
        variantDiscounts: currentDiscounts.filter(vd => vd.id !== variantId)
      });
    }
  };

  const handleVariantDiscountChange = (variantId: string, value: number) => {
    const currentDiscounts = Array.isArray(product.variantDiscounts) ? [...product.variantDiscounts] : [];
    const index = currentDiscounts.findIndex(vd => vd.id === variantId);
    if (index >= 0) {
      currentDiscounts[index] = { id: variantId, discountValue: value };
    } else {
      currentDiscounts.push({ id: variantId, discountValue: value });
    }
    onChange({ variantDiscounts: currentDiscounts });
  };

  const variants = useMemo(() => product._variants || [], [product._variants]);
  const hasMultipleVariants = variants.length > 1;
  const selectedVariantIds = Array.isArray(product.variantIds) ? product.variantIds : [];
  const selectedVariantCount = selectedVariantIds.length;

  useEffect(() => {
    if (!hasMultipleVariants || variants.length === 0) return;
    if (initializedProductRef.current === product.productId) return;
    initializedProductRef.current = product.productId;

    if (!hasVariantRestriction) {
      onChange({ variantIds: variants.map((variant) => variant.id) });
    }
  }, [hasMultipleVariants, hasVariantRestriction, onChange, product.productId, variants]);

  // Calculate price preview
  const originalPrice = product._price ? parseFloat(product._price) : null;
  const discountValue = product.discountValue || 0;
  const bundlePrice = originalPrice !== null ? Math.max(0, originalPrice - discountValue) : null;

  return (
    <Box padding="base">
      <BlockStack gap="base">
        <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
          <InlineStack gap="base" blockAlignment="center">
            {product._imageUrl ? (
              <Box minInlineSize={44} minBlockSize={44} maxInlineSize={64} maxBlockSize={64}>
                <Image
                  source={product._imageUrl}
                  alt={displayName}
                />
              </Box>
            ) : (
              <Box minInlineSize={44} minBlockSize={44} maxInlineSize={64} maxBlockSize={64} padding="base" />
            )}
            <BlockStack gap="small">
              <Text fontWeight="bold">{displayName}</Text>
            </BlockStack>
          </InlineStack>
          <Button onClick={onRemove} tone="critical" variant="tertiary">
            {i18n.translate('removeProduct') || 'Remove'}
          </Button>
        </InlineStack>

        <Divider />

        <Box padding="small">
          <BlockStack gap="base">
            <InlineStack gap="large" blockAlignment="start" inlineAlignment="space-between">
              <BlockStack gap="small">
                <Text>{i18n.translate('originalPrice') || 'Original price'}</Text>
                <Text>{originalPrice !== null ? `$${originalPrice.toFixed(2)}` : '-'}</Text>
              </BlockStack>

              <Box maxInlineSize={220}>
                <NumberField
                  label={i18n.translate('discountValue') || 'Discount'}
                  value={product.discountValue}
                  onChange={(val) => onChange({ discountValue: Number(val) || 0 })}
                  min={0}
                />
              </Box>

              <BlockStack gap="small">
                <Text>{i18n.translate('bundlePrice') || 'Bundle price'}</Text>
                {bundlePrice !== null ? (
                  <Text fontWeight={discountValue > 0 ? 'bold' : 'normal'}>
                    ${bundlePrice.toFixed(2)}
                  </Text>
                ) : (
                  <Text>-</Text>
                )}
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Box>

        {hasMultipleVariants && (
          <Box>
            <Divider />
          </Box>
        )}

        {hasMultipleVariants && (
          <Box padding="small">
            <BlockStack gap="base">
              <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
                <BlockStack gap="small">
                  <Text fontWeight="bold">{i18n.translate('variants') || 'Variants'}</Text>
                  <Text>
                    {i18n.translate('variantsSelectedCount', {
                      count: selectedVariantCount,
                    }) || `${selectedVariantCount} selected`}
                  </Text>
                </BlockStack>
                <Button variant="tertiary" onClick={() => setIsVariantSectionOpen((prev) => !prev)}>
                  {isVariantSectionOpen
                    ? (i18n.translate('collapse') || 'Collapse')
                    : (i18n.translate('expand') || 'Expand')}
                </Button>
              </InlineStack>

              {isVariantSectionOpen && (
                <BlockStack gap="base">
                  {variants.map(v => {
                    const isChecked = selectedVariantIds.includes(v.id);

                    let specDiscount = product.discountValue;
                    if (Array.isArray(product.variantDiscounts)) {
                      const found = product.variantDiscounts.find(vd => vd.id === v.id);
                      if (found) specDiscount = found.discountValue;
                    }

                    const vPrice = v.price ? parseFloat(v.price) : null;
                    const vBundlePrice = vPrice !== null ? Math.max(0, vPrice - specDiscount) : null;

                    return (
                      <Box key={v.id} padding="base">
                        <BlockStack gap="small">
                          <Checkbox
                            label={`${v.title}${v.price ? ` — $${v.price}` : ''}`}
                            checked={isChecked}
                            onChange={(checked: boolean) => handleVariantToggle(v.id, checked)}
                          />
                          {isChecked && (
                            <Box paddingInlineStart="large">
                              <InlineStack gap="base" blockAlignment="start" inlineAlignment="space-between">
                                <Box maxInlineSize={220}>
                                  <NumberField
                                    label={i18n.translate('discountValue') || 'Discount'}
                                    value={specDiscount}
                                    onChange={(val) => handleVariantDiscountChange(v.id, Number(val) || 0)}
                                    min={0}
                                  />
                                </Box>
                                {vBundlePrice !== null && (
                                  <BlockStack gap="small">
                                    <Text>{i18n.translate('bundlePrice') || 'Bundle price'}</Text>
                                    <Text fontWeight={specDiscount > 0 ? 'bold' : 'normal'}>
                                      ${vBundlePrice.toFixed(2)}
                                    </Text>
                                  </BlockStack>
                                )}
                              </InlineStack>
                            </Box>
                          )}
                          <Divider />
                        </BlockStack>
                      </Box>
                    );
                  })}
                </BlockStack>
              )}
            </BlockStack>
          </Box>
        )}
      </BlockStack>
    </Box>
  );
}
