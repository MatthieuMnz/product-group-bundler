import { useEffect } from 'preact/hooks';
import { BundleGroup, BundleProduct } from '../utils/types';
import { ProductEntry } from './ProductEntry';
import { useProductPicker } from '../hooks/useProductPicker';

const t = (key: string) => shopify.i18n.translate(key);

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
  const { pickProducts, fetchProductMeta } = useProductPicker();

  useEffect(() => {
    if (!isExpanded) return;
    const productsNeedingData = group.products.filter(p => !p._variants);
    if (productsNeedingData.length === 0) return;

    const productIds = productsNeedingData.map(p => p.productId);
    fetchProductMeta(shopify.query.bind(shopify), productIds).then((metaMap) => {
      const updatedProducts = group.products.map((p) => {
        if (!p._variants && metaMap.has(p.productId)) {
          const meta = metaMap.get(p.productId);
          if (!meta) return p;
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
  }, [isExpanded, group.products, fetchProductMeta, onChange]);

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

  const displayName = group.name || t('unnamedGroup');
  const productCountLabel = `${group.products.length} ${group.products.length !== 1 ? t('products') : t('product')}`;

  if (!isExpanded) {
    return (
      <s-section heading={displayName}>
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone="info" icon="product">{productCountLabel}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-button variant="tertiary" icon="arrow-up" disabled={isFirst} onClick={onMoveUp} accessibilityLabel={t('moveUp')}></s-button>
            <s-button variant="tertiary" icon="arrow-down" disabled={isLast} onClick={onMoveDown} accessibilityLabel={t('moveDown')}></s-button>
            <s-button variant="tertiary" icon="chevron-down" onClick={onToggle} accessibilityLabel={t('expand')}></s-button>
          </s-stack>
        </s-stack>
      </s-section>
    );
  }

  return (
    <s-section heading={displayName}>
      <s-stack gap="large">
        {/* Group toolbar */}
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone="info" icon="product">{productCountLabel}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-button variant="tertiary" icon="arrow-up" disabled={isFirst} onClick={onMoveUp} accessibilityLabel={t('moveUp')}></s-button>
            <s-button variant="tertiary" icon="arrow-down" disabled={isLast} onClick={onMoveDown} accessibilityLabel={t('moveDown')}></s-button>
            <s-button variant="tertiary" icon="chevron-up" onClick={onToggle} accessibilityLabel={t('collapse')}></s-button>
            <s-button tone="critical" variant="tertiary" icon="delete" onClick={onRemove} accessibilityLabel={t('removeGroup')}></s-button>
          </s-stack>
        </s-stack>

        {/* Group name field */}
        <s-text-field
          label={t('groupName')}
          value={group.name}
          onChange={(e: any) => onChange({ name: e.target.value })}
        ></s-text-field>
        {!group.name.trim() && (
          <s-text tone="caution">{t('groupNameHintRequired')}</s-text>
        )}

        {/* Product list */}
        {group.products.length > 0 && (
          <s-stack gap="base">
            {group.products.map((product, index) => (
              <ProductEntry
                key={product.productId || index}
                product={product}
                onChange={(update) => handleProductChange(index, update)}
                onRemove={() => handleProductRemove(index)}
              />
            ))}
          </s-stack>
        )}

        {/* Add product button */}
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text color="subdued">{t('productsInGroup')}</s-text>
          <s-button icon="product-add" onClick={handleAddProduct}>{t('addProduct')}</s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
