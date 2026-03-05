import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BundleProduct } from '../utils/types';

const t = (key: string) => shopify.i18n.translate(key);

interface ProductEntryProps {
  product: BundleProduct;
  onChange: (update: Partial<BundleProduct>) => void;
  onRemove: () => void;
}

export function ProductEntry({ product, onChange, onRemove }: ProductEntryProps) {
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

  const originalPrice = product._price ? parseFloat(product._price) : null;
  const discountValue = product.discountValue || 0;
  const bundlePrice = originalPrice !== null ? Math.max(0, originalPrice - discountValue) : null;

  return (
    <s-box background="subdued" padding="base" borderRadius="base">
      <s-stack gap="base">
        {/* Product header: thumbnail + name + remove */}
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="inline" gap="base" alignItems="center">
            {product._imageUrl ? (
              <s-thumbnail
                src={product._imageUrl}
                alt={displayName}
                size="small"
              ></s-thumbnail>
            ) : (
              <s-thumbnail alt={displayName} size="small"></s-thumbnail>
            )}
            <s-stack gap="small">
              <s-text type="strong">{displayName}</s-text>
              {hasMultipleVariants && (
                <s-badge tone="info" icon="variant">
                  {selectedVariantCount} {t('selected')}
                </s-badge>
              )}
            </s-stack>
          </s-stack>
          <s-button
            onClick={onRemove}
            tone="critical"
            variant="tertiary"
            icon="delete"
            accessibilityLabel={t('removeProduct')}
          ></s-button>
        </s-stack>

        {/* Pricing section */}
        <s-box background="base" padding="base" borderRadius="base">
          <s-stack gap="base">
            <s-text type="strong">{t('pricingSection')}</s-text>
            <s-stack direction="inline" gap="large" alignItems="start" justifyContent="space-between">
              <s-stack gap="small">
                <s-text color="subdued">{t('originalPrice')}</s-text>
                <s-text>{originalPrice !== null ? `$${originalPrice.toFixed(2)}` : '—'}</s-text>
              </s-stack>

              <s-box maxInlineSize="200px">
                <s-number-field
                  label={t('discountValue')}
                  value={String(product.discountValue ?? 0)}
                  min={0}
                  onChange={(e: any) => onChange({ discountValue: Number(e.target.value) || 0 })}
                ></s-number-field>
                {(product.discountValue || 0) <= 0 && (
                  <s-box paddingBlockStart="small">
                    <s-text color="subdued" tone="caution">{t('discountHint')}</s-text>
                  </s-box>
                )}
              </s-box>

              <s-stack gap="small">
                <s-text color="subdued">{t('bundlePrice')}</s-text>
                {bundlePrice !== null ? (
                  <s-text type={discountValue > 0 ? 'strong' : 'generic'}>
                    ${bundlePrice.toFixed(2)}
                  </s-text>
                ) : (
                  <s-text>—</s-text>
                )}
              </s-stack>
            </s-stack>
          </s-stack>
        </s-box>

        {/* Variants section */}
        {hasMultipleVariants && (
          <s-box background="base" padding="base" borderRadius="base">
            <s-stack gap="base">
              <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-text type="strong">{t('variants')}</s-text>
                  <s-badge tone="info" icon="variant">
                    {selectedVariantCount} {t('selected')}
                  </s-badge>
                </s-stack>
                <s-button
                  variant="tertiary"
                  icon={isVariantSectionOpen ? 'chevron-up' : 'chevron-down'}
                  accessibilityLabel={isVariantSectionOpen ? t('collapse') : t('expand')}
                  onClick={() => setIsVariantSectionOpen((prev) => !prev)}
                ></s-button>
              </s-stack>

              {isVariantSectionOpen && (
                <s-stack gap="small">
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
                      <s-box key={v.id} padding="small" borderRadius="small" border="base">
                        <s-stack gap="small">
                          <s-checkbox
                            label={`${v.title}${v.price ? ` — $${v.price}` : ''}`}
                            checked={isChecked}
                            onChange={(e: any) => handleVariantToggle(v.id, e.target.checked)}
                          ></s-checkbox>
                          {isChecked && (
                            <s-box paddingInlineStart="large">
                              <s-stack direction="inline" gap="base" alignItems="start" justifyContent="space-between">
                                <s-box maxInlineSize="200px">
                                  <s-number-field
                                    label={t('discountValue')}
                                    value={String(specDiscount ?? 0)}
                                    min={0}
                                    onChange={(e: any) => handleVariantDiscountChange(v.id, Number(e.target.value) || 0)}
                                  ></s-number-field>
                                </s-box>
                                {vBundlePrice !== null && (
                                  <s-stack gap="small">
                                    <s-text color="subdued">{t('bundlePrice')}</s-text>
                                    <s-text type={specDiscount > 0 ? 'strong' : 'generic'}>
                                      ${vBundlePrice.toFixed(2)}
                                    </s-text>
                                  </s-stack>
                                )}
                              </s-stack>
                            </s-box>
                          )}
                        </s-stack>
                      </s-box>
                    );
                  })}
                </s-stack>
              )}
            </s-stack>
          </s-box>
        )}
      </s-stack>
    </s-box>
  );
}
