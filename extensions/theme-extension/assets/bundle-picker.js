document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.pgb-bundle-picker');
    if (!container) return;

    const rawConfig = container.getAttribute('data-bundle-config');
    if (!rawConfig) return;

    try {
        const config = JSON.parse(rawConfig);
        const mainProductId = container.getAttribute('data-product-gid');
        const locale = container.getAttribute('data-locale') || 'en';
        const currencySymbol = container.getAttribute('data-currency-symbol') || '$';
        const customHeading = container.getAttribute('data-heading') || 'Bundle';

        // State to hold selected products
        const state = {
            selections: {} // { groupId: [ { productId, variantId, qty } ] }
        };

        // Render Logic
        container.innerHTML = `<h4>${customHeading}</h4>`;

        // Fetch product details via AJAX
        const productData = {};
        for (const group of config.groups) {
            for (const product of group.products) {
                if (product.handle && !productData[product.handle]) {
                    const res = await fetch(`/products/${product.handle}.js`);
                    if (res.ok) {
                        productData[product.handle] = await res.json();
                    }
                }
            }
        }

        renderGroups(container, config, productData, locale, currencySymbol, state, customHeading);

        // Intercept Add to Cart
        interceptAddToCart(mainProductId, state);

    } catch (err) {
        console.error("Bundle picker error:", err);
        container.innerHTML = '';
    }
});

function renderGroups(container, config, productData, locale, currencySymbol, state, customHeading) {
    let html = `<div class="pgb-groups-wrapper">`;

    config.groups.forEach((group, index) => {
        // Basic title
        const title = group.name || 'Bundle Group';
        html += `<div class="pgb-group" data-group-id="${group.id}">
      <h3 class="pgb-group-title">${title}</h3>
      <div class="pgb-group-items">`;

        group.products.forEach(prod => {
            const data = productData[prod.handle];
            if (!data) return; // Product not found or fetch failed

            const firstVariant = data.variants[0];
            const origPrice = (firstVariant.price / 100).toFixed(2);

            const newPrice = Math.max(0, origPrice - prod.discountValue).toFixed(2);

            html += `
        <label class="pgb-product-card">
          <input type="checkbox" class="pgb-checkbox" data-group-id="${group.id}" data-product-id="${prod.productId}" data-variant-id="${firstVariant.id}" />
          <div class="pgb-product-info">
            <span class="pgb-product-title">${data.title}</span>
            <span class="pgb-product-price">
              <span class="pgb-old-price">${currencySymbol}${origPrice}</span>
              <span class="pgb-new-price">${currencySymbol}${newPrice}</span>
            </span>
          </div>
        </label>
      `;
        });

        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;

    // Add listeners
    const checkboxes = container.querySelectorAll('.pgb-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            const gid = e.target.getAttribute('data-group-id');
            const pid = e.target.getAttribute('data-product-id');
            const vid = e.target.getAttribute('data-variant-id');

            if (!state.selections[gid]) state.selections[gid] = [];

            if (e.target.checked) {
                state.selections[gid].push({ productId: pid, variantId: vid, quantity: 1 });
            } else {
                state.selections[gid] = state.selections[gid].filter(item => item.productId !== pid);
            }
        });
    });
}

function interceptAddToCart(mainProductGid, state) {
    const forms = document.querySelectorAll('form[action*="/cart/add"]');
    if (forms.length === 0) {
        console.warn("PGB: No add-to-cart forms found on this page.");
    }

    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            const formData = new FormData(form);
            const mainVariantId = formData.get('id');
            const mainQty = formData.get('quantity') || 1;

            // Only intercept if bundle items are selected
            const hasSelections = Object.values(state.selections).some(group => group.length > 0);
            if (!hasSelections) return;

            e.preventDefault();
            console.log("PGB: Intercepting add to cart for bundle items...");

            if (!mainVariantId) {
                console.error("PGB: Could not find main product variant ID in the form.");
                form.submit(); // Fallback to normal behavior
                return;
            }

            const items = [{
                id: parseInt(mainVariantId, 10),
                quantity: parseInt(mainQty, 10)
            }];

            // Collect bundled items
            Object.keys(state.selections).forEach(groupId => {
                state.selections[groupId].forEach(item => {
                    items.push({
                        id: parseInt(item.variantId, 10),
                        quantity: parseInt(item.quantity, 10),
                        parent_id: parseInt(mainVariantId, 10),
                        properties: {
                            "_bundle_parent_product_id": mainProductGid,
                            "_bundle_group_id": groupId
                        }
                    });
                });
            });

            console.log("PGB: Submission payload:", { items });

            // Submit
            try {
                const res = await fetch(window.Shopify.routes.root + 'cart/add.js', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items })
                });

                if (res.ok) {
                    const cartData = await res.json();
                    console.log("PGB: Items added successfully", cartData);
                    document.dispatchEvent(new CustomEvent('pgb:added-to-cart', { detail: { items: cartData.items } }));
                    // Success! Redirecting to cart
                    window.location.href = '/cart';
                } else {
                    const error = await res.json();
                    console.error("PGB: Failed to add products to cart", error);
                    // Fallback: submit original form (at least add main product)
                    // But maybe user wants to know it failed.
                    alert("Erreur lors de l'ajout au panier. Veuillez réessayer.");
                }
            } catch (err) {
                console.error("PGB: Network error when adding bundle to cart", err);
            }
        });
    });
}
