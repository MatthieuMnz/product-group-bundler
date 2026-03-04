# Horizon iCarsoft — Design System & Style Guide

Reference for theme styling so apps and other codebases (embeds, checkout UI, etc.) can align with the same design language, colors, typography, and spacing.

**Source of truth in theme:**  
- Global tokens: `snippets/theme-styles-variables.liquid`  
- Color schemes: `snippets/color-schemes.liquid`

---

## 1. Brand colors (default scheme)

Values below are the **default theme colors** from `settings_data.json` (scheme-1). Use these when you can’t read CSS variables (e.g. non-CSS contexts).

| Role | Hex | Usage |
|------|-----|--------|
| **Primary** | `#de1a00` | CTAs, links, accents, selected states |
| **Primary hover** | `#b81500` | Hover on primary buttons/links |
| **Foreground** | `#15151e` | Body text, icons |
| **Foreground heading** | `#15151e` | Headings (can match foreground) |
| **Background** | `#ffffff` | Page/section backgrounds |
| **Secondary background** | — | Alternate sections (e.g. `#f9f7f6`) |
| **Border** | `#efefef` | Dividers, inputs, cards |
| **Shadow** | `#15151e` | Overlays, popovers (with opacity) |

### Primary button (default)

- Background: `#de1a00`  
- Text: `#ffffff`  
- Border: `#de1a00`  
- Hover background: `#b81500`  
- Hover text: `#ffffff`  
- Hover border: `#b81500`

### Secondary button (default)

- Background: transparent  
- Text: `#15151e`  
- Border: `#15151e`  
- Hover background: `#f9f7f6`  
- Hover text/border: `#15151e`

### Inputs (default)

- Background: `#ffffff`  
- Text: `#15151e`  
- Border: `#efefef`  
- Hover background: `#f9f7f6`

### Status colors (theme-wide tokens)

| Token | Default | Use |
|-------|---------|-----|
| Error | `#8B0000` | Errors, destructive actions |
| Success | `#006400` | Success messages, confirmations |
| In stock | `#3ED660` | Availability |
| Low stock | `#EE9441` | Low inventory |
| Out of stock | `#C8C8C8` | Unavailable |
| White | `#FFFFFF` | Surfaces, button text |
| Black | `#000000` | Contrast, overlays |

---

## 2. Typography

### Font stack

- **Primary font:** **Biennale** (custom OTF), with Shopify body font as fallback (e.g. Inter).  
  Theme option: `use_biennale_*_font` toggles Biennale for body, subheading, heading, accent.
- **Body:** `--font-body--family` (Biennale when enabled).  
  Default Shopify font: Inter, normal weight.
- **Subheading:** `--font-subheading--family`.  
  Default: Inter medium.
- **Heading:** `--font-heading--family`.  
  Default: Inter bold.
- **Accent:** `--font-accent--family`.  
  Default: Inter bold.

Use **Biennale** (or the same fallback as the theme) in apps for headings and key UI text to match the storefront.

### Font weights (numeric defaults)

| Token | Default | Use |
|-------|---------|-----|
| `--font-weight-regular` | 400 | Body |
| `--font-weight-medium` | 500 | Subheadings, labels |
| `--font-weight-semibold` | 600 | Emphasis |
| `--font-weight-bold` | 700 | Headings, CTAs |
| `--font-weight-extrabold` | 800 | Display |

### Type scale (utility sizes, in rem)

Scale is defined as **thousandths of 1rem** in settings (e.g. 1000 = 1rem). Default equivalents:

| Token | Approx. size | Use |
|-------|----------------|-----|
| `--font-size--2xs` | 0.625rem (10px) | Captions, overlines |
| `--font-size--xs` | ~0.8125rem (13px) | Small UI text |
| `--font-size--sub-sm` | 0.75rem (12px) | Fine print |
| `--font-size--sm` | 0.875rem (14px) | Secondary text |
| `--font-size--md` | 1rem (16px) | Body default |
| `--font-size--lg` | 1.125rem (18px) | Lead text |
| `--font-size--xl` | 1.25rem (20px) | H4-style |
| `--font-size--2xl` | 1.5rem (24px) | H3-style |
| `--font-size--2_5xl` | 1.75rem (28px) | — |
| `--font-size--3xl` | 2rem (32px) | H3 large |
| `--font-size--4xl` | 2.5rem (40px) | H2-style |
| `--font-size--5xl` | 3rem (48px) | H1-style |
| `--font-size--6xl` | 3.5rem (56px) | Display |

### Preset sizes (headings & paragraph)

Theme uses **responsive presets**; values can be fluid (clamp) or fixed depending on theme settings:

- **Paragraph:** `--font-paragraph--*` (size, family, weight, line-height, letter-spacing).
- **Headings:** `--font-h1--*` … `--font-h6--*` (same structure).  
  Default sizes (px): H1 56, H2 48, H3 32, H4 24, H5 14, H6 12.

### Line height

- **Display:** tight 1, normal 1.1, loose 1.2  
- **Heading:** tight 1.15, normal 1.25, loose 1.35  
- **Body:** tight 1.2, normal 1.4, loose 1.6  

Paragraph default: `body-loose` (1.6).

### Letter spacing

- **Tight:** -0.03em  
- **Normal:** 0  
- **Loose:** 0.03em  

Utility: `--letter-spacing-sm: 0.06em`, `--letter-spacing-md: 0.13em`.

