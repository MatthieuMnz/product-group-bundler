function isRecord(value) {
    return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeBundleConfig(rawConfig) {
    if (!isRecord(rawConfig) || !Array.isArray(rawConfig.groups)) {
        return null;
    }

    const groups = rawConfig.groups
        .filter((group) => isRecord(group))
        .map((group) => {
            const products = Array.isArray(group.products) ? group.products : [];
            return {
                id: typeof group.id === 'string' ? group.id : '',
                name: typeof group.name === 'string' ? group.name : 'Bundle Group',
                products: products
                    .filter((product) => isRecord(product))
                    .map((product) => {
                        const variantIds = Array.isArray(product.variantIds)
                            ? product.variantIds.filter((id) => typeof id === 'string' && id.length > 0)
                            : [];
                        const variantDiscounts = Array.isArray(product.variantDiscounts)
                            ? product.variantDiscounts
                                .filter((discount) => isRecord(discount) && typeof discount.id === 'string')
                                .map((discount) => ({
                                    id: discount.id,
                                    discountValue: toFiniteNumber(discount.discountValue, 0),
                                }))
                            : [];

                        return {
                            productId: typeof product.productId === 'string' ? product.productId : '',
                            handle: typeof product.handle === 'string' ? product.handle : '',
                            title: typeof product.title === 'string' ? product.title : '',
                            _price: typeof product._price === 'string' ? product._price : '0.00',
                            _imageUrl: typeof product._imageUrl === 'string' ? product._imageUrl : '',
                            discountValue: toFiniteNumber(product.discountValue, 0),
                            variantIds,
                            variantDiscounts,
                        };
                    })
                    .filter((product) => product.productId.length > 0),
            };
        })
        .filter((group) => group.id.length > 0 && group.products.length > 0);

    if (groups.length === 0) {
        return null;
    }

    return {
        version: toFiniteNumber(rawConfig.version, 1),
        groups,
    };
}

function buildRootUrl() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
}

class PgbBundlePicker extends HTMLElement {
    constructor() {
        super();
        this.bundleConfig = null;
        this.boundForm = null;
        this.submitHandler = null;
        this.errorMessage = '';
    }

    connectedCallback() {
        if (this.dataset.initialized) return;
        this.dataset.initialized = 'true';
        this.init();
    }

    disconnectedCallback() {
        if (this.boundForm && this.submitHandler) {
            this.boundForm.removeEventListener('submit', this.submitHandler, true);
        }
        this.boundForm = null;
        this.submitHandler = null;
    }

    setError(message) {
        this.errorMessage = message || '';
        const host = this.querySelector('.pgb-error-message');
        if (host) {
            host.textContent = this.errorMessage;
            host.hidden = !this.errorMessage;
        }
    }

    async init() {
        const rawConfig = this.getAttribute('data-bundle-config');
        if (!rawConfig) return;

        try {
            const parsedConfig = JSON.parse(rawConfig);
            const config = normalizeBundleConfig(parsedConfig);
            if (!config) return;

            this.bundleConfig = config;
            const mainProductGid = this.getAttribute('data-product-gid') || '';
            const locale = this.getAttribute('data-locale') || 'en';
            const currencySymbol = this.getAttribute('data-currency-symbol') || '$';
            const customHeading = this.getAttribute('data-heading') || 'Bundle';

            this.renderSkeleton(config, customHeading);
            this.renderGroups(config, {}, locale, currencySymbol, customHeading, mainProductGid);
            this.interceptAddToCart();

            const productData = {};
            const rootUrl = buildRootUrl();
            const fetchTasks = [];
            for (const group of config.groups) {
                for (const product of group.products) {
                    if (!product.handle || productData[product.handle]) continue;
                    const url = rootUrl + (rootUrl.endsWith('/') ? '' : '/') + 'products/' + product.handle + '.js';
                    fetchTasks.push(
                        fetch(url)
                            .then((res) => (res.ok ? res.json() : null))
                            .then((json) => {
                                if (json) {
                                    productData[product.handle] = json;
                                }
                            })
                            .catch(() => null)
                    );
                }
            }

            if (fetchTasks.length > 0) {
                await Promise.all(fetchTasks);
                this.renderGroups(config, productData, locale, currencySymbol, customHeading, mainProductGid);
            }
        } catch (err) {
            console.error('Bundle picker error:', err);
            this.innerHTML = '<p class="pgb-error-message">Error loading bundles.</p>';
        }
    }

