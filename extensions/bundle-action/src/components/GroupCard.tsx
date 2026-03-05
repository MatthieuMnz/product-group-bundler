import { BlockStack, Box, Badge, Button, InlineStack, Text, TextField, Divider, useApi } from '@shopify/ui-extensions-react/admin';
import { BundleGroup, BundleProduct } from '../utils/types';
import { ProductEntry } from './ProductEntry';
import { useProductPicker } from '../hooks/useProductPicker';
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
  const { pickProducts, fetchProductMeta } = useProductPicker();

  // Hydrate variant + image data for products that don't have _variants loaded yet
  useEffect(() => {
    if (!isExpanded) return;
    const productsNeedingData = group.products.filter(p => !p._variants);
    if (productsNeedingData.length === 0) return;

    const productIds = productsNeedingData.map(p => p.productId);
    fetchProductMeta(query, productIds).then((metaMap) => {
      const updatedProducts = group.products.map((p) => {
        if (!p._variants && metaMap.has(p.productId)) {
          const meta = metaMap.get(p.productId);
          if (!meta) {
            return p;
          }
          return {
            ...p,
            _variants: meta.variants,
            _imageUrl: p._imageUrl || meta.imageUrl,
            _price: p._price || meta.variants?.[0]?.price,
          };
        }
        return p;
      });
      onChange({ products: updatedProducts });
    });
  }, [isExpanded, group.products, fetchProductMeta, onChange, query]);

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
        _imageUrl: p.imageUrl,
        _price: p.variants?.[0]?.price || undefined,
      }));

    if (newProducts.length === 0) return;

    onChange({ products: [...group.products, ...newProducts] });
  };

  // Reordering controls
  const ReorderButtons = () => (
    <InlineStack gap="small" blockAlignment="center">
      <Button variant="tertiary" disabled={isFirst} onClick={onMoveUp}>↑</Button>
      <Button variant="tertiary" disabled={isLast} onClick={onMoveDown}>↓</Button>
    </InlineStack>
  );

  // Collapsed: compact summary row
  if (!isExpanded) {
    return (
      <Box padding="base" paddingBlock="small">
        <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
          <InlineStack gap="base" blockAlignment="center">
            <Button variant="tertiary" onClick={onToggle}>▸</Button>
            <Text fontWeight="bold">{group.name || i18n.translate('unnamedGroup')}</Text>
            <Badge tone="info">
              {group.products.length} {group.products.length !== 1 ? i18n.translate('products') : i18n.translate('product')}
            </Badge>
          </InlineStack>
          <ReorderButtons />
        </InlineStack>
      </Box>
    );
  }

  // Expanded: full editing form
  return (
    <Box padding="base">
      <BlockStack gap="base">
        <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
          <InlineStack gap="base" blockAlignment="center">
            <Button variant="tertiary" onClick={onToggle}>▾</Button>
            <Text fontWeight="bold">{group.name || i18n.translate('unnamedGroup')}</Text>
            <Badge tone="info">
              {group.products.length} {group.products.length !== 1 ? i18n.translate('products') : i18n.translate('product')}
            </Badge>
          </InlineStack>
          <InlineStack gap="base" blockAlignment="center">
            <ReorderButtons />
            <Button tone="critical" variant="tertiary" onClick={onRemove}>{i18n.translate('removeGroup')}</Button>
          </InlineStack>
        </InlineStack>

        <Box paddingBlockEnd="small">
          <TextField
            label={i18n.translate('groupName')}
            value={group.name}
            onChange={(val: string) => onChange({ name: val })}
          />
        </Box>

        {group.products.length > 0 && <Divider />}

        <BlockStack gap="small">
          {group.products.map((product, index) => (
            <ProductEntry
              key={product.productId || index}
              product={product}
              onChange={(update) => handleProductChange(index, update)}
              onRemove={() => handleProductRemove(index)}
            />
          ))}
        </BlockStack>

        <Box paddingBlockStart="small">
          <Button onClick={handleAddProduct}>{i18n.translate('addProduct')}</Button>
        </Box>
      </BlockStack>
    </Box>
  );
}
