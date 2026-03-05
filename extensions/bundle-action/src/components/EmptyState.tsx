const t = (key: string) => shopify.i18n.translate(key);

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <s-section>
      <s-box padding="large">
        <s-stack gap="base" alignItems="center">
          <s-icon type="product" size="base"></s-icon>
          <s-heading>{t('manageBundles')}</s-heading>
          <s-paragraph color="subdued">
            {t('emptyStateDescription')}
          </s-paragraph>
          <s-box paddingBlockStart="base">
            <s-button variant="primary" icon="plus" onClick={onAdd}>{t('addGroup')}</s-button>
          </s-box>
        </s-stack>
      </s-box>
    </s-section>
  );
}
