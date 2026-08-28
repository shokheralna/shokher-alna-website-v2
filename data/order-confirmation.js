document.addEventListener(
  "DOMContentLoaded",
  () => {
    const API_URL =
      "https://shokher-alna-website-v2.vercel.app/api/order-status";

    const CHECKOUT_KEY =
      "shokherAlnaCheckoutV1";

    const CART_KEY =
      window.SHOKHER_ALNA_CART_KEY ||
      "shokherAlnaCartV2";

    const stateEl =
      document.getElementById(
        "confirmationState"
      );

    const titleEl =
      document.getElementById(
        "confirmationTitle"
      );

    const messageEl =
      document.getElementById(
        "confirmationMessage"
      );

    const detailsEl =
      document.getElementById(
        "confirmationDetails"
      );

    const orderNumberEl =
      document.getElementById(
        "confirmOrderNumber"
      );

    const totalEl =
      document.getElementById(
        "confirmTotal"
      );

    const deliveryEl =
      document.getElementById(
        "confirmDelivery"
      );

    const emailEl =
      document.getElementById(
        "confirmEmail"
      );

    const retryButton =
      document.getElementById(
        "retryVerification"
      );

    const money = value =>
      `$${Number(value || 0).toFixed(2)}`;

    function readPendingOrder() {
      try {
        return JSON.parse(
          localStorage.getItem(
            CHECKOUT_KEY
          ) || "null"
        );
      } catch {
        return null;
      }
    }

    function clearPaidCart() {
      localStorage.removeItem(
        CART_KEY
      );

      /*
       * Keep only a small receipt reference.
       * Full customer/address/cart data is no
       * longer needed after payment confirms.
       */
      const pending =
        readPendingOrder();

      if (pending) {
        localStorage.setItem(
          CHECKOUT_KEY,
          JSON.stringify({
            orderNumber:
              pending.orderNumber || "",
            squareOrderId:
              pending.squareOrderId || "",
            totals:
              pending.totals || {},
            paymentConfirmed: true,
            confirmedAt:
              new Date().toISOString()
          })
        );
      }

      window.dispatchEvent(
        new Event("storage")
      );

      if (
        typeof window.shokherUpdateCartUI ===
        "function"
      ) {
        window.shokherUpdateCartUI();
      }
    }

    function showChecking() {
      stateEl.className =
        "confirmation-icon checking";

      stateEl.textContent = "…";

      titleEl.textContent =
        "Confirming your payment";

      messageEl.textContent =
        "Square has returned you to Shokher Alna. We’re securely checking your payment status.";

      detailsEl.hidden = true;
      retryButton.hidden = true;
    }

    function showPaid(order) {
      stateEl.className =
        "confirmation-icon success";

      stateEl.textContent = "✓";

      titleEl.textContent =
        "Thank you for your order!";

      messageEl.textContent =
        order.deliveryMethod === "pickup"
          ? "Your payment is confirmed. We’ll contact you with your Jackson Heights pickup details."
          : "Your payment is confirmed. We’ll contact you with shipping updates.";

      orderNumberEl.textContent =
        order.orderNumber;

      totalEl.textContent =
        money(order.total);

      deliveryEl.textContent =
        order.deliveryMethod === "pickup"
          ? "Local pickup"
          : "Shipping";

      emailEl.textContent =
        order.email || "—";

      detailsEl.hidden = false;
      retryButton.hidden = true;

      clearPaidCart();
    }

    function showPending(order) {
      stateEl.className =
        "confirmation-icon checking";

      stateEl.textContent = "…";

      titleEl.textContent =
        "Payment is still being confirmed";

      messageEl.textContent =
        "Your order was found, but Square has not finished confirming the payment yet. This normally takes only a few seconds.";

      if (order?.orderNumber) {
        orderNumberEl.textContent =
          order.orderNumber;

        totalEl.textContent =
          money(order.total);

        deliveryEl.textContent =
          order.deliveryMethod === "pickup"
            ? "Local pickup"
            : "Shipping";

        emailEl.textContent =
          order.email || "—";

        detailsEl.hidden = false;
      }

      retryButton.hidden = false;
    }

    function showUnable(message) {
      stateEl.className =
        "confirmation-icon warning";

      stateEl.textContent = "!";

      titleEl.textContent =
        "We couldn’t verify the payment yet";

      messageEl.textContent =
        message ||
        "Your cart has not been cleared. Please retry the verification.";

      retryButton.hidden = false;
    }

    async function requestStatus(
      pending
    ) {
      const response =
        await fetch(
          API_URL,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              orderNumber:
                pending.orderNumber,
              squareOrderId:
                pending.squareOrderId
            })
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok ||
        !result.order
      ) {
        throw new Error(
          result.error ||
          "Could not verify this order."
        );
      }

      return result.order;
    }

    async function verifyPayment() {
      const pending =
        readPendingOrder();

      if (
        !pending?.orderNumber ||
        !pending?.squareOrderId
      ) {
        showUnable(
          "We don’t have enough information in this browser to verify the order. If you completed a payment, please contact Shokher Alna with your payment details."
        );
        return;
      }

      showChecking();

      /*
       * The webhook usually arrives before or
       * within seconds of the redirect. Poll for
       * up to about 30 seconds so the customer
       * does not have to manually refresh.
       */
      const maxAttempts = 15;

      for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
      ) {
        try {
          const order =
            await requestStatus(
              pending
            );

          const paid =
            String(
              order.paymentStatus
            ).toUpperCase() ===
              "COMPLETED" &&
            String(
              order.orderStatus
            ).toUpperCase() ===
              "PAID";

          if (paid) {
            showPaid(order);
            return;
          }

          if (
            attempt ===
            maxAttempts
          ) {
            showPending(order);
            return;
          }

        } catch (error) {
          if (
            attempt ===
            maxAttempts
          ) {
            showUnable(
              error.message
            );
            return;
          }
        }

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              2000
            )
        );
      }
    }

    retryButton.addEventListener(
      "click",
      verifyPayment
    );

    verifyPayment();
  }
);
