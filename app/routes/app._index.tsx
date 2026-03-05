import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ensureBundleCartTransform, listCartTransforms } from "../cart-transform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const cartTransforms = await listCartTransforms(admin);

  return {
    hasCartTransform: cartTransforms.length > 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("action") === "setupCartTransform") {
    try {
      const result = await ensureBundleCartTransform(admin);
      if (!result.success) {
        return { error: result.error || "Impossible d'activer Cart Transform." };
      }
      return { success: true };
    } catch (error) {
      console.error("Failed to setup Cart Transform", error);
      return { error: "Une erreur inattendue est survenue lors de l'activation." };
    }
  }
  
  return null;
};

import {
  Page,
  Layout,
  BlockStack,
  Card,
  Text,
  Button,
  Banner,
  List,
  Box,
} from "@shopify/polaris";
import { PlusIcon, CheckCircleIcon, AlertTriangleIcon } from "@shopify/polaris-icons";

export default function Index() {
  const { hasCartTransform } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Fonction Cart Transform installée avec succès !");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleSetup = () => {
    fetcher.submit({ action: "setupCartTransform" }, { method: "POST" });
  };

  return (
    <Page title="Product Group Bundler">
      <BlockStack gap="500">
        <Layout>
          {/* Welcome Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Bienvenue sur Product Group Bundler
                </Text>
                <Text as="p">
                  Cette application vous permet de créer des lots de produits flexibles directement sur vos pages produits. Améliorez votre panier moyen en offrant des remises sur les achats groupés.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Status Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Configuration de l'application
                </Text>
                
                {hasCartTransform ? (
                  <Banner tone="success" icon={CheckCircleIcon}>
                    <p>
                      <strong>La fonction Cart Transform est active.</strong> Les remises de lots seront appliquées automatiquement dans le panier et lors du passage en caisse.
                    </p>
                  </Banner>
                ) : (
                  <Banner tone="warning" icon={AlertTriangleIcon} action={{ content: 'Activer les remises', onAction: handleSetup, loading: fetcher.state !== "idle" }}>
                    <p>
                      <strong>La fonction Cart Transform n'est pas active.</strong> Les remises sur les lots ne peuvent pas être appliquées. Veuillez activer la fonction pour que l'application fonctionne correctement.
                    </p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Next Steps Section */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Prochaines étapes
                </Text>
                <Box paddingBlockEnd="200">
                  <List type="number">
                    <List.Item>
                      Accédez à l'éditeur de thème et ajoutez le bloc <strong>Bundle Picker</strong> à votre modèle Produit.
                    </List.Item>
                    <List.Item>
                      Allez sur une page Produit dans votre Admin Shopify.
                    </List.Item>
                    <List.Item>
                      Trouvez le bloc <strong>Groupes de lots</strong> et configurez vos groupes.
                    </List.Item>
                  </List>
                </Box>
                <Button variant="primary" icon={PlusIcon} url="shopify:admin/products">
                  Aller aux produits
                </Button>
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
