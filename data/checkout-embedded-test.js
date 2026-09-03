document.addEventListener("DOMContentLoaded", () => {
  const config = window.SHOKHER_ALNA_CONFIG || {};
  const cart = window.shokherReadCart ? window.shokherReadCart() : [];

  const form = document.getElementById("checkoutForm");
  const empty = document.getElementById("checkoutEmpty");
  const content = document.getElementById("checkoutContent");
  const itemsEl = document.getElementById("checkoutItems");
  const subtotalEl = document.getElementById("checkoutSubtotal");
  const shippingEl = document.getElementById("checkoutShipping");
  const totalEl = document.getElementById("checkoutTotal");
  const shippingSection = document.getElementById("shippingSection");
  const shippingNote = document.getElementById("shippingNote");
  const pickupNote = document.getElementById("pickupNote");
  const pickupLocation = document.getElementById("pickupLocation");
  const button = document.getElementById("continuePayment");
  const status = document.getElementById("checkoutStatus");

  const THRESHOLD = Number(config.freeShippingThreshold) || 100;
  const LOW_SHIPPING_LIMIT = 50;
  const LOW_SHIPPING_FEE = 10;
  const STANDARD_SHIPPING_FEE = 15;
  const FREE_SHIPPING_COUPON = "VIPSHIP";
  const PROCESSING_FEE_RATE = 0.029;
  const PROCESSING_FEE_FIXED = 0.30;
  const API_URL =
    "https://shokher-alna-website-v2.vercel.app/api/create-payment-embedded-test";

  const money = v => `$${Number(v || 0).toFixed(2)}`;

  let promoApplied = false;

  // Add a processing-fee line to the existing checkout summary.
  // This keeps checkout.html unchanged.
  let processingFeeEl = document.getElementById("checkoutProcessingFee");

  if (!processingFeeEl && totalEl) {
    const totalRow = totalEl.parentElement;
    if (totalRow && totalRow.parentNode) {
      const feeRow = document.createElement("div");
      feeRow.className = totalRow.className;
      feeRow.innerHTML = `
        <span>Processing Fee</span>
        <span id="checkoutProcessingFee">$0.00</span>
      `;
      totalRow.parentNode.insertBefore(feeRow, totalRow);
      processingFeeEl = feeRow.querySelector("#checkoutProcessingFee");
    }
  }

  // Full-page redirect overlay shown while the secure Square checkout is prepared.
  const redirectOverlay = document.createElement("div");
  redirectOverlay.id = "paymentRedirectOverlay";
  redirectOverlay.hidden = true;
  redirectOverlay.innerHTML = `
    <div class="payment-redirect-card" role="status" aria-live="polite">
      <div class="payment-redirect-spinner" aria-hidden="true"></div>
      <strong>Preparing your secure payment</strong>
      <span>Please wait while we redirect you to Square...</span>
    </div>
  `;

  const overlayStyle = document.createElement("style");
  overlayStyle.textContent = `
    #paymentRedirectOverlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(255, 252, 247, 0.92);
      backdrop-filter: blur(3px);
    }

    #paymentRedirectOverlay[hidden] {
      display: none;
    }

    .payment-redirect-card {
      width: min(92vw, 390px);
      padding: 30px 24px;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 14px 45px rgba(0, 0, 0, 0.16);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .payment-redirect-card strong {
      font-size: 1.12rem;
    }

    .payment-redirect-card span {
      font-size: 0.95rem;
      line-height: 1.45;
      opacity: 0.75;
    }

    .payment-redirect-spinner {
      width: 38px;
      height: 38px;
      margin-bottom: 5px;
      border: 4px solid rgba(0, 0, 0, 0.12);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: shokherPaymentSpin 0.8s linear infinite;
    }

    @keyframes shokherPaymentSpin {
      to { transform: rotate(360deg); }
    }
  `;

  document.head.appendChild(overlayStyle);
  document.body.appendChild(redirectOverlay);

  function showRedirectOverlay() {
    redirectOverlay.hidden = false;
  }

  function hideRedirectOverlay() {
    redirectOverlay.hidden = true;
  }

  const promoWrap = document.createElement("div");
  promoWrap.style.marginTop = "14px";
  promoWrap.innerHTML = `
    <label for="promoCode" style="display:block;font-weight:600;margin-bottom:6px;">
      Promo code
    </label>
    <div style="display:flex;gap:8px;">
      <input
        id="promoCode"
        type="text"
        autocomplete="off"
        placeholder="Enter promo code"
        style="flex:1;min-width:0;"
      >
      <button
        id="applyPromo"
        type="button"
        style="width:auto;padding:10px 16px;"
      >
        Apply
      </button>
    </div>
    <div id="promoMessage" style="margin-top:6px;font-size:0.9rem;"></div>
  `;

  if (shippingNote && shippingNote.parentNode) {
    shippingNote.parentNode.insertBefore(
      promoWrap,
      shippingNote.nextSibling
    );
  }

  const promoInput = document.getElementById("promoCode");
  const applyPromoButton = document.getElementById("applyPromo");
  const promoMessage = document.getElementById("promoMessage");

  pickupLocation.textContent = config.pickupLocation || "Jackson Heights";

  function subtotal() {
    return cart.reduce(
      (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
      0
    );
  }

  function method() {
    return form.querySelector('input[name="deliveryMethod"]:checked')?.value || "shipping";
  }

  function shippingAmount() {
    if (method() === "pickup") return 0;

    const sub = subtotal();

    if (promoApplied) return 0;
    if (sub >= THRESHOLD) return 0;
    if (sub < LOW_SHIPPING_LIMIT) return LOW_SHIPPING_FEE;

    return STANDARD_SHIPPING_FEE;
  }

  function processingFeeAmount() {
    const base = subtotal() + shippingAmount();
    return Number(
      (base * PROCESSING_FEE_RATE + PROCESSING_FEE_FIXED).toFixed(2)
    );
  }

  function imageUrl(item) {
    if (item.selectedImageUrl) return item.selectedImageUrl;

    let src =
      item.selectedImage ||
      (item.folder ? `${item.folder}/main.jpg` : "");

    src = String(src)
      .replace(/^(\.\.\/)+/, "")
      .replace(/^\.\/+/, "");

    try {
      return new URL(`../${src}`, window.location.href).href;
    } catch {
      return src;
    }
  }

  function renderItems() {
    itemsEl.replaceChildren();

    cart.forEach(item => {
      const row = document.createElement("div");
      row.className = "checkout-item";

      const selected =
        item.selectedLabel && item.selectedLabel !== "Main"
          ? `Selected photo: ${item.selectedLabel}`
          : "";

      row.innerHTML = `
        <div class="checkout-item-image">
          <img src="${imageUrl(item)}" alt="${item.name}">
        </div>
        <div class="checkout-item-copy">
          <strong>${item.name}</strong>
          ${selected ? `<small>${selected}</small>` : ""}
          <small>Qty: ${item.quantity}</small>
        </div>
        <div class="checkout-item-price">
          ${money((Number(item.price) || 0) * (Number(item.quantity) || 0))}
        </div>`;

      itemsEl.appendChild(row);
    });
  }

  function updateSummary() {
    const isShipping = method() === "shipping";

    shippingSection.hidden = !isShipping;
    pickupNote.hidden = isShipping;

    ["address1", "city", "state", "zip"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.required = isShipping;
    });

    const sub = subtotal();
    const ship = shippingAmount();

    subtotalEl.textContent = money(sub);

    if (method() === "pickup") {
      shippingEl.textContent = "Free pickup";
    } else if (ship === 0) {
      shippingEl.textContent = "FREE";
    } else {
      shippingEl.textContent = money(ship);
    }

    const processingFee = processingFeeAmount();

    if (processingFeeEl) {
      processingFeeEl.textContent = money(processingFee);
    }

    totalEl.textContent = money(sub + ship + processingFee);

    if (isShipping) {
      if (promoApplied) {
        shippingNote.textContent =
          "VIPSHIP applied — your shipping is FREE.";
      } else if (sub >= THRESHOLD) {
        shippingNote.textContent =
          "Your order qualifies for free shipping.";
      } else if (sub < LOW_SHIPPING_LIMIT) {
        shippingNote.textContent =
          `${money(LOW_SHIPPING_FEE)} shipping for orders under ${money(LOW_SHIPPING_LIMIT)}.`;
      } else {
        shippingNote.textContent =
          `${money(STANDARD_SHIPPING_FEE)} shipping. Orders of ${money(THRESHOLD)} or more receive free shipping.`;
      }
    }
  }

  function buildPayload() {
    const data = Object.fromEntries(new FormData(form).entries());

    return {
      customer: {
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        email: data.email || "",
        phone: data.phone || ""
      },
      delivery: {
        method: method(),
        address1: data.address1 || "",
        address2: data.address2 || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || ""
      },
      promoCode:
        promoApplied
          ? FREE_SHIPPING_COUPON
          : "",
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        selectedLabel: item.selectedLabel || "",
        selectedImage: item.selectedImage || "",
        selectedImageUrl: imageUrl(item)
      }))
    };
  }

  async function pay() {
    if (!form.reportValidity()) return;

    button.disabled = true;
    status.textContent = "Preparing your secure payment...";
    showRedirectOverlay();

    try {
      const payload = buildPayload();

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.paymentUrl) {
        throw new Error(result.error || "Could not start payment.");
      }

      localStorage.setItem(
        "shokherAlnaCheckoutV1",
        JSON.stringify({
          ...payload,
          orderNumber: result.orderNumber || "",
          squareOrderId: result.squareOrderId || "",
          totals: result.totals || {},
          savedAt: new Date().toISOString()
        })
      );

      status.textContent =
        `Order ${result.orderNumber || ""} created. Redirecting to Square...`;

      window.location.href = result.paymentUrl;
    } catch (error) {
      console.error(error);
      status.textContent =
        error.message || "We could not start payment. Please try again.";
      button.disabled = false;
      hideRedirectOverlay();
    }
  }

  if (!cart.length) {
    empty.hidden = false;
    content.hidden = true;
    button.disabled = true;
    return;
  }

  empty.hidden = true;
  content.hidden = false;

  renderItems();

  if (applyPromoButton && promoInput) {
    applyPromoButton.addEventListener("click", () => {
      const entered = String(promoInput.value || "")
        .trim()
        .toUpperCase();

      if (entered === FREE_SHIPPING_COUPON) {
        promoApplied = true;
        promoInput.value = FREE_SHIPPING_COUPON;
        promoMessage.textContent =
          "VIPSHIP applied — free shipping unlocked.";
      } else {
        promoApplied = false;
        promoMessage.textContent =
          entered
            ? "That promo code is not valid."
            : "Enter a promo code first.";
      }

      updateSummary();
    });

    promoInput.addEventListener("input", () => {
      if (promoApplied) {
        promoApplied = false;
        promoMessage.textContent = "";
        updateSummary();
      }
    });
  }

  form.querySelectorAll('input[name="deliveryMethod"]').forEach(input =>
    input.addEventListener("change", updateSummary)
  );

  button.addEventListener("click", pay);

  updateSummary();
});
