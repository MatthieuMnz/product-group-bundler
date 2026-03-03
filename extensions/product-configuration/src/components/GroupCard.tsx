// @ts-nocheck
import { BlockStack, Button, InlineStack, Text, TextField, Divider } from '@shopify/ui-extensions-react/admin';
import { BundleGroup, BundleProduct } from '../utils/types';
import { ProductEntry } from './ProductEntry';
import { useProductPicker } from '../hooks/useProductPicker';
import { useApi } from '@shopify/ui-extensions-react/admin';

interface GroupCardProps {
  group: BundleGroup;
  currentProductId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (update: Partial<BundleGroup>) => void;
  onRemove: () => void;
}

export function GroupCard({ group, currentProductId, isExpanded, onToggle, onChange, onRemove }: GroupCardProps) {
  const { i18n } = useApi();
  const { pickProducts } = useProductPicker();

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
        discountType: 'fixed_amount' as const,
        discountValue: 0,
      }));

    if (newProducts.length === 0) return;

    onChange({ products: [...group.products, ...newProducts] });
  };

  // Collapsed: compact summary row
  if (!isExpanded) {
    return (
      <BlockStack gap="extraTight">
        <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
          <InlineStack gap="base" blockAlignment="center">
            <Button variant="tertiary" onClick={onToggle}>▸</Button>
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
