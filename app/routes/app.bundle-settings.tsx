import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query {
      cartTransforms(first: 10) {
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
    cartTransforms,
    hasCartTransform: cartTransforms.length > 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "activate") {
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
      { variables: { functionId: bundleFunction.id } }
    );

    const parsed = await response.json();
    if (parsed.data?.cartTransformCreate?.userErrors?.length) {
      return { error: parsed.data.cartTransformCreate.userErrors[0].message };
    }

    return { success: true, message: "Cart Transform activé !" };
  }

  if (actionType === "deactivate") {
    const cartTransformId = formData.get("cartTransformId");
    if (!cartTransformId) {
      return { error: "Aucun identifiant Cart Transform fourni." };
    }

    const response = await admin.graphql(
      `#graphql
      mutation cartTransformDelete($id: ID!) {
        cartTransformDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { id: cartTransformId } }
    );

    const parsed = await response.json();
    if (parsed.data?.cartTransformDelete?.userErrors?.length) {
      return { error: parsed.data.cartTransformDelete.userErrors[0].message };
    }

    return { success: true, message: "Cart Transform désactivé." };
  }

  return null;
};

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
    <s-page heading="Paramètres des remises de lots">
      <s-section heading="Fonction Cart Transform">
        <s-paragraph>
          <s-text>
            La fonction Cart Transform applique automatiquement les remises de lots lorsque les clients ajoutent des produits groupés à leur panier. Elle lit la configuration de remise depuis le métachamp du produit et ajuste les prix au passage en caisse.
          </s-text>
        </s-paragraph>

        {hasCartTransform ? (
          <s-box>
            <s-text>✅ Cart Transform est actif. Les remises de lots sont appliquées.</s-text>
            <br />
            {cartTransforms.map((ct: any) => (
              <s-box key={ct.id}>
                <s-text>ID : {ct.id}</s-text>
                <br />
                <s-button
                  tone="critical"
                  onClick={() =>
                    fetcher.submit(
                      { action: "deactivate", cartTransformId: ct.id },
                      { method: "POST" }
                    )
                  }
                  loading={fetcher.state !== "idle"}
                >
                  Désactiver
                </s-button>
              </s-box>
            ))}
          </s-box>
        ) : (
          <s-box>
            <s-text>⚠️ Cart Transform n'est pas actif. Les remises de lots ne seront pas appliquées.</s-text>
            <br />
            <s-button
              variant="primary"
              onClick={() =>
                fetcher.submit({ action: "activate" }, { method: "POST" })
              }
              loading={fetcher.state !== "idle"}
            >
              Activer les remises de lots
            </s-button>
          </s-box>
        )}
      </s-section>

      <s-section heading="Comment ça fonctionne">
        <s-unordered-list>
          <s-list-item>Lorsqu'un client ajoute un produit groupé à son panier, la fonction Cart Transform s'exécute automatiquement.</s-list-item>
          <s-list-item>Elle lit la configuration du lot depuis le métachamp du produit parent.</s-list-item>
          <s-list-item>Elle valide la relation de lot et applique la remise configurée.</s-list-item>
          <s-list-item>Le prix remisé est affiché dans le panier et au passage en caisse.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
