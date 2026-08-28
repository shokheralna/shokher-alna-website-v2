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
  const SHIPPING_FEE = 15;
  const API_URL =
    "https://shokher-alna-website-v2.vercel.app/api/create-payment";

  const money = v => `$${Number(v || 0).toFixed(2)}`;

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
    return subtotal() >= THRESHOLD ? 0 : SHIPPING_FEE;
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

    totalEl.textContent = money(sub + ship);

    if (isShipping) {
      shippingNote.textContent =
        sub >= THRESHOLD
          ? "Your order qualifies for free shipping."
          : `${money(SHIPPING_FEE)} standard shipping. Orders of ${money(THRESHOLD)} or more receive free shipping.`;
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

  form.querySelectorAll('input[name="deliveryMethod"]').forEach(input =>
    input.addEventListener("change", updateSummary)
  );

  button.addEventListener("click", pay);

  updateSummary();
});
