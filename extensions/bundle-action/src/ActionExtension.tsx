// @ts-nocheck
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  InlineStack,
  Text,
  Banner,
} from '@shopify/ui-extensions-react/admin';
import { useState } from 'react';
import { useBundleConfig } from './hooks/useBundleConfig';
import { EmptyState } from './components/EmptyState';
import { GroupCard } from './components/GroupCard';
import { generateId, validateConfig } from './utils/validation';
import { BundleGroup } from './utils/types';

const TARGET = 'admin.product-details.action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const api = useApi();
  const { data, i18n, close } = api as any;
  const productId = (data as any)?.selected?.[0]?.id || "gid://shopify/Product/0";

  const { config, isLoading, saveConfig, setConfig } = useBundleConfig(productId);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <AdminAction title={i18n.translate('blockTitle')} primaryAction={<Button disabled>{i18n.translate('save')}</Button>}>
        <Text>{i18n.translate('saving')}</Text>
      </AdminAction>
    );
  }

  const handleSave = async () => {
    if (!config) return;
    setErrors([]);
    const validationErrors = validateConfig(config, productId);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    try {
      await saveConfig(config);
      close();
    } catch (e: any) {
      setErrors([e.message || i18n.translate('error')]);
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
    
    // Swap objects
    const temp = newGroups[index];
    newGroups[index] = newGroups[targetIndex];
    newGroups[targetIndex] = temp;

    // Update sortOrder
    newGroups[index].sortOrder = index;
    newGroups[targetIndex].sortOrder = targetIndex;

    setConfig({ ...config, groups: newGroups });
  };

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  };

  return (
    <AdminAction
      title={i18n.translate('blockTitle')}
      primaryAction={
        <Button variant="primary" loading={isSaving} onClick={handleSave}>
          {i18n.translate('save')}
        </Button>
      }
      secondaryAction={
        <Button onClick={close}>Cancel</Button>
      }
    >
      <BlockStack gap="base">
        {errors.length > 0 && (
          <Banner tone="critical">
            <BlockStack gap="extraTight">
              {errors.map((err, i) => (
                <Text key={i}>• {err}</Text>
              ))}
            </BlockStack>
          </Banner>
        )}

        {config?.groups.length === 0 ? (
          <EmptyState onAdd={handleAddGroup} />
        ) : (
          <BlockStack gap="base">
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

            <InlineStack inlineAlignment="center">
              <Button onClick={handleAddGroup}>{i18n.translate('addGroup')}</Button>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </AdminAction>
  );
}