    renderSkeleton(config, heading) {
        const groupCount = config.groups ? config.groups.length : 1;
        let html = '';
        html += '<div class="pgb-groups-wrapper">';
        for (let g = 0; g < groupCount; g++) {
            const productCount = config.groups[g]?.products?.length || 2;
            html += '<div class="pgb-group"><div class="pgb-skeleton pgb-skeleton-title"></div><div class="pgb-group-items pgb-group-items--grid">';
            for (let p = 0; p < productCount; p++) {
                html += `<div class="pgb-product-card pgb-skeleton-card">
                    <div class="pgb-product-image-container">
                        <div class="pgb-skeleton pgb-skeleton-image"></div>
                    </div>
                    <div class="pgb-product-info">
                        <div class="pgb-skeleton pgb-skeleton-text" style="width:80%; margin: 0 auto 8px auto;"></div>
                        <div class="pgb-skeleton pgb-skeleton-text" style="width:50%; margin: 0 auto;"></div>
                    </div>
                </div>`;
            }
            html += '</div></div>';
        }
        html += '</div>';
        this.innerHTML = html;
    }

    renderGroups(config, productData, locale, currencySymbol, customHeading, mainProductGid) {
        let html = ``;
        html += `<p class="pgb-error-message"${this.errorMessage ? '' : ' hidden'}>${escapeHtml(this.errorMessage)}</p>`;

        // Try to get translations from a hidden element if provided by the theme, otherwise fallback
        const tOutOfStock = window.pgbTranslations?.outOfStock || 'Out of stock';

        html += `<div class="pgb-groups-wrapper">`;

        config.groups.forEach((group) => {
            const title = group.name || 'Bundle Group';
            html += `<div class="pgb-group" data-group-id="${group.id}">
      <h3 class="pgb-group-title">${escapeHtml(title)}</h3>`;

            const simpleCards = [];
            const fullWidthCards = [];

            group.products.forEach(prod => {
                const data = productData[prod.handle];
                const hasAjaxData = data && data.variants && data.variants.length > 0;

                // Determine which variants are allowed
                let allowedVariants = [];
                let defaultVariant = null;
                let isEntirelyOutOfStock = false;
                let hasMultipleVariants = false;

                if (hasAjaxData) {
                    allowedVariants = data.variants;
                    if (prod.variantIds && prod.variantIds.length > 0) {
                        allowedVariants = data.variants.filter(v => {
                            const variantGid = `gid://shopify/ProductVariant/${v.id}`;
                            return prod.variantIds.includes(variantGid) || prod.variantIds.includes(String(v.id));
                        });
                        if (allowedVariants.length === 0) allowedVariants = data.variants;
                    }
                    const availableVariants = allowedVariants.filter(v => v.available);
                    isEntirelyOutOfStock = availableVariants.length === 0;
                    defaultVariant = availableVariants.length > 0 ? availableVariants[0] : allowedVariants[0];
                    hasMultipleVariants = allowedVariants.length > 1;
                }

                // Resolve display values: prefer AJAX data, fall back to config-embedded data
                const productTitle = hasAjaxData ? data.title : (prod.title || prod.handle);
                let discount = toFiniteNumber(prod.discountValue, 0);

                // If there's a variant-specific discount for the default variant, use it initially
                if (defaultVariant && Array.isArray(prod.variantDiscounts)) {
                    const vd = prod.variantDiscounts.find(v => v.id === `gid://shopify/ProductVariant/${defaultVariant.id}` || v.id === String(defaultVariant.id));
                    if (vd) {
                        discount = toFiniteNumber(vd.discountValue, discount);
                    }
                }

                const origPrice = hasAjaxData
                    ? (toFiniteNumber(defaultVariant.price, 0) / 100).toFixed(2)
                    : String(prod._price || '0.00');
                const newPrice = Math.max(0, parseFloat(origPrice) - discount).toFixed(2);

                // Resolve image: prefer AJAX data, fall back to config snapshot
                let imageUrl = '';
                if (hasAjaxData) {
                    imageUrl = data.featured_image || '';
                    if (allowedVariants.length === 1 && allowedVariants[0].featured_image) {
                        imageUrl = allowedVariants[0].featured_image.src || imageUrl;
                    } else if (data.images && data.images.length > 0) {
                        imageUrl = data.images[0] || imageUrl;
                    }
                    if (imageUrl && !imageUrl.includes('width=') && !imageUrl.includes('_100x') && !imageUrl.includes('_200x')) {
                        // We use a slightly larger image for centered grid view, e.g. 200x.
                        imageUrl = imageUrl.replace(/(\.[a-z0-9]+)$/i, '_200x$1');
                    }
                } else {
                    imageUrl = prod._imageUrl || '';
                }

                // Resolve variant ID for the checkbox
                const variantId = defaultVariant ? defaultVariant.id : '';

                let cardClass = isEntirelyOutOfStock ? 'pgb-product-card pgb-product-card--unavailable' : 'pgb-product-card';
                if (hasMultipleVariants) cardClass += ' pgb-product-card--full-width';
                const disabledAttr = isEntirelyOutOfStock ? 'disabled' : '';

                let cardHtml = `
        <label class="${cardClass}">
          <input type="checkbox" class="pgb-checkbox" 
                 data-group-id="${group.id}" 
                 data-product-id="${prod.productId}" 
                 data-variant-id="${variantId}" 
                 data-parent-product-gid="${mainProductGid}"
                 data-discount="${discount}"
                 ${disabledAttr} />
           <div class="pgb-check-badge">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
           </div>
`;
                if (imageUrl) {
                    cardHtml += `<div class="pgb-product-image-container"><img src="${imageUrl}" alt="${escapeHtml(productTitle)}" class="pgb-product-image" loading="lazy"></div>`;
                }
                cardHtml += `
          <div class="pgb-product-info">
            <span class="pgb-product-title">${escapeHtml(productTitle)}</span>
            <span class="pgb-product-price">
              <span class="pgb-old-price">${currencySymbol}${origPrice}</span>
              <span class="pgb-new-price">${currencySymbol}${newPrice}</span>
            </span>`;

                if (isEntirelyOutOfStock) {
                    cardHtml += `<span class="pgb-out-of-stock-badge">${tOutOfStock}</span>`;
                }

                // Variant selector (only when AJAX data provides variant details)
                if (hasMultipleVariants && !isEntirelyOutOfStock) {
                    // Stringify variant discounts to pass to the client select
                    const variantDiscountsArr = Array.isArray(prod.variantDiscounts) ? prod.variantDiscounts : [];
                    const variantDiscountsJson = JSON.stringify(variantDiscountsArr).replace(/"/g, '&quot;');
                    cardHtml += `
            <select class="pgb-variant-selector" data-product-handle="${prod.handle}" data-base-discount="${prod.discountValue}" data-variant-discounts="${variantDiscountsJson}" data-currency="${currencySymbol}">`;
                    allowedVariants.forEach((v) => {
                        const vDisabled = !v.available ? ' disabled' : '';
                        const vSelected = v.id === defaultVariant.id ? ' selected' : '';
                        const vLabel = v.title + (v.available ? ` — ${currencySymbol}${(toFiniteNumber(v.price, 0) / 100).toFixed(2)}` : ` (${tOutOfStock})`);
                        cardHtml += `<option value="${v.id}" data-price="${v.price}"${vDisabled}${vSelected}>${escapeHtml(vLabel)}</option>`;
                    });
                    cardHtml += `</select>`;
                }

                cardHtml += `
          </div>
        </label>
      `;

                if (hasMultipleVariants) {
                    fullWidthCards.push(cardHtml);
                } else {
                    simpleCards.push(cardHtml);
                }
            });

            if (simpleCards.length > 0) {
                html += `<div class="pgb-group-items pgb-group-items--grid">${simpleCards.join('')}</div>`;
            }
            if (fullWidthCards.length > 0) {
                html += `<div class="pgb-group-items pgb-group-items--list">${fullWidthCards.join('')}</div>`;
            }
            html += `</div>`;
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

                let discount = parseFloat(sel.dataset.baseDiscount) || 0;
                let variantDiscounts = [];
                try {
                    variantDiscounts = JSON.parse(sel.dataset.variantDiscounts || '[]');
                } catch {
                    variantDiscounts = [];
                }
                const vd = variantDiscounts.find(v => v.id === `gid://shopify/ProductVariant/${sel.value}` || v.id === sel.value);
                if (vd) {
                    discount = toFiniteNumber(vd.discountValue, discount);
                }

                const currency = sel.dataset.currency || '$';

                // Update the variant ID on the checkbox
                checkbox.setAttribute('data-variant-id', sel.value);
                checkbox.setAttribute('data-discount', discount);

                // Update displayed prices
                const oldPriceEl = card.querySelector('.pgb-old-price');
                const newPriceEl = card.querySelector('.pgb-new-price');
                if (oldPriceEl) oldPriceEl.textContent = `${currency}${variantPrice.toFixed(2)}`;
                if (newPriceEl) newPriceEl.textContent = `${currency}${Math.max(0, variantPrice - discount).toFixed(2)}`;
            });
        });
    }

    interceptAddToCart() {
        if (this.submitHandler) return;

        const form =
            this.closest('form') ||
            document.querySelector('form[data-product-form]') ||
            document.querySelector('form[action*="/cart/add"]');
        if (!form) return;

        this.boundForm = form;
        this.submitHandler = async (e) => {
            const currentForm = e.target;
            if (currentForm !== this.boundForm) return;

            const checkedBoxes = this.querySelectorAll('.pgb-checkbox:checked');
            if (checkedBoxes.length === 0) return;

            const formData = new FormData(this.boundForm);
            const mainVariantIdRaw = formData.get('id');
            const mainQtyRaw = formData.get('quantity') || 1;
            const mainVariantId = Number.parseInt(String(mainVariantIdRaw || ''), 10);
            const mainQty = Number.parseInt(String(mainQtyRaw), 10) || 1;

            if (!Number.isFinite(mainVariantId) || mainVariantId <= 0) {
                console.error('PGB: missing or invalid main variant ID');
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.setError('');

            const submitBtn = this.boundForm.querySelector('[type="submit"], button');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
            }

            const items = [{ id: mainVariantId, quantity: mainQty }];
            checkedBoxes.forEach((box) => {
                const variantIdRaw = box.getAttribute('data-variant-id') || '';
                const variantId = Number.parseInt(variantIdRaw, 10);
                const groupId = box.getAttribute('data-group-id') || '';
                const parentProductGid = box.getAttribute('data-parent-product-gid') || '';
                if (!Number.isFinite(variantId) || variantId <= 0 || !groupId || !parentProductGid) return;

                items.push({
                    id: variantId,
                    quantity: 1,
                    parent_id: mainVariantId,
                    properties: {
                        _bundle_parent_product_id: parentProductGid,
                        _bundle_group_id: groupId,
                    },
                });
            });

            try {
                const rootUrl = buildRootUrl();
                const addUrl = rootUrl + (rootUrl.endsWith('/') ? 'cart/add.js' : '/cart/add.js');
                const res = await fetch(addUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items }),
                });

                if (!res.ok) {
                    throw new Error('add-to-cart request failed');
                }

                const cartData = await res.json();
                document.dispatchEvent(new CustomEvent('pgb:added-to-cart', { detail: { items: cartData.items } }));
                window.location.href = rootUrl + (rootUrl.endsWith('/') ? 'cart' : '/cart');
            } catch (err) {
                console.error('PGB: Failed to add products to cart', err);
                const errorMsg = window.pgbTranslations?.addToCartError || 'Error adding to cart. Please try again.';
                this.setError(errorMsg);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                }
            }
        };

        this.boundForm.addEventListener('submit', this.submitHandler, true);
    }
}

if (!customElements.get('pgb-bundle-picker')) {
    customElements.define('pgb-bundle-picker', PgbBundlePicker);
}
