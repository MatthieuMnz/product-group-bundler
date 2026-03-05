import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { useBundleConfig } from './hooks/useBundleConfig';
import { EmptyState } from './components/EmptyState';
import { GroupCard } from './components/GroupCard';
import { generateId, validateConfig } from './utils/validation';
import { BundleGroup } from './utils/types';

export default function extension() {
  render(<App />, document.body);
}

function App() {
  const productId = (shopify as any).data?.selected?.[0]?.id || "gid://shopify/Product/0";
  const t = (key: string) => shopify.i18n.translate(key);

  const { config, isLoading, isResolving, saveConfig, setConfig } = useBundleConfig(productId);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!config) return;
    setErrors([]);
    setWarnings([]);
    const result = validateConfig(config, productId);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    if (result.warnings.length > 0) {
      setWarnings(result.warnings);
    }

    setIsSaving(true);
    try {
      await saveConfig(config);
      shopify.close();
    } catch (e: any) {
      setErrors([e.message || t('error')]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddGroup = () => {
    if (!config) return;
    const newId = generateId();
    const newGroup: BundleGroup = {
      id: newId,
      name: '',
      sortOrder: config.groups.length,
      products: [],
    };
    setConfig({ ...config, groups: [...config.groups, newGroup] });
    setExpandedGroupId(newId);
  };

  const handleGroupChange = (index: number, update: Partial<BundleGroup>) => {
    if (!config) return;
    const newGroups = [...config.groups];
    newGroups[index] = { ...newGroups[index], ...update };
    setConfig({ ...config, groups: newGroups });
  };

  const handleGroupRemove = (index: number) => {
    if (!config) return;
    const removedId = config.groups[index].id;
    const newGroups = [...config.groups];
    newGroups.splice(index, 1);
    setConfig({ ...config, groups: newGroups });
    if (expandedGroupId === removedId) {
      setExpandedGroupId(null);
    }
  };

  const handleGroupMove = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === config.groups.length - 1) return;

    const newGroups = [...config.groups];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newGroups[index];
    newGroups[index] = newGroups[targetIndex];
    newGroups[targetIndex] = temp;
    newGroups[index].sortOrder = index;
    newGroups[targetIndex].sortOrder = targetIndex;

    setConfig({ ...config, groups: newGroups });
  };

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  };

  const groupCount = config?.groups.length || 0;
  const productCount = config?.groups.reduce((sum, group) => sum + group.products.length, 0) || 0;

  return (
    <s-admin-action heading={t('blockTitle')} loading={isLoading}>
      <s-stack gap="large">
        {errors.length > 0 && (
          <s-banner tone="critical" dismissible>
            <s-stack gap="small">
              {errors.map((err, i) => (
                <s-paragraph key={i}>{err}</s-paragraph>
              ))}
            </s-stack>
          </s-banner>
        )}

        {warnings.length > 0 && (
          <s-banner tone="warning" dismissible>
            <s-stack gap="small">
              {warnings.map((w, i) => (
                <s-paragraph key={i}>{w}</s-paragraph>
              ))}
            </s-stack>
          </s-banner>
        )}

        <s-section heading={t('manageBundles')}>
          <s-stack gap="base">
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-badge tone="info" icon="collection">
                  {groupCount} {groupCount === 1 ? t('group') : t('groups')}
                </s-badge>
                <s-badge icon="product">
                  {productCount} {productCount === 1 ? t('product') : t('products')}
                </s-badge>
              </s-stack>
              <s-button icon="plus" onClick={handleAddGroup}>{t('addGroup')}</s-button>
            </s-stack>
            {isResolving && (
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-spinner size="base"></s-spinner>
                <s-text color="subdued">{t('resolvingProducts')}</s-text>
              </s-stack>
            )}
          </s-stack>
        </s-section>

        {config?.groups.length === 0 ? (
          <EmptyState onAdd={handleAddGroup} />
        ) : (
          <s-stack gap="base">
            {config?.groups.map((group, index) => (
              <GroupCard
                key={group.id}
                group={group}
                currentProductId={productId}
                isExpanded={expandedGroupId === group.id}
                onToggle={() => handleToggleGroup(group.id)}
                onChange={(update) => handleGroupChange(index, update)}
                onRemove={() => handleGroupRemove(index)}
                onMoveUp={() => handleGroupMove(index, 'up')}
                onMoveDown={() => handleGroupMove(index, 'down')}
                isFirst={index === 0}
                isLast={index === (config?.groups.length || 0) - 1}
              />
            ))}

            <s-box paddingBlockStart="base">
              <s-stack direction="inline" justifyContent="center">
                <s-button icon="plus" onClick={handleAddGroup}>{t('addGroup')}</s-button>
              </s-stack>
            </s-box>
          </s-stack>
        )}
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        icon="save"
        disabled={isSaving}
        onClick={handleSave}
      >
        {t('save')}
      </s-button>
      <s-button
        slot="secondary-actions"
        onClick={() => shopify.close()}
      >
        Cancel
      </s-button>
    </s-admin-action>
  );
}
