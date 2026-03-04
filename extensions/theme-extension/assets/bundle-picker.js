class PgbBundlePicker extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        if (this.dataset.initialized) return;
        this.dataset.initialized = 'true';
        this.init();
    }

    async init() {
        const rawConfig = this.getAttribute('data-bundle-config');
        if (!rawConfig) return;

        try {
            const config = JSON.parse(rawConfig);
            const mainProductGid = this.getAttribute('data-product-gid');
            const locale = this.getAttribute('data-locale') || 'en';
            const currencySymbol = this.getAttribute('data-currency-symbol') || '$';
            const customHeading = this.getAttribute('data-heading') || 'Bundle';

            // Fetch product details via AJAX
            const productData = {};
            for (const group of config.groups) {
                for (const product of group.products) {
                    if (product.handle && !productData[product.handle]) {
                        try {
                            const res = await fetch(`/products/${product.handle}.js`);
                            if (res.ok) {
                                productData[product.handle] = await res.json();
                            }
                        } catch (e) {
                            console.error("Failed to fetch product:", product.handle, e);
                        }
                    }
                }
            }

            this.renderGroups(config, productData, locale, currencySymbol, customHeading, mainProductGid);
            this.interceptAddToCart();
        } catch (err) {
            console.error("Bundle picker error:", err);
            // Don't overwrite the entire container or it will break statically positioned elements like labels
            this.innerHTML = `<p style="color:red;">Error loading bundles.</p>`;
        }
    }

    renderGroups(config, productData, locale, currencySymbol, customHeading, mainProductGid) {
        let html = ``;
        if (customHeading) {
            html += `<h4>${customHeading}</h4>`;
        }

        // Try to get translations from a hidden element if provided by the theme, otherwise fallback
        const tOutOfStock = window.pgbTranslations?.outOfStock || 'Out of stock';

        html += `<div class="pgb-groups-wrapper">`;

        config.groups.forEach((group) => {
            const title = group.name || 'Bundle Group';
            html += `<div class="pgb-group" data-group-id="${group.id}">
      <h3 class="pgb-group-title">${title}</h3>
      <div class="pgb-group-items">`;

            group.products.forEach(prod => {
                const data = productData[prod.handle];
                // If product doesn't exist or has no variants, skip rendering
                if (!data || !data.variants || data.variants.length === 0) return;

                // Determine which variants are allowed
                let allowedVariants = data.variants;
                if (prod.variantIds && prod.variantIds.length > 0) {
                    allowedVariants = data.variants.filter(v => {
                        const variantGid = `gid://shopify/ProductVariant/${v.id}`;
                        return prod.variantIds.includes(variantGid) || prod.variantIds.includes(String(v.id));
                    });
                    if (allowedVariants.length === 0) allowedVariants = data.variants;
                }

                // Check availability
                const availableVariants = allowedVariants.filter(v => v.available);
                const isEntirelyOutOfStock = availableVariants.length === 0;

                // Default to the first *available* variant if possible, otherwise just the first
                const defaultVariant = availableVariants.length > 0 ? availableVariants[0] : allowedVariants[0];

                const origPrice = (defaultVariant.price / 100).toFixed(2);
                const newPrice = Math.max(0, origPrice - prod.discountValue).toFixed(2);
                const hasMultipleVariants = allowedVariants.length > 1;

                const cardClass = isEntirelyOutOfStock ? 'pgb-product-card pgb-product-card--unavailable' : 'pgb-product-card';
                const disabledAttr = isEntirelyOutOfStock ? 'disabled' : '';

                html += `
        <label class="${cardClass}">
          <input type="checkbox" class="pgb-checkbox" 
                 data-group-id="${group.id}" 
                 data-product-id="${prod.productId}" 
                 data-variant-id="${defaultVariant.id}" 
                 data-parent-product-gid="${mainProductGid}"
                 data-discount="${prod.discountValue}"
                 ${disabledAttr} />
          <div class="pgb-product-info">
            <span class="pgb-product-title">${data.title}</span>
            <span class="pgb-product-price">
              <span class="pgb-old-price">${currencySymbol}${origPrice}</span>
              <span class="pgb-new-price">${currencySymbol}${newPrice}</span>
            </span>`;

                if (isEntirelyOutOfStock) {
                    html += `<span class="pgb-out-of-stock-badge">${tOutOfStock}</span>`;
                }

                // Variant selector for multi-variant products
                if (hasMultipleVariants && !isEntirelyOutOfStock) {
                    html += `
            <select class="pgb-variant-selector" data-product-handle="${prod.handle}" data-discount="${prod.discountValue}" data-currency="${currencySymbol}">`;
                    allowedVariants.forEach((v) => {
                        const vDisabled = !v.available ? ' disabled' : '';
                        const vSelected = v.id === defaultVariant.id ? ' selected' : '';
                        const vLabel = v.title + (v.available ? ` — ${currencySymbol}${(v.price / 100).toFixed(2)}` : ` (${tOutOfStock})`);
                        html += `<option value="${v.id}" data-price="${v.price}"${vDisabled}${vSelected}>${vLabel}</option>`;
                    });
                    html += `</select>`;
                }

                html += `
          </div>
        </label>
      `;
            });

            html += `</div></div>`;
        });

        html += '</div>';
        this.innerHTML = html;

        // Attach variant change listeners
        this.querySelectorAll('.pgb-variant-selector').forEach(select => {
            select.addEventListener('change', (e) => {
                const sel = e.target;
                const card = sel.closest('.pgb-product-card');
                const checkbox = card.querySelector('.pgb-checkbox');
                const selectedOption = sel.options[sel.selectedIndex];
                const variantPrice = parseFloat(selectedOption.dataset.price) / 100;
                const discount = parseFloat(sel.dataset.discount) || 0;
                const currency = sel.dataset.currency || '$';

                // Update the variant ID on the checkbox
                checkbox.setAttribute('data-variant-id', sel.value);

                // Update displayed prices
                const oldPriceEl = card.querySelector('.pgb-old-price');
                const newPriceEl = card.querySelector('.pgb-new-price');
                if (oldPriceEl) oldPriceEl.textContent = `${currency}${variantPrice.toFixed(2)}`;
                if (newPriceEl) newPriceEl.textContent = `${currency}${Math.max(0, variantPrice - discount).toFixed(2)}`;
            });
        });
    }

    interceptAddToCart() {
        if (window._pgbIntercepted) return;
        window._pgbIntercepted = true;

        window.addEventListener('submit', async (e) => {
            const form = e.target;
            if (!form || form.tagName !== 'FORM') return;

            const action = form.getAttribute('action') || '';
            if (!action.includes('/cart/add')) return;

            const checkedBoxes = document.querySelectorAll('.pgb-checkbox:checked');
            if (checkedBoxes.length === 0) return; // No bundles selected, let it submit normally

            const formData = new FormData(form);
            const mainVariantId = formData.get('id');
            const mainQty = formData.get('quantity') || 1;

            if (!mainVariantId) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("PGB: Intercepting add to cart for bundle items...");

            const submitBtn = form.querySelector('[type="submit"], button');
            if (submitBtn) {
                submitBtn.setAttribute('data-orig-text', submitBtn.innerHTML);
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
            }

            const items = [{
                id: parseInt(mainVariantId, 10),
                quantity: parseInt(mainQty, 10)
            }];

            checkedBoxes.forEach(box => {
                const vid = box.getAttribute('data-variant-id');
                const gid = box.getAttribute('data-group-id');
                const pgid = box.getAttribute('data-parent-product-gid');
                if (vid) {
                    items.push({
                        id: parseInt(vid, 10),
                        quantity: 1, // Defaulting to 1 for bundle item
                        parent_id: parseInt(mainVariantId, 10),
                        properties: {
                            "_bundle_parent_product_id": pgid,
                            "_bundle_group_id": gid
                        }
                    });
                }
            });

            console.log("PGB: Submission payload:", { items });

            try {
                // Determine root URL, respecting localized stores
                const rootUrl = window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/';
                const addUrl = rootUrl + (rootUrl.endsWith('/') ? 'cart/add.js' : '/cart/add.js');

                const res = await fetch(addUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items })
                });

                if (res.ok) {
                    const cartData = await res.json();
                    document.dispatchEvent(new CustomEvent('pgb:added-to-cart', { detail: { items: cartData.items } }));
                    window.location.href = rootUrl + (rootUrl.endsWith('/') ? 'cart' : '/cart');
                } else {
                    const error = await res.json();
                    console.error("PGB: Failed to add products to cart", error);
                    alert("Erreur lors de l'ajout au panier. Veuillez réessayer.");
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                    }
                }
            } catch (err) {
                console.error("PGB: Network error when adding bundle to cart", err);
                form.submit();
            }
        }, true);
    }
}

if (!customElements.get('pgb-bundle-picker')) {
    customElements.define('pgb-bundle-picker', PgbBundlePicker);
}
