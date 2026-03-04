// @ts-nocheck
import { BlockStack, Button, InlineStack, Text, TextField, Divider } from '@shopify/ui-extensions-react/admin';
import { BundleGroup, BundleProduct } from '../utils/types';
import { ProductEntry } from './ProductEntry';
import { useProductPicker } from '../hooks/useProductPicker';
import { useApi } from '@shopify/ui-extensions-react/admin';
import { useEffect } from 'react';

interface GroupCardProps {
  group: BundleGroup;
  currentProductId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (update: Partial<BundleGroup>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function GroupCard({ group, currentProductId, isExpanded, onToggle, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: GroupCardProps) {
  const { i18n, query } = useApi();
  const { pickProducts, fetchVariantsForProducts } = useProductPicker();

  // Hydrate variant data for products that don't have _variants loaded yet
  useEffect(() => {
    if (!isExpanded) return;
    const productsNeedingVariants = group.products.filter(p => !p._variants);
    if (productsNeedingVariants.length === 0) return;

    const productIds = productsNeedingVariants.map(p => p.productId);
    fetchVariantsForProducts(query, productIds).then(variantMap => {
      const updatedProducts = group.products.map(p => {
        if (!p._variants && variantMap.has(p.productId)) {
          return { ...p, _variants: variantMap.get(p.productId) };
        }
        return p;
      });
      onChange({ products: updatedProducts });
    });
  }, [isExpanded]);

  const handleProductChange = (index: number, update: Partial<BundleProduct>) => {
    const products = [...group.products];
    products[index] = { ...products[index], ...update };
    onChange({ products });
  };

  const handleProductRemove = (index: number) => {
    const products = [...group.products];
    products.splice(index, 1);
    onChange({ products });
  };

  const handleAddProduct = async () => {
    const existingIds = group.products.map(p => p.productId);
    const selected = await pickProducts(existingIds);
    if (!selected || selected.length === 0) return;

    const newProducts: BundleProduct[] = selected
      .filter(p => p.id !== currentProductId)
      .filter(p => !existingIds.includes(p.id))
      .map(p => ({
        productId: p.id,
        handle: p.handle,
        title: p.title,
        variantIds: [],
        discountValue: 0,
        _variants: p.variants,
      }));

    if (newProducts.length === 0) return;

    onChange({ products: [...group.products, ...newProducts] });
  };

  // Reordering controls
  const ReorderButtons = () => (
    <InlineStack gap="tight" blockAlignment="center">
      <Button variant="tertiary" disabled={isFirst} onClick={onMoveUp}>▲</Button>
      <Button variant="tertiary" disabled={isLast} onClick={onMoveDown}>▼</Button>
    </InlineStack>
  );

  // Collapsed: compact summary row
  if (!isExpanded) {
    return (
      <BlockStack gap="extraTight">
        <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
          <InlineStack gap="base" blockAlignment="center">
            <Button variant="tertiary" onClick={onToggle}>▸</Button>
            <ReorderButtons />
            <Text fontWeight="bold">{group.name || i18n.translate('unnamedGroup')}</Text>
          </InlineStack>
          <Text appearance="subdued">{group.products.length} {group.products.length !== 1 ? i18n.translate('products') : i18n.translate('product')}</Text>
        </InlineStack>
        <Divider />
      </BlockStack>
    );
  }

  // Expanded: full editing form
  return (
    <BlockStack gap="base">
      <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
        <InlineStack gap="base" blockAlignment="center">
          <Button variant="tertiary" onClick={onToggle}>▾</Button>
          <ReorderButtons />
          <Text fontWeight="bold">{group.name || i18n.translate('unnamedGroup')}</Text>
        </InlineStack>
        <Button tone="critical" onClick={onRemove}>{i18n.translate('removeGroup')}</Button>
      </InlineStack>

      <TextField
        label={i18n.translate('groupName')}
        value={group.name}
        onChange={(val: string) => onChange({ name: val })}
      />

      {group.products.map((product, index) => (
        <ProductEntry
          key={product.productId || index}
          product={product}
          onChange={(update) => handleProductChange(index, update)}
          onRemove={() => handleProductRemove(index)}
        />
      ))}

      <Button onClick={handleAddProduct}>{i18n.translate('addProduct')}</Button>
      <Divider />
    </BlockStack>
  );
}

