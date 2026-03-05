import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useBundleConfig } from './hooks/useBundleConfig';

export default function extension() {
  render(<App />, document.body);
}

function App() {
  const productId = (shopify as any).data?.selected?.[0]?.id || "gid://shopify/Product/0";
  const t = (key: string) => shopify.i18n.translate(key);

  const { config, isLoading, isResolving } = useBundleConfig(productId);

  const handleManage = () => {
    (shopify as any).navigation.navigate('extension://bundle-config-action');
  };

  const groupCount = config?.groups.length || 0;
  const productCount = config?.groups.reduce((acc, g) => acc + g.products.length, 0) || 0;

  if (isLoading) {
    return (
      <s-admin-block heading={t('blockTitle')}>
        <s-stack gap="base" alignItems="center">
          <s-spinner size="base"></s-spinner>
        </s-stack>
      </s-admin-block>
    );
  }

  return (
    <s-admin-block heading={t('blockTitle')}>
      <s-stack gap="base">
        {/* Summary row */}
        <s-section>
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-badge tone="info" icon="collection">
                {groupCount} {groupCount === 1 ? t('group') : t('groups')}
              </s-badge>
              <s-badge icon="product">
                {productCount} {productCount === 1 ? t('product') : t('products')}
              </s-badge>
            </s-stack>
            <s-button onClick={handleManage}>{t('manageBundles')}</s-button>
          </s-stack>
        </s-section>

        {isResolving && (
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-spinner size="base"></s-spinner>
            <s-text color="subdued">{t('resolvingProducts')}</s-text>
          </s-stack>
        )}

        {/* Group previews */}
        {groupCount > 0 && (
          <s-stack gap="base">
            {config?.groups.slice(0, 2).map((group) => (
              <s-section key={group.id} heading={group.name || t('unnamedGroup')}>
                <s-stack gap="small">
                  <s-badge tone="info" icon="product">
                    {group.products.length} {group.products.length === 1 ? t('product') : t('products')}
                  </s-badge>

                  <s-stack direction="inline" gap="base" alignItems="center">
                    {group.products.slice(0, 3).map((product, pIdx) => (
                      <s-thumbnail
                        key={`${group.id}-p-${pIdx}`}
                        src={(product as any)._imageUrl || ''}
                        alt={product.title || ''}
                        size="small"
                      ></s-thumbnail>
                    ))}
                    {group.products.length > 3 && (
                      <s-badge tone="info">+{group.products.length - 3}</s-badge>
                    )}
                  </s-stack>
                </s-stack>
              </s-section>
            ))}

            {groupCount > 2 && (
              <s-box paddingBlockStart="base">
                <s-text color="subdued">
                  +{groupCount - 2} {t('moreGroups')}
                </s-text>
              </s-box>
            )}
          </s-stack>
        )}
      </s-stack>
    </s-admin-block>
  );
}
