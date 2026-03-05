type GraphqlClient = {
  graphql: (
    query: string,
    options?: {
      variables?: Record<string, unknown>;
    }
  ) => Promise<Response>;
};

export type CartTransformNode = {
  id: string;
  functionId: string;
};

type ShopifyFunctionNode = {
  id: string;
  title: string;
  apiType: string;
};

const BUNDLE_DISCOUNT_TITLE = "Bundle Discount";

async function parseGraphqlJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function listCartTransforms(admin: GraphqlClient): Promise<CartTransformNode[]> {
  const response = await admin.graphql(
    `#graphql
    query {
      cartTransforms(first: 25) {
        nodes {
          id
          functionId
        }
      }
    }`
  );

  const parsed = await parseGraphqlJson(response);
  const nodes = parsed?.data?.cartTransforms?.nodes;
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.filter(
    (node): node is CartTransformNode =>
      typeof node?.id === "string" && typeof node?.functionId === "string"
  );
}

export async function resolveBundleFunction(admin: GraphqlClient): Promise<ShopifyFunctionNode | null> {
  const response = await admin.graphql(
    `#graphql
    query {
      shopifyFunctions(first: 50) {
        nodes {
          id
          title
          apiType
        }
      }
    }`
  );

  const parsed = await parseGraphqlJson(response);
  const nodes = parsed?.data?.shopifyFunctions?.nodes;
  if (!Array.isArray(nodes)) {
    return null;
  }

  const cartTransforms = nodes.filter(
    (node): node is ShopifyFunctionNode =>
      typeof node?.id === "string" &&
      typeof node?.title === "string" &&
      node?.apiType === "cart_transform"
  );

  if (cartTransforms.length === 0) {
    return null;
  }

  const exactMatch = cartTransforms.find(
    (node) => node.title.trim().toLowerCase() === BUNDLE_DISCOUNT_TITLE.toLowerCase()
  );

  return exactMatch ?? cartTransforms[0];
}

export async function ensureBundleCartTransform(admin: GraphqlClient): Promise<{
  success: boolean;
  alreadyActive?: boolean;
  error?: string;
}> {
  const bundleFunction = await resolveBundleFunction(admin);
  if (!bundleFunction) {
    return {
      success: false,
      error:
        "Fonction Cart Transform introuvable. Veuillez vous assurer que l'extension est compilée et déployée.",
    };
  }

  const existingTransforms = await listCartTransforms(admin);
  if (existingTransforms.some((transform) => transform.functionId === bundleFunction.id)) {
    return { success: true, alreadyActive: true };
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
          message
        }
      }
    }`,
    { variables: { functionId: bundleFunction.id } }
  );

  const parsed = await parseGraphqlJson(response);
  const userErrors = parsed?.data?.cartTransformCreate?.userErrors;
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    return { success: false, error: userErrors[0]?.message || "Impossible d'activer Cart Transform." };
  }

  return { success: true };
}

export async function deactivateCartTransformById(
  admin: GraphqlClient,
  cartTransformId: string
): Promise<{ success: boolean; error?: string; alreadyInactive?: boolean }> {
  const existingTransforms = await listCartTransforms(admin);
  if (!existingTransforms.some((transform) => transform.id === cartTransformId)) {
    return { success: true, alreadyInactive: true };
  }

  const response = await admin.graphql(
    `#graphql
    mutation cartTransformDelete($id: ID!) {
      cartTransformDelete(id: $id) {
        deletedId
        userErrors {
          message
        }
      }
    }`,
    { variables: { id: cartTransformId } }
  );

  const parsed = await parseGraphqlJson(response);
  const userErrors = parsed?.data?.cartTransformDelete?.userErrors;
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    return { success: false, error: userErrors[0]?.message || "Impossible de désactiver Cart Transform." };
  }

  return { success: true };
}
