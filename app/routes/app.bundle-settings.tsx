import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  deactivateCartTransformById,
  ensureBundleCartTransform,
  listCartTransforms,
} from "../cart-transform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const cartTransforms = await listCartTransforms(admin);

  return {
    cartTransforms,
    hasCartTransform: cartTransforms.length > 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "activate") {
    try {
      const result = await ensureBundleCartTransform(admin);
      if (!result.success) {
        return { error: result.error || "Impossible d'activer Cart Transform." };
      }
      return {
        success: true,
        message: result.alreadyActive ? "Cart Transform est deja actif." : "Cart Transform active !",
      };
    } catch (error) {
      console.error("Failed to activate Cart Transform", error);
      return { error: "Une erreur inattendue est survenue lors de l'activation." };
    }
  }

  if (actionType === "deactivate") {
    const cartTransformId = formData.get("cartTransformId");
    if (!cartTransformId) {
      return { error: "Aucun identifiant Cart Transform fourni." };
    }
    try {
      const result = await deactivateCartTransformById(admin, String(cartTransformId));
      if (!result.success) {
        return { error: result.error || "Impossible de desactiver Cart Transform." };
      }
      return {
        success: true,
        message: result.alreadyInactive ? "Cart Transform etait deja desactive." : "Cart Transform desactive.",
      };
    } catch (error) {
      console.error("Failed to deactivate Cart Transform", error);
      return { error: "Une erreur inattendue est survenue lors de la desactivation." };
    }
  }

  return null;
};

import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  BlockStack,
  Box,
  InlineStack,
  List,
  Icon,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertTriangleIcon, SettingsIcon } from "@shopify/polaris-icons";

export default function BundleSettings() {
  const { cartTransforms, hasCartTransform } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(fetcher.data.message || "Terminé !");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="Paramètres des remises de lots">
      <BlockStack gap="500">
        <Layout>
          {/* Main settings section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Fonction Cart Transform
                </Text>
                <Text as="p">
                  La fonction Cart Transform applique automatiquement les remises de lots lorsque les clients ajoutent des produits groupés à leur panier. Elle lit la configuration de remise depuis le métachamp du produit et ajuste les prix au passage en caisse.
                </Text>

                {hasCartTransform ? (
                  <Banner tone="success" icon={CheckCircleIcon}>
                    <BlockStack gap="300">
                      <p>
                        <strong>Cart Transform est actif.</strong> Les remises de lots sont appliquées.
                      </p>
                      {cartTransforms.map((ct: any) => (
                        <Box key={ct.id}>
                          <InlineStack blockAlign="center" align="space-between">
                            <Text as="span" variant="bodySm" tone="subdued">ID: {ct.id}</Text>
                            <Button
                              tone="critical"
                              variant="primary"
                              onClick={() => {
                                fetcher.submit(
                                  { action: "deactivate", cartTransformId: ct.id },
                                  { method: "POST" }
                                );
                              }}
                              loading={fetcher.state !== "idle"}
                            >
                              Désactiver
                            </Button>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </Banner>
                ) : (
                  <Banner tone="warning" icon={AlertTriangleIcon}>
                    <BlockStack gap="300">
                      <p>
                        <strong>Cart Transform n'est pas actif.</strong> Les remises sur les lots ne peuvent pas être appliquées.
                      </p>
                      <InlineStack>
                        <Button
                          variant="primary"
                          onClick={() => {
                            fetcher.submit({ action: "activate" }, { method: "POST" });
                          }}
                          loading={fetcher.state !== "idle"}
                        >
                          Activer les remises de lots
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* How it works section */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <InlineStack blockAlign="center" gap="200">
                  <Icon source={SettingsIcon} />
                  <Text as="h2" variant="headingMd">
                    Comment ça fonctionne
                  </Text>
                </InlineStack>
                <List type="number">
                  <List.Item>
                    Lorsqu'un client ajoute un produit groupé à son panier, la fonction Cart Transform s'exécute automatiquement.
                  </List.Item>
                  <List.Item>
                    Elle lit la configuration du lot depuis le métachamp du produit parent.
                  </List.Item>
                  <List.Item>
                    Elle valide la relation de lot et applique la remise configurée.
                  </List.Item>
                  <List.Item>
                    Le prix remisé est affiché dans le panier et au passage en caisse.
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
