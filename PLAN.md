# Product Group Bundler — Full Technical Plan

> **App name:** `product-group-bundler`
> **Stack:** Shopify CLI 3.90.1 · React Router 7 · TypeScript · Prisma · Polaris Web Components
> **Node:** v25.7.0 · **pnpm:** v10.29.2
> **Shopify API version:** 2026-04

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model](#3-data-model)
4. [App Configuration](#4-app-configuration-shopifyapptoml)
5. [Extensions](#5-extensions)
   - [Product Configuration Extension](#51-product-configuration-extension)
   - [Theme App Extension](#52-theme-app-extension)
   - [Cart Transform Function](#53-cart-transform-function)
6. [App Backend](#6-app-backend-react-router)
7. [Storefront Integration](#7-storefront-integration)
8. [Internationalization](#8-internationalization-i18n)
9. [File Structure](#9-complete-file-structure)
10. [Security](#10-security)
11. [Limitations & Requirements](#11-limitations--requirements)
12. [Implementation Phases](#12-implementation-phases)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. Executive Summary

### Problem

Products in the store can be purchased together with related items ("accessories", "tools", etc.) at a discounted price. This is **not** a traditional bundle (single SKU) or a variant matrix — it is a **dynamic, cross-product grouping** where the merchant defines groups of related products on any given product, each with its own discount, and the customer selects which ones to add alongside the main product.

### Solution

A Shopify app with three extensions working together:

| Layer | Extension | Role |
|-------|-----------|------|
| **Admin** | Product Configuration Extension | Merchant configures bundle groups directly in the "Bundled products" card on the product page |
| **Storefront** | Theme App Extension (Liquid + JS) | Displays the bundle group picker on the product page; hooks into add-to-cart |
| **Cart** | Cart Transform Function (Shopify Function) | Validates and applies bundle discounts server-side at cart/checkout time |

All bundle configuration lives in a **single JSON metafield on each product** — no app-level database needed beyond Shopify sessions. This keeps the architecture simple, the data co-located with the resource, and enables direct access from Liquid, Functions, and the Admin API.

### User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  MERCHANT (Admin)                                                   │
│                                                                     │
│  1. Opens a product in Shopify Admin                                │
│  2. Sees the "Bundled products" card (Product Config Ext)           │
│  3. Creates groups (e.g. "Accessoires", "Outils")                   │
│  4. Adds products to each group with a discount                     │
│  5. Saves → metafield written on the product                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CUSTOMER (Storefront)                                              │
│                                                                     │
│  1. Views Product A's page                                          │
│  2. Sees bundle groups rendered by the theme block                  │
│  3. Checks Product B (Accessory, −$10) and Product D (Tool, −$5)   │
│  4. Selects variants if needed                                      │
│  5. Clicks the existing "Add to Cart" button                        │
│  6. Cart receives Product A and Product B + D as                    │
│     Native Nested Cart Lines (using `parent_id` API)                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CART / CHECKOUT (Server-side)                                      │
│                                                                     │
│  1. Cart Transform function runs                                    │
│  2. For each nested child line in the cart (via `bundleParentProductId`): │
│     a. Finds the parent product line in the cart                    │
│     b. Reads the parent's `bundle_groups` metafield                 │
│     c. Validates the child product exists in the config             │
│     d. Reads the discount from the metafield (source of truth)      │
│     e. Returns a `lineUpdate` operation adjusting the price         │
│  3. Customer sees discounted prices in cart and checkout             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Overview

```
                    ┌──────────────────────────┐
                    │    Shopify Admin          │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │ Product Config Ext. │  │─── reads/writes ──► Product Metafield
                    │  │  (React, UI Ext.)   │  │                     `$app:bundle_groups`
                    │  └─────────────────────┘  │                          │
                    └──────────────────────────┘                           │
                                                                           │
                    ┌──────────────────────────┐                           │
                    │    App Backend            │                           │
                    │    (React Router)         │                           │
                    │                           │                           │
                    │  • Session management     │                           │
                    │  • Proxy endpoints        │                           │
                    │  • Dashboard UI           │                           │
                    └──────────────────────────┘                           │
                                                                           │
┌──────────────────────────────────────────────────────────────────────────┤
│  Storefront                                                              │
│                                                                          │
│  ┌────────────────────┐     ┌──────────────────────────────┐            │
│  │ Theme App Block    │────►│  product.metafields.          │            │
│  │ (Liquid + JS)      │     │  app.bundle_groups            │◄───────────┘
│  │                    │     └──────────────────────────────┘
│  │ Shows groups,      │
│  │ handles selection  │──── POST /cart/add.js ──┐
│  └────────────────────┘                         │
│                                                  ▼
│                                        ┌─────────────────┐
│                                        │  Shopify Cart    │
│                                        └────────┬────────┘
│                                                  │
│                                                  ▼
│                                   ┌──────────────────────────┐
│                                   │  Cart Transform Function │
│                                   │  (Shopify Function/Wasm) │
│                                   │                          │
│                                   │  Validates bundles,      │
│                                   │  applies price updates   │
│                                   └──────────────────────────┘
└──────────────────────────────────────────────────────────────────────────
```

### Design Principles

- **Metafield as single source of truth** — all bundle configuration lives on the product, readable by every layer without extra API calls.
- **Server-side validation** — the Cart Transform function validates discounts against the metafield; client-side line properties are untrusted inputs.
- **Minimal storefront footprint** — the theme block is lightweight Liquid + vanilla JS; no framework runtime shipped to the customer.
- **Native Shopify feel** — Polaris web components in admin, standard Liquid patterns on storefront, Shopify Functions for cart logic.
- **Bilingual from day one** — English default, French translations in every extension's `locales/`.

---

## 3. Data Model

### 3.1 Product Metafield: `bundle_groups`

| Property | Value |
|----------|-------|
| **Namespace** | `app` (resolves to `app--{APP_ID}`) |
| **Key** | `bundle_groups` |
| **Type** | `json` |
| **Owner** | The app |
| **Access** | `merchant_read` in admin (read-only for merchant; app writes) |
| **Storefront access** | Enabled (for Liquid and Storefront API) |

#### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["groups"],
  "properties": {
    "version": {
      "type": "integer",
      "description": "Schema version for future migrations",
      "const": 1
    },
    "groups": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "products"],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "Unique identifier for the group"
          },
          "name": {
            "type": "object",
            "description": "Localized group name",
            "required": ["en", "fr"],
            "properties": {
              "en": { "type": "string" },
              "fr": { "type": "string" }
            }
          },
          "sortOrder": {
            "type": "integer",
            "description": "Display order (ascending)"
          },
          "products": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["productId", "discountType", "discountValue"],
              "properties": {
                "productId": {
                  "type": "string",
                  "description": "Shopify Product GID (gid://shopify/Product/…)"
                },
                "variantIds": {
                  "type": "array",
                  "items": { "type": "string" },
                  "description": "Allowed variant GIDs. Empty array = all variants."
                },
                "discountType": {
                  "type": "string",
                  "enum": ["fixed_amount"],
                  "description": "Type of discount applied to this product in the bundle. Always fixed_amount."
                },
                "discountValue": {
                  "type": "number",
                  "minimum": 0,
                  "description": "Discount value: dollar amount to subtract from the product price"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

#### Example Metafield Value

```json
{
  "version": 1,
  "groups": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": { "en": "Accessories", "fr": "Accessoires" },
      "sortOrder": 0,
      "products": [
        {
          "productId": "gid://shopify/Product/1001",
          "variantIds": [],
          "discountType": "fixed_amount",
          "discountValue": 10.00
        },
        {
          "productId": "gid://shopify/Product/1002",
          "variantIds": ["gid://shopify/ProductVariant/5001", "gid://shopify/ProductVariant/5002"],
          "discountType": "fixed_amount",
          "discountValue": 12.00
        }
      ]
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": { "en": "Tools", "fr": "Outils" },
      "sortOrder": 1,
      "products": [
        {
          "productId": "gid://shopify/Product/2001",
          "variantIds": [],
          "discountType": "fixed_amount",
          "discountValue": 5.00
        }
      ]
    }
  ]
}
```

### 3.2 Native Nested Cart Lines & Properties

The app uses Shopify's native **Nested Cart Lines** feature (supported in Checkout UI Extensions 2025-10+ and the Cart AJAX API). When a customer adds a bundle to the cart, the items are linked at the platform level.

| Tracking Method | Property/Value | Purpose |
|-----------------|--------------|---------|
| **Native Link** | `parent_id` (AJAX API) | Tells Shopify to nest the bundle item visually under the parent item in the Cart, Checkout, and Order views. |
| **Line Property** | `_bundle_parent_product_id` | Product GID of the parent (e.g. `gid://shopify/Product/999`). Helps the Cart Transform quickly fetch the right metafield. |
| **Line Property** | `_bundle_group_id` | Group UUID from the metafield. Identifies which discount rule applies. |

Native nested lines are automatically removed if the parent is removed. They are visually grouped in supported themes and checkouts. Properties prefixed with `_` are hidden from the customer.

> **Important:** The discount amount is **never** sent from the client. The Cart Transform function reads the discount exclusively from the parent product's metafield. Line properties are only used to establish the parent-child relationship.

### 3.4 Cart Transform Object (Initialization)

To enable the Cart Transform function on a storefront, the app needs to create a `CartTransform` object via GraphQL mutation during the setup process. This links the function to the shop.

### 3.3 Prisma Schema (App Database)

The app database only handles Shopify session storage. Bundle data lives entirely in metafields.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:dev.sqlite"
}

model Session {
  id                  String    @id
  shop                String
  state               String
  isOnline            Boolean   @default(false)
  scope               String?
  expires             DateTime?
  accessToken         String
  userId              BigInt?
  firstName           String?
  lastName            String?
  email               String?
  accountOwner        Boolean   @default(false)
  locale              String?
  collaborator        Boolean?  @default(false)
  emailVerified       Boolean?  @default(false)
  refreshToken        String?
  refreshTokenExpires DateTime?
}
```

No additional models are needed for v1. If analytics or bulk management is desired later, models can be added.

> **Note:** We must also store the ID of the `CartTransform` object created via `cartTransformCreate` in the database or check it dynamically, ensuring it remains active.

---

## 4. App Configuration (`shopify.app.toml`)

Replace the demo metafield/metaobject definitions with the bundle configuration:

```toml
# shopify.app.toml

client_id = "2aeef01e716df073d7052a92bfcf8ab6"
name = "product-group-bundler"
application_url = "https://example.com"
embedded = true

[build]
automatically_update_urls_on_dev = true
include_config_on_deploy = true

[webhooks]
api_version = "2026-04"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"

  [[webhooks.subscriptions]]
  topics = [ "app/scopes_update" ]
  uri = "/webhooks/app/scopes_update"

[access_scopes]
scopes = "read_products,write_products"

[auth]
redirect_urls = [ "https://example.com/api/auth" ]

# ─── Bundle Groups Metafield ──────────────────────────────────

[product.metafields.app.bundle_groups]
type = "json"
name = "Bundle Groups"
description = "Configuration for product bundle groups (accessories, tools, etc.)"

  [product.metafields.app.bundle_groups.access]
  admin = "merchant_read"
  storefront = "public_read"
```

### Scope Changes

| Old | New | Reason |
|-----|-----|--------|
| `write_metaobject_definitions` | _(removed)_ | No metaobjects needed |
| `write_metaobjects` | _(removed)_ | No metaobjects needed |
| `write_products` | `write_products` | Write metafields on products |
| _(missing)_ | `read_products` | Search & display products in admin block |

---

## 5. Extensions

### 5.1 Product Configuration Extension

**Target:** `admin.product-details.configuration.render` (or standard product config target)
**Purpose:** Let the merchant configure bundle groups directly on a product page inside the "Bundled products" card in Shopify Admin.
**Tech:** React + Shopify Admin UI Extensions API + Polaris admin components

#### Generation Command

```bash
pnpm shopify app generate extension --template product_configuration --name bundle-group-manager
```

#### Configuration (`shopify.extension.toml`)

```toml
api_version = "2026-04"
type = "ui_extension"

[[extensions]]
name = "Bundle Groups"
handle = "bundle-group-manager"
description = "Configure product bundle groups with discounts"

  [[extensions.targeting]]
  target = "admin.product-details.configuration.render"
  module = "./src/BlockExtension.tsx"

[extensions.capabilities]
api_access = true
block_progress = false
```

#### Feature Breakdown

| Feature | Details |
|---------|---------|
| **Load existing config** | On mount, query the product's `bundle_groups` metafield via `admin.graphql()` |
| **Add group** | Create a new group with name (EN + FR), auto-generates UUID |
| **Remove group** | Delete a group from the config |
| **Reorder groups** | Drag or arrow buttons to change `sortOrder` |
| **Add product to group** | Opens Shopify's native Resource Picker (`picker.product.select`) for product selection |
| **Configure discount** | Per product: enter a fixed dollar amount discount |
| **Restrict variants** | Optional: select which variants of the product are allowed in the bundle |
| **Remove product from group** | Remove a product entry from a group |
| **Save** | Write the full JSON back to the product's metafield via `productUpdate` mutation |
| **Validation** | Prevent adding the current product to its own bundle groups; validate discount values |

#### Admin GraphQL Queries

**Read metafield:**
```graphql
query GetBundleGroups($productId: ID!) {
  product(id: $productId) {
    metafield(namespace: "app--product-group-bundler", key: "bundle_groups") {
      id
      value
    }
  }
}
```

**Write metafield:**
```graphql
mutation SaveBundleGroups($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      metafield(namespace: "app--product-group-bundler", key: "bundle_groups") {
        id
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

Variables:
```json
{
  "input": {
    "id": "gid://shopify/Product/…",
    "metafields": [
      {
        "namespace": "app--product-group-bundler",
        "key": "bundle_groups",
        "type": "json",
        "value": "{ \"version\": 1, \"groups\": [...] }"
      }
    ]
  }
}
```

> **Note on namespace:** When using `admin.graphql()` from a UI extension, the app's reserved namespace is `app--{APP_ID}`. You must dynamically fetch the app ID via `app { id }` to construct it. In Shopify Functions, use `$app:bundle_groups`. In Liquid (theme app extension context), use `product.metafields['app--' | append: app.id].bundle_groups`.

#### UI Layout (Admin Block)

```
┌──────────────────────────────────────────────────────┐
│  Bundle Groups                              [+ Add]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ▼ Accessories / Accessoires                    [×]  │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🔗 Product B          $10.00 off     [Edit][×] │  │
│  │ 🔗 Product C          $12.00 off     [Edit][×] │  │
│  │                                                │  │
│  │              [+ Add Product]                    │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ▼ Tools / Outils                               [×]  │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🔗 Product E          $5.00 off      [Edit][×] │  │
│  │                                                │  │
│  │              [+ Add Product]                    │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Components used (Admin UI Extensions):
- `AdminBlock`, `BlockStack`, `InlineStack`
- `Text`, `TextField`, `NumberField`, `Select`
- `Button`, `Pressable`
- `Icon`
- `Divider`
- `ResourceItem` (for product entries)

#### Key Implementation Notes

- Use `useApi()` from `@shopify/ui-extensions-react/admin` to access `admin.graphql()` and `data` (current product ID).
- Product selection uses the picker target: `admin.product-resource-picker.select` or the Resource Picker API.
- All state is managed locally in the extension; save triggers one metafield write.
- The extension should show a loading skeleton while fetching the existing metafield.
- Optimistic UI: show the save as successful immediately, revert on error.

---

### 5.2 Theme App Extension

**Purpose:** Render the bundle group picker on the storefront product page and handle add-to-cart with bundled items.
**Tech:** Liquid, vanilla JavaScript, minimal CSS.

#### Generation Command

```bash
pnpm shopify app generate extension --template theme_app_extension --name bundle-picker
```

#### Configuration (`shopify.extension.toml`)

```toml
api_version = "2026-04"
type = "theme_app_extension"

[[extensions]]
name = "Bundle Picker"
handle = "bundle-picker"
```

#### Block: `bundle-picker.liquid`

Registered as an **app block** for the product page. Merchants drag it into the product template via the theme editor.

**Block schema:**
```json
{
  "name": "Bundle Picker",
  "target": "section",
  "settings": [
    {
      "type": "text",
      "id": "heading_en",
      "label": "Heading (English)",
      "default": "Add extras"
    },
    {
      "type": "text",
      "id": "heading_fr",
      "label": "Heading (Français)",
      "default": "Ajoutez des extras"
    },
    {
      "type": "select",
      "id": "layout",
      "label": "Layout",
      "options": [
        { "value": "list", "label": "List" },
        { "value": "grid", "label": "Grid" }
      ],
      "default": "list"
    }
  ]
}
```

#### Liquid Template Logic

```liquid
{%- comment -%} blocks/bundle-picker.liquid {%- endcomment -%}

{%- assign namespace = 'app--' | append: app.id -%}
{%- assign bundle_meta = product.metafields[namespace].bundle_groups -%}
{%- if bundle_meta != blank -%}
  {%- assign bundle_data = bundle_meta.value -%}
  
  <div
    class="pgb-bundle-picker"
    data-product-id="{{ product.id }}"
    data-product-gid="gid://shopify/Product/{{ product.id }}"
    data-bundle-config='{{ bundle_data | escape }}'
    data-locale="{{ request.locale.iso_code }}"
    data-layout="{{ block.settings.layout }}"
  >
    {%- comment -%} JS renders the interactive UI here {%- endcomment -%}
    <noscript>
      {%- comment -%} Fallback: show group names only {%- endcomment -%}
    </noscript>
  </div>

  {{ 'bundle-picker.css' | asset_url | stylesheet_tag }}
  <script src="{{ 'bundle-picker.js' | asset_url }}" defer></script>
{%- endif -%}
```

#### JavaScript: `bundle-picker.js`

The JS file is a self-contained module that:

1. **Parses** the `data-bundle-config` JSON from the Liquid-rendered container.
2. **Fetches product data** for each referenced product via the Storefront API (`/products/{handle}.json` or AJAX API) to get titles, images, prices, variant info, and availability.
3. **Renders** the interactive UI (group headings, product cards with checkboxes, variant selectors).
4. **Manages selection state** — tracks which products/variants are selected.
5. **Intercepts add-to-cart** — attaches to the product form's submit event:
   - Prevents default form submission.
   - Builds a payload with the main product + selected bundle products.
   - Calls `POST /cart/add.js` with the `items[]` array.
   - Assigns a unique temporary ID to the main product item, and uses it as the `parent_id` for each bundle item to create native **Nested Cart Lines**.
   - Sets `_bundle_parent_product_id` and `_bundle_group_id` as hidden properties on children.
   - On success: triggers cart drawer/redirect (dispatches a custom event for the theme to handle).

**Storefront product data fetching:**

The block needs to show product titles, images, prices, and variants for the bundled products. Two approaches:

| Approach | Pros | Cons |
|----------|------|------|
| **AJAX Product API** (`/products/{handle}.js`) | Simple, no auth needed | Requires product handle (not in metafield), one request per product |
| **Storefront API** (GraphQL) | Batch query, use product IDs directly | Requires Storefront Access Token |
| **Liquid pre-render** | No JS fetch needed, fastest | Requires `all_products[handle]` or section rendering API; limited |

**Recommended approach for bundles:** Use the AJAX API with product handles. Store handles alongside IDs in the metafield (add a `handle` field to each product entry). This avoids needing a Storefront Access Token and works with a simple `fetch()`.

Alternatively, enhance the metafield to include a denormalized snapshot of each product's essential data (title, handle, image URL, price, variants) — written by the admin extension at save time. This eliminates storefront API calls entirely and makes the block render instantly. The trade-off is data staleness; a webhook (`products/update`) can re-sync the snapshot.

For v1, the **AJAX API approach with handles** is simplest. Add `handle` to the metafield product entries.

**Updated metafield product entry:**
```json
{
  "productId": "gid://shopify/Product/1001",
  "handle": "product-b",
  "variantIds": [],
  "discountType": "fixed_amount",
  "discountValue": 10.00
}
```

#### JavaScript API (exposed to theme)

```javascript
// The bundle picker dispatches these custom events on `document`:

// When selections change
"pgb:selection-change" → detail: { selections: [{ productId, variantId, groupId }] }

// After successful add-to-cart
"pgb:added-to-cart" → detail: { items: [...cartItems] }

// Theme can also programmatically get selections:
window.PGB.getSelections() → [{ productId, variantId, quantity, groupId }]
```

This allows the custom theme to listen and react (e.g., update cart count, open cart drawer).

#### CSS: `bundle-picker.css`

Minimal, scoped styles using a `.pgb-` prefix to avoid conflicts. The block should be themeable via CSS custom properties:

```css
:root {
  --pgb-border-color: #e0e0e0;
  --pgb-accent-color: #008060;
  --pgb-radius: 8px;
  --pgb-spacing: 12px;
  --pgb-font-family: inherit;
}
```

#### Storefront UI Layout

```
┌─────────────────────────────────────────────────┐
│  Accessories / Accessoires                       │
│                                                  │
│  ☐  Product B                                    │
│      $50.00  →  $40.00 (−$10.00)                │
│      Variant: [Color ▾]                          │
│                                                  │
│  ☐  Product C                                    │
│      $80.00  →  $68.00 (−$12.00)                │
│                                                  │
├─────────────────────────────────────────────────┤
│  Tools / Outils                                  │
│                                                  │
│  ☐  Product E                                    │
│      $30.00  →  $25.00 (−$5.00)                 │
│                                                  │
└─────────────────────────────────────────────────┘
```

Simple, minimal, no heavy UI framework. Checkboxes, text, optional variant dropdown when relevant.

---

### 5.3 Cart Transform Function

**Purpose:** Server-side validation and price adjustment for bundled items in the cart.
**Tech:** TypeScript, compiled to Wasm via Shopify Functions.
**API:** Cart Transform Function API (2026-04)

#### Generation Command

```bash
pnpm shopify app generate extension --template cart_transform --name bundle-discount
```

#### Configuration (`shopify.extension.toml`)

```toml
api_version = "2026-04"
type = "function"

[[extensions]]
name = "Bundle Discount"
handle = "bundle-discount"

  [extensions.build]
  command = "npm exec -- tsc --outDir dist && npm exec -- javy compile dist/run.js -o dist/index.wasm"

  [extensions.targeting]
  target = "purchase.cart-transform.run"
  input_query = "src/input.graphql"
  export = "run"

  [extensions.ui]
  enable_create = true

  [extensions.ui.paths]
  create = "/app/bundle-settings"
  details = "/app/bundle-settings/:id"
```

> **Crucial Setup Step:** After deploying the cart transform extension, the app backend **must** execute the `cartTransformCreate` GraphQL mutation via the Admin API to activate this function on the shop. It doesn't run automatically unconfigured.

#### Input Query (`src/input.graphql`)

```graphql
query Input {
  cart {
    lines {
      id
      quantity
      cost {
        amountPerQuantity {
          amount
          currencyCode
        }
      }
      merchandise {
        ... on ProductVariant {
          id
          product {
            id
            bundleGroups: metafield(
              namespace: "$app:bundle_groups"
              key: "bundle_groups"
            ) {
              value
            }
          }
        }
      }
      bundleParentProductId: attribute(key: "_bundle_parent_product_id") {
        value
      }
      bundleGroupId: attribute(key: "_bundle_group_id") {
        value
      }
    }
  }
}
```

#### Function Logic (`src/run.ts`)

```typescript
// src/run.ts — Cart Transform Function

import type { RunInput, FunctionRunResult, CartOperation } from "../generated/api";

interface BundleProduct {
  productId: string;
  handle: string;
  variantIds: string[];
  discountType: "fixed_amount";
  discountValue: number;
}

interface BundleGroup {
  id: string;
  name: { en: string; fr: string };
  sortOrder: number;
  products: BundleProduct[];
}

interface BundleConfig {
  version: number;
  groups: BundleGroup[];
}

export function run(input: RunInput): FunctionRunResult {
  const operations: CartOperation[] = [];

  // Build a map of product GID → metafield value for all products in cart
  const parentMetafields = new Map<string, BundleConfig>();
  for (const line of input.cart.lines) {
    if (line.merchandise.__typename === "ProductVariant") {
      const metafield = line.merchandise.product.bundleGroups;
      if (metafield?.value) {
        try {
          const config: BundleConfig = JSON.parse(metafield.value);
          parentMetafields.set(line.merchandise.product.id, config);
        } catch {
          // Invalid JSON — skip
        }
      }
    }
  }

  // Check if parent products are actually in the cart
  const parentProductIdsInCart = new Set<string>();
  for (const line of input.cart.lines) {
    if (line.merchandise.__typename === "ProductVariant") {
      parentProductIdsInCart.add(line.merchandise.product.id);
    }
  }

  // Process bundled lines
  for (const line of input.cart.lines) {
    const parentIdAttr = line.bundleParentProductId?.value;
    const groupIdAttr = line.bundleGroupId?.value;

    if (!parentIdAttr || !groupIdAttr) continue;
    if (line.merchandise.__typename !== "ProductVariant") continue;

    // Validate: parent must be in the cart
    if (!parentProductIdsInCart.has(parentIdAttr)) continue;

    // Get parent's bundle config
    const config = parentMetafields.get(parentIdAttr);
    if (!config) continue;

    // Find the group
    const group = config.groups.find((g) => g.id === groupIdAttr);
    if (!group) continue;

    // Find this product in the group
    const childProductId = line.merchandise.product.id;
    const bundleProduct = group.products.find((p) => p.productId === childProductId);
    if (!bundleProduct) continue;

    // Validate variant restriction
    if (
      bundleProduct.variantIds.length > 0 &&
      !bundleProduct.variantIds.includes(line.merchandise.id)
    ) {
      continue;
    }

    // Calculate and apply fixed-amount discount
    const originalPrice = parseFloat(line.cost.amountPerQuantity.amount);
    const newPrice = Math.max(0, originalPrice - bundleProduct.discountValue);

    operations.push({
      update: {
        cartLineId: line.id,
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: newPrice.toFixed(2),
            },
          },
        },
      },
    });
  }

  return { operations };
}
```

#### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Parent product removed from cart | Bundled items are automatically removed by Shopify (Nested Cart Lines behavior) |
| Invalid `_bundle_parent_product_id` | Ignored (no matching parent) |
| Tampered discount value (client-side) | Irrelevant — discount is read from metafield, not line properties |
| Product not in the group config | Ignored (no matching entry) |
| Variant not allowed | Ignored (variant not in `variantIds` list) |
| Out-of-stock bundle product | Handled by Shopify's standard inventory system before cart transform |
| Multiple quantities | Discount applies per unit (Shopify's `lineUpdate` is per-unit) |
| Discount exceeds product price | Price floors at $0.00 |

---

## 6. App Backend (React Router)

### 6.1 Routes

| Route | File | Purpose |
|-------|------|---------|
| `/app` | `app.tsx` | Layout: nav sidebar, Polaris shell |
| `/app` (index) | `app._index.tsx` | Dashboard: overview, setup guide |
| `/app/bundles` | `app.bundles.tsx` | List of all products with bundle groups configured |
| `/app/bundle-settings` | `app.bundle-settings.tsx` | Cart Transform function configuration page (required by function UI) |
| `/auth/*` | `auth.$.tsx` | Auth handler (existing) |
| `/auth/login` | `auth.login/route.tsx` | Login (existing) |
| `/webhooks/*` | `webhooks.*.tsx` | Webhook handlers (existing) |

### 6.2 Dashboard Page (`app._index.tsx`)

The main app page provides:

1. **Setup checklist** — shows whether the Cart Transform function is active, whether the theme block has been added, etc.
2. **Products with bundles** — quick count and link to the products list.
3. **Quick actions** — link to the Shopify Admin product list (to configure bundles via admin blocks).

Built with Polaris web components (`<s-page>`, `<s-card>`, `<s-text>`, etc.).

### 6.3 API Endpoints

The admin extension communicates directly with the Shopify Admin API (via `admin.graphql()` in the extension). The app backend does **not** need custom API endpoints for bundle CRUD.

However, the app backend **must** handle the following:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bundles/setup-function` | POST | Call `cartTransformCreate` to register the active Cart Transform function for the shop. |
| `/api/bundles/products` | GET | (Optional) List products with bundle configs for the dashboard |
| `/api/bundles/validate` | POST | (Optional) Validate a bundle config JSON before saving |

These are optional and can be deferred to a later phase.

---

## 7. Storefront Integration

### 7.1 Add-to-Cart Flow (Detailed)

```
Customer clicks "Add to Cart"
        │
        ▼
bundle-picker.js intercepts form submit
        │
        ▼
Collects: main product variant ID + quantity
        │
        ▼
Collects: selected bundle products (variant IDs, group IDs)
        │
        ▼
Builds payload (Cart AJAX API):
{
  "items": [
    { 
      "id": mainVariantId, 
      "quantity": 1,
      "properties": { "_uid": "unique123" } 
    },
    { 
      "id": bundleVariantId1, 
      "quantity": 1,
      "parent_id": "unique123", 
      "properties": {
        "_bundle_parent_product_id": "gid://shopify/Product/…",
        "_bundle_group_id": "uuid"
      }
    }
  ]
}
        │
        ▼
POST /cart/add.js
        │
        ▼
Shopify adds items to cart
        │
        ▼
Cart Transform function runs:
  - Validates bundle relationships
  - Applies discounts from metafield
        │
        ▼
Cart shows adjusted prices
        │
        ▼
Dispatches "pgb:added-to-cart" event
        │
        ▼
Theme handles UI update (cart drawer, count, redirect)
```

### 7.2 Cart Display Considerations

By utilizing Shopify's **Nested Cart Lines** feature via `parent_id`, grouped items will naturally nest underneath their parent product in supported themes and checkouts. 

The cart uses `_bundle_parent_product_id` and the Cart Transform applies discounts on the child line items transparently while keeping the parent relationship intact.

*(Note: The legacy approach required custom Liquid logic in the cart to check properties and render badges. Native nested cart lines automatically reflect this relationship).*

### 7.3 Theme Integration Hooks

The custom theme should implement these integration points:

| Hook | Purpose | Implementation |
|------|---------|----------------|
| Product form identification | Let the JS find and intercept the form | Add `data-product-form` attribute to the product `<form>` |
| Cart update event | Theme reacts to bundle additions | Listen for `pgb:added-to-cart` custom event |
| Variant change sync | When main product variant changes, update the bundle picker | Dispatch `pgb:variant-change` with the new variant ID |

---

## 8. Internationalization (i18n)

### Strategy

All user-facing strings are translated into English (default) and French.

| Layer | i18n Method |
|-------|-------------|
| **Product Config Extension** | `locales/en.default.json` + `locales/fr.json` — standard Shopify extension i18n |
| **Theme App Extension** | `locales/en.default.json` + `locales/fr.json` — Liquid `t` filter and JS access via `Shopify.locale` |
| **Cart Transform Function** | N/A (no user-facing strings) |
| **App Backend** | Polaris components respect the admin locale; custom strings via a simple i18n helper |
| **Metafield data** | Group names stored as `{ "en": "…", "fr": "…" }` objects; storefront JS picks the right locale |

### Product Config Extension Locale Files

**`locales/en.default.json`:**
```json
{
  "blockTitle": "Bundle Groups",
  "addGroup": "Add group",
  "groupName": "Group name",
  "groupNameEn": "Name (English)",
  "groupNameFr": "Name (French)",
  "addProduct": "Add product",
  "removeProduct": "Remove",
  "removeGroup": "Remove group",
  "discountType": "Discount type",
  "discountFixed": "Fixed amount ($)",
  "discountValue": "Discount value",
  "save": "Save",
  "saving": "Saving…",
  "saved": "Bundle groups saved",
  "error": "Error saving bundle groups",
  "noGroups": "No bundle groups configured. Add one to get started.",
  "editProduct": "Edit",
  "variants": "Allowed variants",
  "variantsAll": "All variants",
  "variantsSelect": "Select variants…",
  "confirmRemoveGroup": "Remove this group and all its products?",
  "confirmRemoveProduct": "Remove this product from the group?",
  "selfReference": "Cannot add the current product to its own bundle group"
}
```

**`locales/fr.json`:**
```json
{
  "blockTitle": "Groupes de lots",
  "addGroup": "Ajouter un groupe",
  "groupName": "Nom du groupe",
  "groupNameEn": "Nom (anglais)",
  "groupNameFr": "Nom (français)",
  "addProduct": "Ajouter un produit",
  "removeProduct": "Retirer",
  "removeGroup": "Supprimer le groupe",
  "discountType": "Type de remise",
  "discountFixed": "Montant fixe ($)",
  "discountValue": "Valeur de la remise",
  "save": "Enregistrer",
  "saving": "Enregistrement…",
  "saved": "Groupes de lots enregistrés",
  "error": "Erreur lors de l'enregistrement",
  "noGroups": "Aucun groupe de lots configuré. Ajoutez-en un pour commencer.",
  "editProduct": "Modifier",
  "variants": "Variantes autorisées",
  "variantsAll": "Toutes les variantes",
  "variantsSelect": "Sélectionner les variantes…",
  "confirmRemoveGroup": "Supprimer ce groupe et tous ses produits ?",
  "confirmRemoveProduct": "Retirer ce produit du groupe ?",
  "selfReference": "Impossible d'ajouter le produit actuel à son propre groupe"
}
```

### Theme App Extension Locale Files

**`locales/en.default.json`:**
```json
{
  "bundle": {
    "heading": "Add extras",
    "originalPrice": "{{ price }}",
    "discountedPrice": "{{ price }}",
    "discountBadge": "Save {{ amount }}",
    "selectVariant": "Select an option",
    "selected": "Selected",
    "outOfStock": "Out of stock"
  }
}
```

**`locales/fr.json`:**
```json
{
  "bundle": {
    "heading": "Ajoutez des extras",
    "originalPrice": "{{ price }}",
    "discountedPrice": "{{ price }}",
    "discountBadge": "Économisez {{ amount }}",
    "selectVariant": "Sélectionnez une option",
    "selected": "Sélectionné",
    "outOfStock": "Rupture de stock"
  }
}
```

---

## 9. Complete File Structure

```
product-group-bundler/
│
├── app/
│   ├── db.server.ts                          # Prisma client singleton
│   ├── entry.server.tsx                      # SSR entry point
│   ├── globals.d.ts                          # Global type declarations
│   ├── root.tsx                              # Root layout
│   ├── routes.ts                             # Route config (flat routes)
│   ├── shopify.server.ts                     # Shopify app setup
│   │
│   ├── routes/
│   │   ├── _index/
│   │   │   ├── route.tsx                     # Public landing / login redirect
│   │   │   └── styles.module.css
│   │   ├── app.tsx                           # App layout (nav, Polaris shell)
│   │   ├── app._index.tsx                    # Dashboard: setup guide, overview
│   │   ├── app.bundles.tsx                   # Products with bundles list
│   │   ├── app.bundle-settings.tsx           # Cart Transform config (function UI)
│   │   ├── auth.$.tsx                        # Auth catch-all
│   │   ├── auth.login/
│   │   │   ├── error.server.tsx
│   │   │   └── route.tsx
│   │   ├── webhooks.app.uninstalled.tsx
│   │   └── webhooks.app.scopes_update.tsx
│   │
│   └── types/                                # Generated GraphQL types
│       └── admin.generated.d.ts
│
├── extensions/
│   │
│   ├── bundle-group-manager/                 # ── Product Config Extension ──
│   │   ├── src/
│   │   │   ├── BlockExtension.tsx            # Main React component
│   │   │   ├── components/
│   │   │   │   ├── GroupCard.tsx              # Single group editor
│   │   │   │   ├── ProductEntry.tsx           # Product row with discount config
│   │   │   │   └── EmptyState.tsx             # No groups placeholder
│   │   │   ├── hooks/
│   │   │   │   ├── useBundleConfig.ts         # Load/save metafield
│   │   │   │   └── useProductPicker.ts        # Resource picker integration
│   │   │   └── utils/
│   │   │       ├── types.ts                   # TypeScript interfaces
│   │   │       └── validation.ts              # Config validation
│   │   ├── locales/
│   │   │   ├── en.default.json
│   │   │   └── fr.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── shopify.extension.toml
│   │
│   ├── bundle-picker/                        # ── Theme App Extension ──
│   │   ├── assets/
│   │   │   ├── bundle-picker.js              # Interactive UI + add-to-cart logic
│   │   │   └── bundle-picker.css             # Scoped styles
│   │   ├── blocks/
│   │   │   └── bundle-picker.liquid           # App block for product page
│   │   ├── snippets/
│   │   │   └── bundle-product-card.liquid     # Reusable product card snippet
│   │   ├── locales/
│   │   │   ├── en.default.json
│   │   │   └── fr.json
│   │   └── shopify.extension.toml
│   │
│   └── bundle-discount/                      # ── Cart Transform Function ──
│       ├── src/
│       │   ├── run.ts                         # Function entry point
│       │   └── types.ts                       # Shared bundle config types
│       ├── input.graphql                      # Function input query
│       ├── generated/                         # Auto-generated types from input query
│       │   └── api.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── shopify.extension.toml
│
├── prisma/
│   └── schema.prisma                         # Session model only
│
├── shopify.app.toml                          # App config (scopes, metafields, webhooks)
├── shopify.web.toml                          # Web process config
├── package.json                              # Root package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── .graphqlrc.ts
├── .eslintrc.cjs
├── env.d.ts
├── PLAN.md                                   # This document
└── README.md
```

---

## 10. Security

### Threat Model

| Threat | Mitigation |
|--------|------------|
| **Tampered line properties** — customer modifies `_bundle_parent_id` or discount values via browser | Cart Transform reads discount from the metafield (server-side source of truth), not from line properties. Invalid parent IDs are silently ignored. |
| **Inflated discount** — customer crafts a request with a higher discount | Discount values are never sent from the client. Cart Transform extracts them from the product metafield. |
| **Self-referencing bundle** — product added to its own bundle | Config extension prevents this at config time; Cart Transform also ignores if child product ID equals parent product ID. |
| **Removed parent** — bundle item exists without its parent in the cart | Cart Transform only applies discount if the parent product is present in the cart. |
| **Stale metafield** — metafield was updated but cart still has old line properties | Line properties only reference IDs, not discount amounts. The function always reads the current metafield value. |
| **XSS in metafield JSON** — malicious data in group names | Liquid's `escape` filter sanitizes output; JS uses `textContent` or DOM APIs, not `innerHTML`. |
| **Rate limiting / abuse** — excessive add-to-cart requests | Standard Shopify rate limits apply to `/cart/add.js`. |

### Best Practices Applied

- Metafield admin access is `merchant_read` (merchant can view but not directly edit; only the app writes).
- Storefront access is `public_read` (needed for Liquid rendering).
- No secrets or tokens are stored in metafields.
- Cart Transform function has no network access (runs in isolated Wasm sandbox).

---

## 11. Limitations & Requirements

### Shopify Plan Requirements

| Feature | Required Plan |
|---------|---------------|
| Cart Transform `lineUpdate` (price changes) | **Shopify Plus** or **Development store** |
| Theme app extensions | Any plan with Online Store |
| Product configuration extensions | Any plan |
| Shopify Functions | Shopify plan with app support |

> **Critical:** The `lineUpdate` operation for price adjustment requires **Shopify Plus** (or a development store). This is a Shopify platform restriction. If the store is not on Plus, an alternative approach using **Automatic Discounts** (Discount Function) would be needed instead of Cart Transform for the pricing.

### Platform Constraints

| Constraint | Impact |
|------------|--------|
| **Nested Cart Line Limitations** | Cannot nest under existing product bundles/components. Only 1 level of nesting allowed. Not compatible with Draft Orders API, POS, or Script Editor. |
| **One Cart Transform per store** | If another app already uses Cart Transform, there will be a conflict. |
| **Selling plans incompatible** | Cart Transform operations are rejected for subscription items. |
| **Metafield size limit** | ~256 KB per metafield. Sufficient for hundreds of bundle products. |
| **Function execution time** | 5ms limit. JSON parsing + iteration must be fast. Keep configs reasonable. |
| **No network access in Functions** | The function can only use data from its input query. All needed data must be in the cart/metafields. |

### Assumptions

- The store uses **Online Store 2.0** theme (required for app blocks).
- The custom theme's product form can be identified via a `data-product-form` attribute or `form[action*="/cart/add"]`.
- Products in bundle groups are standard Shopify products (not draft, not gift cards).
- Currency is consistent within a store (multi-currency is handled by Shopify's currency conversion on top of the adjusted price).

---

## 12. Implementation Phases

### Phase 1 — Foundation (Core Functionality)

**Goal:** Working end-to-end flow with basic features.

| # | Task | Extension | Estimated Effort |
|---|------|-----------|-----------------|
| 1.1 | Clean up scaffolded code: remove demo route content, demo metafield/metaobject from TOML | App | 1h |
| 1.2 | Update `shopify.app.toml`: scopes, metafield definition | App | 30min |
| 1.3 | Generate product configuration extension scaffold | Product Config | 30min |
| 1.4 | Build product config: load metafield, add/remove groups, add/remove products, set discount, save | Product Config | 8h |
| 1.5 | Add locales (EN + FR) for product config extension | Product Config | 1h |
| 1.6 | Generate cart transform function scaffold | Cart Transform | 30min |
| 1.7 | Write input query + function logic, register `cartTransformCreate` | Cart Transform / App | 4h |
| 1.8 | Generate theme app extension scaffold | Theme Block | 30min |
| 1.9 | Build Liquid block template | Theme Block | 2h |
| 1.10 | Build JS: parse config, fetch product data, render UI, handle selection, intercept add-to-cart | Theme Block | 8h |
| 1.11 | Build CSS: minimal styling | Theme Block | 2h |
| 1.12 | Add locales (EN + FR) for theme block | Theme Block | 1h |
| 1.13 | Update app dashboard route | App | 2h |
| 1.14 | End-to-end testing on dev store | All | 4h |

**Phase 1 total: ~35 hours**

### Phase 2 — Polish & Refinements

| # | Task | Extension |
|---|------|-----------|
| 2.1 | Variant restriction support in config extension (select specific variants) | Product Config |
| 2.2 | Variant selector UI on storefront block | Theme Block |
| 2.3 | Group reordering (drag-and-drop or arrows) in config extension | Product Config |
| 2.4 | Product availability checks (out-of-stock, draft) in theme block | Theme Block |
| 2.5 | Cart display enhancements: "bundle" badge, visual grouping of bundled items | Theme |
| 2.6 | Product handle auto-resolution in config extension (fetch handle when adding product) | Product Config |
| 2.7 | Loading skeletons in config extension and theme block | Both |
| 2.8 | Error handling and edge case coverage | All |

### Phase 3 — Advanced Features (Future)

| # | Task |
|---|------|
| 3.1 | Denormalized product snapshots in metafield (eliminate storefront API calls) |
| 3.2 | `products/update` webhook to re-sync snapshot data when bundle products change |
| 3.3 | Bulk bundle management page in the app |
| 3.4 | Analytics: track bundle selection rates |
| 3.5 | Multi-quantity bundles (add 2x of a bundle product) |
| 3.6 | Tiered discounts (bigger discount when more items selected) |
| 3.7 | Cross-sell: "Customers also bundled…" recommendations |
| 3.8 | Alternative discount mechanism for non-Plus stores (Discount Function) |

---

## 13. Testing Strategy

### Manual Testing Checklist

**Product Config Extension:**
- [ ] Extension appears on product detail page under "Bundled products" card in Admin
- [ ] Can create a new group with EN + FR names
- [ ] Can add a product to a group via picker
- [ ] Cannot add the current product to its own group
- [ ] Can set fixed_amount discounts
- [ ] Can remove a product from a group
- [ ] Can remove a group entirely
- [ ] Save persists to metafield (verify via Admin API)
- [ ] Reload page: saved config loads correctly
- [ ] Empty state shows when no groups exist
- [ ] FR locale renders correctly when admin is in French

**Theme Block:**
- [ ] Block appears in theme editor under "Apps"
- [ ] Block renders on product page when product has bundle config
- [ ] Block is hidden when product has no bundle config
- [ ] Products display with title, price, and discount info
- [ ] Checking a product updates the selection state
- [ ] Variant dropdown appears for multi-variant products
- [ ] Locale switches correctly (EN/FR)
- [ ] Clicking "Add to Cart" adds main product + selected bundle products
- [ ] Nested properties set correctly: `parent_id` links the items, `_bundle_parent_product_id` and `_bundle_group_id` are set
- [ ] `pgb:added-to-cart` event fires

**Cart Transform:**
- [ ] Bundled items show discounted price in cart
- [ ] Fixed amount discount calculates correctly
- [ ] Fixed amount discount calculates correctly
- [ ] Removing parent product from cart: bundled items automatically removed by Shopify
- [ ] Adding a product with fake `_bundle_parent_product_id`: no discount applied
- [ ] Products not in the metafield config: no discount applied
- [ ] Discount does not exceed product price (floors at $0)
- [ ] Function handles empty/missing metafield gracefully
- [ ] Checkout shows correct totals

**Integration:**
- [ ] Full flow: configure in admin → view on storefront → add to cart → correct prices in checkout
- [ ] Works with multiple bundle groups on the same product
- [ ] Works with products that appear in multiple products' bundle groups
- [ ] Cart Transform performance is under 5ms

### Automated Testing

| Test Type | Tool | Coverage |
|-----------|------|----------|
| Cart Transform unit tests | Vitest / Jest | Function logic with mock inputs |
| Config extension component tests | `@shopify/ui-extensions-test-utils` | Component rendering and interactions |
| Theme block JS tests | Vitest | Selection logic, payload building |
| E2E tests | (Future) Playwright | Full add-to-cart flow on dev store |

---

## Appendix A: GraphQL Mutations Reference

### Create/Update Bundle Config on a Product

```graphql
mutation UpdateBundleGroups($productId: ID!, $configJson: String!) {
  productUpdate(
    input: {
      id: $productId,
      metafields: [
        {
          namespace: "app--product-group-bundler",
          key: "bundle_groups",
          type: "json",
          value: $configJson
        }
      ]
    }
  ) {
    product {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

### Delete Bundle Config from a Product

```graphql
mutation DeleteBundleGroups($metafieldId: ID!) {
  metafieldDelete(input: { id: $metafieldId }) {
    deletedId
    userErrors {
      field
      message
    }
  }
}
```

### Fetch Products with Bundle Configs (for Dashboard)

```graphql
query ProductsWithBundles($first: Int!, $after: String) {
  products(
    first: $first,
    after: $after,
    query: "metafields.app--product-group-bundler.bundle_groups:*"
  ) {
    edges {
      node {
        id
        title
        handle
        featuredImage {
          url(transform: { maxWidth: 100 })
        }
        metafield(namespace: "app--product-group-bundler", key: "bundle_groups") {
          value
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## Appendix B: Metafield Namespace Reference

The app-owned metafield uses different namespace formats depending on the context:

| Context | Namespace | Example |
|---------|-----------|---------|
| **Admin API** (GraphQL) | `app--{APP_ID}` | `metafield(namespace: "app--{APP_ID}", key: "bundle_groups")` |
| **Shopify Functions** (input query) | `$app:bundle_groups` | `metafield(namespace: "$app:bundle_groups", key: "bundle_groups")` |
| **Liquid** (theme) | `app--{APP_ID}` | `product.metafields['app--' | append: app.id].bundle_groups` |
| **TOML** (declaration) | `app.bundle_groups` | `[product.metafields.app.bundle_groups]` |
| **REST API** | `app--{APP_ID}` | `/metafields.json?namespace=app--{APP_ID}` |

> **Note:** In Shopify Functions, the `$app:` prefix allows the function to access its own app's metafields without hardcoding the full namespace. The format in the input query is `namespace: "$app:bundle_groups"` where `bundle_groups` is the **namespace suffix** after the app prefix, and the `key` parameter is the metafield key. Double-check this against the latest Shopify Functions docs at implementation time, as the syntax may vary by API version.

---

## Appendix C: Custom Theme Integration Snippet

Minimal code the custom theme needs to integrate with the bundle picker:

**Product form (e.g., `sections/main-product.liquid`):**
```liquid
<form
  action="/cart/add"
  method="post"
  data-product-form
  data-product-id="{{ product.id }}"
>
  {%- comment -%} Standard variant selector, quantity, etc. {%- endcomment -%}

  {%- comment -%} The bundle-picker app block renders here via theme editor {%- endcomment -%}
  {% content_for 'blocks' %}

  <button type="submit" name="add">
    {{ 'products.product.add_to_cart' | t }}
  </button>
</form>
```

**Cart drawer / cart page update listener:**
```javascript
document.addEventListener('pgb:added-to-cart', (event) => {
  // event.detail.items contains the added cart items
  // Update cart count, open drawer, etc.
  updateCartUI();
});
```

---

*Document version: 1.0 — March 2026*
*Last updated: {{ now }}*
