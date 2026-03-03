import { BlockStack, Button, InlineStack, Text, TextField, Divider } from '@shopify/ui-extensions-react/admin';
import { BundleGroup, BundleProduct } from '../utils/types';
import { ProductEntry } from './ProductEntry';

interface GroupCardProps {
  group: BundleGroup;
  onChange: (update: Partial<BundleGroup>) => void;
  onRemove: () => void;
}

export function GroupCard({ group, onChange, onRemove }: GroupCardProps) {
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

  const handleAddProduct = () => {
    const products = [...group.products];
    products.push({
      productId: '',
      handle: '',
      variantIds: [],
      discountType: 'fixed_amount',
      discountValue: 0,
    });
    onChange({ products });
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
        <BlockStack key={index} gap="base">
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
