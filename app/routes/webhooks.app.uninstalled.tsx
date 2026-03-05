import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Always delete by shop so this handler remains idempotent
  // even when the webhook is retried or session context is missing.
  if (session || shop) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
