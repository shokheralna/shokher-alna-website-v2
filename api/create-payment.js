export default async function handler(req, res) {
  // Allow only POST requests.
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      amount,
      description,
      buyerEmail,
      buyerPhone,
      redirectUrl
    } = req.body || {};

    const amountNumber = Number(amount);

    if (
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0
    ) {
      return res.status(400).json({
        error: "Invalid payment amount"
      });
    }

    const amountInCents =
      Math.round(amountNumber * 100);

    const idempotencyKey =
      crypto.randomUUID();

    const squareResponse =
      await fetch(
        "https://connect.squareupsandbox.com/v2/online-checkout/payment-links",
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,

            "Content-Type":
              "application/json",

            "Square-Version":
              "2026-08-19"
          },

          body: JSON.stringify({
            idempotency_key:
              idempotencyKey,

            quick_pay: {
              name:
                description ||
                "Shokher Alna Order",

              price_money: {
                amount:
                  amountInCents,

                currency:
                  "USD"
              },

              location_id:
                process.env
                  .SQUARE_LOCATION_ID
            },

            checkout_options: {
              allow_tipping:
                false,

              redirect_url:
                redirectUrl
            },

            pre_populated_data: {
              buyer_email:
                buyerEmail || undefined,

              buyer_phone_number:
                buyerPhone || undefined
            },

            payment_note:
              description ||
              "Shokher Alna website order"
          })
        }
      );

    const data =
      await squareResponse.json();

    if (!squareResponse.ok) {
      console.error(
        "Square error:",
        data
      );

      return res.status(
        squareResponse.status
      ).json({
        error:
          "Square could not create the payment page",

        details:
          data.errors || data
      });
    }

    return res.status(200).json({
      paymentUrl:
        data.payment_link?.url,

      orderId:
        data.payment_link?.order_id
    });

  } catch (error) {
    console.error(
      "Payment endpoint error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to create payment link"
    });
  }
}
