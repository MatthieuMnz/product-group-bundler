# Product Group Bundler

Shopify app that lets merchants configure grouped add-ons on products and apply server-side bundle discounts in cart/checkout.

## Architecture

- App backend: React Router app in `app/` (auth, dashboard, setup actions, webhooks).
- Admin UI extensions:
  - `extensions/product-configuration` (`bundle-group-manager`) summary block on product details.
  - `extensions/bundle-action` (`bundle-config-action`) full editing action modal.
- Theme app extension: `extensions/theme-extension` (`bundle-picker`) storefront bundle picker block.
- Cart Transform function: `extensions/cart-transformer` (`bundle-discount`) discount enforcement.
- Shared domain contract: `shared/bundle-domain.ts` (bundle types, parsing, validation, normalization).

## Prerequisites

- Node `>=20.19 <22 || >=22.12`
- pnpm `10.29.2` (pinned in `package.json`)
- Shopify CLI

## Local Development

```bash
pnpm install
pnpm run dev
```

## Core Commands

- `pnpm run lint` - ESLint across repo
- `pnpm run typecheck` - React Router typegen + TypeScript checks
- `pnpm run test` - Root vitest suites (`tests/`)
- `pnpm run test:extensions` - Cart transform unit tests
- `pnpm run check` - Full quality gate used by CI
- `pnpm run deploy` - Shopify app deploy

## Testing

Current automated coverage includes:

- Cart transform logic: `extensions/cart-transformer/src/run.test.ts`
- Shared bundle domain contract: `tests/shared/bundle-domain.test.ts`
- Theme add-to-cart payload logic: `tests/theme/bundle-picker.test.ts`

Optional legacy integration fixtures remain in `extensions/cart-transformer/tests/default.test.js` and can be run with:

```bash
pnpm --filter cart-transformer run test:integration
```

## Configuration Notes

- App/extension API versions are aligned to `2026-04`.
- Web process commands use `pnpm exec` in `shopify.web.toml`.
- Required Shopify environment variables are validated in `app/shopify.server.ts`.

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

It runs:

```bash
pnpm install --frozen-lockfile
pnpm run check
```

## Related Docs

- Implementation details and roadmap: `PLAN.md`
- UI/style tokens and conventions: `STYLE-GUIDE.md`
