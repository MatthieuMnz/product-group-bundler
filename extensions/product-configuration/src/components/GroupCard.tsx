// @ts-nocheck
import { BlockStack, Button, InlineStack, Text, TextField, Divider } from '@shopify/ui-extensions-react/admin';
import { BundleGroup, BundleProduct } from '../utils/types';
import { ProductEntry } from './ProductEntry';
import { useProductPicker } from '../hooks/useProductPicker';

interface GroupCardProps {
  group: BundleGroup;
  currentProductId: string;
  onChange: (update: Partial<BundleGroup>) => void;
  onRemove: () => void;
}

export function GroupCard({ group, currentProductId, onChange, onRemove }: GroupCardProps) {
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
      .filter(p => p.id !== currentProductId) // Prevent self-reference
      .filter(p => !existingIds.includes(p.id)) // Prevent duplicates
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

  return (
    <BlockStack gap="base">
      <InlineStack gap="base" blockAlignment="center" inlineAlignment="space-between">
        <Text fontWeight="bold">Bundle Group: {group.name.en || "Unnamed"}</Text>
        <Button tone="critical" onClick={onRemove}>Remove Group</Button>
      </InlineStack>

      <InlineStack gap="base">
        <TextField
          label="Name (English)"
          value={group.name.en}
          onChange={(val: string) => onChange({ name: { ...group.name, en: val } })}
        />
        <TextField
          label="Name (French)"
          value={group.name.fr}
          onChange={(val: string) => onChange({ name: { ...group.name, fr: val } })}
        />
      </InlineStack>

      <Divider />
      
      {group.products.map((product, index) => (
        <BlockStack key={product.productId || index} gap="base">
          <ProductEntry 
            product={product} 
            onChange={(update) => handleProductChange(index, update)}
            onRemove={() => handleProductRemove(index)}
          />
          <Divider />
        </BlockStack>
      ))}

      <Button onClick={handleAddProduct}>Add Product to Group</Button>
    </BlockStack>
  );
}
