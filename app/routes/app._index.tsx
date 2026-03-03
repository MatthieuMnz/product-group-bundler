import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // Check if Cart Transform is already created
  const response = await admin.graphql(
    `#graphql
    query {
      cartTransforms(first: 1) {
        nodes {
          id
          functionId
        }
      }
    }`
  );
  
  const parsed = await response.json();
  const cartTransforms = parsed.data?.cartTransforms?.nodes || [];
  
  return { 
    hasCartTransform: cartTransforms.length > 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("action") === "setupCartTransform") {
    // Dynamically find the bundle-discount function ID via GraphQL
    const fnResponse = await admin.graphql(
      `#graphql
      query {
        shopifyFunctions(first: 25) {
          nodes {
            id
            title
            apiType
            app {
              title
            }
          }
        }
      }`
    );

    const fnParsed = await fnResponse.json();
    const functions = fnParsed.data?.shopifyFunctions?.nodes || [];
    const bundleFunction = functions.find(
      (fn: any) => fn.apiType === "cart_transform"
    );

    if (!bundleFunction) {
      return { error: "Fonction Cart Transform introuvable. Veuillez vous assurer que l'extension est compilée et déployée." };
    }

    const response = await admin.graphql(
      `#graphql
      mutation cartTransformCreate($functionId: String!) {
        cartTransformCreate(functionId: $functionId, blockOnFailure: false) {
          cartTransform {
            id
            functionId
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          functionId: bundleFunction.id
        }
      }
    );
    
    const parsed = await response.json();
    if (parsed.data?.cartTransformCreate?.userErrors?.length) {
      return { error: parsed.data.cartTransformCreate.userErrors[0].message };
    }
    
    return { success: true };
  }
  
  return null;
};

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
    <s-page heading="Product Group Bundler">
      <s-section heading="Bienvenue sur Product Group Bundler">
        <s-paragraph>
          Cette application vous permet de créer des lots de produits flexibles directement sur vos pages produits.
          Naviguez vers vos produits pour commencer à configurer des groupes de lots.
        </s-paragraph>
      </s-section>
      
      <s-section heading="Configuration de l'application">
        {hasCartTransform ? (
          <s-box>
            <s-text>✅ La fonction Cart Transform est active. Les remises de lots seront appliquées automatiquement dans le panier.</s-text>
          </s-box>
        ) : (
          <s-box>
            <s-paragraph>
              <s-text>⚠️ La fonction Cart Transform n'est pas active. Les remises ne seront pas appliquées dans le panier.</s-text>
            </s-paragraph>
            <br />
            <s-button 
              onClick={handleSetup} 
              loading={fetcher.state !== "idle"}
            >
              Activer les remises de lots
            </s-button>
          </s-box>
        )}
      </s-section>
      
      <s-section heading="Prochaines étapes">
        <s-unordered-list>
          <s-list-item>Ajoutez le bloc « Bundle Picker » à votre modèle Produit par défaut dans l'éditeur de thème.</s-list-item>
          <s-list-item>Allez sur un Produit dans votre Admin Shopify et trouvez le bloc « Groupes de lots » pour configurer les remises.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
