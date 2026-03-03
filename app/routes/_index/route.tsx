import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Product Group Bundler</h1>
        <p className={styles.text}>
          Create flexible product bundles with group-based discounts, directly on your product pages.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Bundle groups</strong>. Configure groups of related products
            (accessories, tools, etc.) with per-product discounts.
          </li>
          <li>
            <strong>Storefront picker</strong>. Customers see a slick bundle
            picker on product pages and add extras to their cart.
          </li>
          <li>
            <strong>Automatic discounts</strong>. Cart Transform applies
            discounts server-side — no coupon codes needed.
          </li>
        </ul>
      </div>
    </div>
  );
}
