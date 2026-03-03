// @ts-nocheck
import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Button,
  InlineStack,
  Text,
} from '@shopify/ui-extensions-react/admin';
import { useState } from 'react';
import { useBundleConfig } from './hooks/useBundleConfig';
import { EmptyState } from './components/EmptyState';
import { GroupCard } from './components/GroupCard';
import { generateId, validateConfig } from './utils/validation';
import { BundleGroup } from './utils/types';

const TARGET = 'admin.product-details.configuration.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET as any);
  // data contains product ID and selectedVariantId (if target has it)
  // For product-details target, data.selected[0].id format is 'gid://shopify/Product/123'
  const productId = (data as any)?.selected?.[0]?.id || "gid://shopify/Product/0";

  const { config, isLoading, saveConfig, setConfig } = useBundleConfig(productId);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (isLoading) {
    return (
      <AdminBlock title="Bundle Groups">
        <Text>Loading config...</Text>
      </AdminBlock>
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
    } catch (e: any) {
      setErrors([e.message || "Failed to save"]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddGroup = () => {
    if (!config) return;
    const newGroup: BundleGroup = {
      id: generateId(),
      name: { en: '', fr: '' },
      sortOrder: config.groups.length,
      products: [],
    };
    setConfig({ ...config, groups: [...config.groups, newGroup] });
  };

  const handleGroupChange = (index: number, update: Partial<BundleGroup>) => {
    if (!config) return;
    const newGroups = [...config.groups];
    newGroups[index] = { ...newGroups[index], ...update };
    setConfig({ ...config, groups: newGroups });
  };

  const handleGroupRemove = (index: number) => {
    if (!config) return;
    const newGroups = [...config.groups];
    newGroups.splice(index, 1);
    setConfig({ ...config, groups: newGroups });
  };

  return (
    <AdminBlock title="Bundle Groups">
      <BlockStack gap="base">
        {errors.length > 0 && (
          <BlockStack gap="base">
            {errors.map((err, i) => (
              <Text tone="critical" key={i}>• {err}</Text>
            ))}
          </BlockStack>
        )}

        {config?.groups.length === 0 ? (
          <EmptyState onAdd={handleAddGroup} />
        ) : (
          <BlockStack gap="large">
            {config?.groups.map((group, index) => (
              <GroupCard
                key={group.id}
                group={group}
                onChange={(update) => handleGroupChange(index, update)}
                onRemove={() => handleGroupRemove(index)}
              />
            ))}

            <InlineStack blockAlignment="center" inlineAlignment="space-between">
              <Button onClick={handleAddGroup}>Add Another Group</Button>
              <Button variant="primary" loading={isSaving} onClick={handleSave}>
                Save Changes
              </Button>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