---

## 3. Spacing

All spacing uses a **scale in thousandths of 1rem** (e.g. 1000 = 1rem). Use the same scale in apps for consistency.

### Margins (`--margin-*`)

3xs, 2xs, xs, sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl.  
Example defaults: xs ≈ 0.5rem, sm ≈ 0.7rem, md ≈ 0.8rem, lg = 1rem, xl = 1.25rem, 2xl = 1.5rem, 3xl = 1.75rem, 4xl = 2rem, 5xl = 3rem, 6xl = 5rem.

### Padding (`--padding-*`)

3xs through 10xl. Same scale idea (e.g. md ≈ 0.8rem, lg = 1rem, 2xl = 1.5rem).

### Gap (`--gap-*`)

3xs, 2xs, xs, sm, md, lg, xl, 2xl, 3xl.  
Example: md ≈ 0.9rem, lg = 1rem, xl = 1.25rem, 2xl = 2rem.

### Semantic

- **Menu item padding:** `--space-menu-item-padding-inline`, `--space-menu-item-padding-block` (defaults ~1rem, 0.875rem).
- **Scroll margin (anchor offset):** `--scroll-margin: 50px`.

---

## 4. Borders & radius

### Widths

- `--border-width-sm`: 1px (default)  
- `--border-width-md`: 2px  
- `--border-width-lg`: 5px  
- Default “style” border: `--style-border-width` (uses sm).

### Radii (defaults)

- `--style-border-radius-xs`: ~0.2rem  
- `--style-border-radius-sm`: ~0.6rem  
- `--style-border-radius-md`: ~0.8rem  
- `--style-border-radius-lg`: 1rem  

**Component defaults in theme:**  
- Primary button: 8px  
- Secondary button: 14px  
- Inputs: 4px  
- Popover: 14px  
- Card: 4px  
- Variant swatch: 32px (pill)  
- Variant button: 14px  

---

## 5. Opacity scale

Use for overlays, disabled states, borders:

- `--opacity-5` … `--opacity-90` (0.05 … 0.9)  
- Subdued text: `--opacity-subdued-text` (0.7)  
- Disabled: `--disabled-opacity: 0.5`

---

## 6. Motion & easing

- **Durations:** fast 0.0625s, default 0.125s, slow 0.2s, medium 0.15s.  
- **Easing:** `--ease-out-cubic`, `--ease-out-quad`, `--animation-easing: ease-in-out`.  
- **Hover:** `--animation-timing-hover: cubic-bezier(0.25, 0.46, 0.45, 0.94)`.  
- **Drawer:** `--drawer-animation-speed: 0.2s`.

Respect `prefers-reduced-motion` for any non-essential animation.

---

## 7. Layout & breakpoints

### Content widths (rem)

- **Sidebar:** 25rem  
- **Narrow content:** 36rem  
- **Normal content:** 42rem  
- **Wide content:** 46rem  
- **Page:** narrow 90rem, normal 120rem, wide 150rem  

### Breakpoints (theme convention)

- **Mobile → tablet:** `750px` (common in sections).  
- **Small → medium:** `40em` (e.g. section heights).  
- **Medium → large:** `60em` (e.g. section heights).

Use the same breakpoints in apps when layout should feel consistent with the theme.

---

## 8. Z-index (layering)

Use this order so overlays and modals sit correctly:

- Section background: -2  
- Base: 0, flat: 1, raised: 2, heightened: 4  
- Sticky: 8  
- Window overlay: 10  
- Header/menu: 12  
- Overlay: 16  
- Menu drawer: 18  
- Temporary (e.g. tooltips): 20  

---

## 9. Focus & a11y

- **Outline width:** `--focus-outline-width: 0.09375rem`  
- **Offset:** `--focus-outline-offset: 0.2em`  
- Ensure focus visible on primary/secondary buttons and inputs; contrast ≥ 3:1 for UI components (WCAG 2.2).

---

## 10. Using theme tokens in CSS (when in theme)

- **Colors:** Prefer `var(--color-primary)`, `var(--color-foreground)`, `var(--color-background)`, etc.  
- **With alpha:** `rgb(var(--color-primary-rgb) / 0.15)` so color schemes stay consistent.  
- **Spacing:** `var(--padding-md)`, `var(--margin-lg)`, `var(--gap-sm)`.  
- **Typography:** `var(--font-paragraph--size)`, `var(--font-h2--size)`, `var(--font-weight-bold)`.  
- **Borders:** `var(--style-border-width)`, `var(--style-border-radius-sm)`.

---

## 11. Apps & other codebases

- Prefer the **hex values** in §1 and **numeric weights/sizes** in §2 when you can’t use the theme’s CSS.  
- Use the same **primary (#de1a00)** and **foreground (#15151e)** for CTAs and text.  
- Use the same **border (#efefef)** and **radius** (e.g. 8px primary button, 14px secondary) where possible.  
- Use **Biennale** (or the theme’s fallback font) for headings and key UI if assets are available; otherwise match weight (e.g. 700 for headings).  
- Use the **spacing scale** (e.g. 4, 8, 12, 16, 24, 32 px) derived from the theme’s rem scale.  
- Respect **reduced motion** and **focus visibility** for accessibility.

---

*Theme: Horizon iCarsoft. Token source: `snippets/theme-styles-variables.liquid`, `snippets/color-schemes.liquid`. Default colors from `config/settings_data.json`.*
