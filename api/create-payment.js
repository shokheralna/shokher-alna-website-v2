import { validateProductForCheckout } from "./product-catalog.js";
import { validateCheckoutInput } from "./checkout-input-validation.js";

const ALLOWED_ORIGINS = new Set([
  "https://shokheralna.github.io",
  "https://shokher-alna-website-v2.vercel.app"
]);

const LOW_SHIPPING_LIMIT = 50;
const LOW_SHIPPING_FEE = 10;
const STANDARD_SHIPPING_FEE = 15;
const FREE_SHIPPING_THRESHOLD = 100;
const FREE_SHIPPING_COUPON = "VIPSHIP";
const MAX_QUANTITY_PER_LINE = 20;

function setCors(req, res) {
  const origin = req.headers.origin;

  if (
    origin &&
    ALLOWED_ORIGINS.has(origin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}

function clean(value) {
  return value == null
    ? ""
    : String(value).trim();
}

function normalizePhone(phone) {
  const raw = clean(phone);

  if (!raw) {
    return undefined;
  }

  const digits =
    raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (
    digits.length === 11 &&
    digits.startsWith("1")
  ) {
    return `+${digits}`;
  }

  return raw;
}

/*
 * SECURITY:
 *
 * Browser cart supplies only the requested Product ID,
 * quantity and selected-photo reference.
 *
 * Product name, price, status and order availability are
 * independently loaded by Vercel from data/products.js.
 */
function validateAndBuildItems(
  browserItems
) {
  if (
    !Array.isArray(browserItems) ||
    !browserItems.length
  ) {
    throw new Error(
      "Your cart is empty."
    );
  }

  return browserItems.map(
    browserItem => {
      const id =
        clean(browserItem.id)
          .toUpperCase();

      const product =
        validateProductForCheckout(
          id
        );

      const quantity =
        Number(
          browserItem.quantity
        );

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity < 1 ||
        quantity >
          MAX_QUANTITY_PER_LINE
      ) {
        throw new Error(
          `Invalid quantity for ${product.name}.`
        );
      }

      return {
        id:
          product.id,

        name:
          clean(product.name),

        category:
          clean(product.category),

        folder:
          clean(product.folder),

        /*
         * TRUSTED PRICE:
         * this comes from the repository's
         * data/products.js on the server.
         */
        price:
          Number(
            product.price
          ),

        quantity,

        /*
         * Photo/version metadata does not affect money,
         * so it may safely come from the cart.
         */
        selectedLabel:
          clean(
            browserItem.selectedLabel
          ),

        selectedImage:
          clean(
            browserItem.selectedImage
          ),

        selectedImageUrl:
          clean(
            browserItem.selectedImageUrl
          )
      };
    }
  );
}

function calculateTotals(
  trustedItems,
  deliveryMethod,
  promoCode
) {
  const subtotal =
    trustedItems.reduce(
      (sum, item) =>
        sum +
        item.price *
          item.quantity,
      0
    );

  const normalizedPromo =
    clean(promoCode)
      .toUpperCase();

  const hasFreeShippingCoupon =
    normalizedPromo ===
      FREE_SHIPPING_COUPON;

  let shipping = 0;

  if (
    deliveryMethod ===
      "shipping" &&
    !hasFreeShippingCoupon &&
    subtotal <
      FREE_SHIPPING_THRESHOLD
  ) {
    shipping =
      subtotal <
        LOW_SHIPPING_LIMIT
        ? LOW_SHIPPING_FEE
        : STANDARD_SHIPPING_FEE;
  }

  return {
    subtotal:
      Number(
        subtotal.toFixed(2)
      ),

    shipping:
      Number(
        shipping.toFixed(2)
      ),

    total:
      Number(
        (
          subtotal +
          shipping
        ).toFixed(2)
      )
  };
}

async function recordOrder(
  payload
) {
  const response =
    await fetch(
      process.env.ORDER_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          secret:
            process.env
              .ORDER_API_SECRET,

          action:
            "create_order",

          ...payload
        }),

        redirect: "follow"
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Google Sheets order API returned an invalid response."
    );
  }

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.error ||
      "Could not record order in Google Sheets."
    );
  }

  return data;
}

export default async function handler(
  req,
  res
) {
  setCors(req, res);

  if (
    req.method ===
    "OPTIONS"
  ) {
    return res
      .status(204)
      .end();
  }

  if (
    req.method !==
    "POST"
  ) {
    return res
      .status(405)
      .json({
        error:
          "Method not allowed"
      });
  }

  try {
    if (
      !process.env
        .SQUARE_ACCESS_TOKEN ||
      !process.env
        .SQUARE_LOCATION_ID ||
      !process.env
        .ORDER_API_URL ||
      !process.env
        .ORDER_API_SECRET
    ) {
      return res
        .status(500)
        .json({
          error:
            "Server configuration is incomplete."
        });
    }

    const body =
      req.body || {};

    const customer =
      body.customer || {};

    const delivery =
      body.delivery || {};

    const deliveryMethod =
      clean(
        delivery.method
      ).toLowerCase();

    if (
      ![
        "shipping",
        "pickup"
      ].includes(
        deliveryMethod
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid delivery method."
        });
    }

    try {
      validateCheckoutInput(
        customer,
        delivery,
        deliveryMethod
      );
    } catch (error) {
      return res
        .status(400)
        .json({
          error:
            error.message
        });
    }

    if (
      !clean(
        customer.firstName
      ) ||
      !clean(
        customer.lastName
      ) ||
      !clean(
        customer.email
      ) ||
      !clean(
        customer.phone
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Customer information is incomplete."
        });
    }

    if (
      deliveryMethod ===
        "shipping" &&
      (
        !clean(
          delivery.address1
        ) ||
        !clean(
          delivery.city
        ) ||
        !clean(
          delivery.state
        ) ||
        !clean(
          delivery.zip
        )
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Shipping address is incomplete."
        });
    }

    let trustedItems;

    try {
      trustedItems =
        validateAndBuildItems(
          body.items
        );
    } catch (error) {
      return res
        .status(400)
        .json({
          error:
            error.message
        });
    }

    const totals =
      calculateTotals(
        trustedItems,
        deliveryMethod,
        body.promoCode
      );

    const amountCents =
      Math.round(
        totals.total * 100
      );

    const squareResponse =
      await fetch(
        "https://connect.squareup.com/v2/online-checkout/payment-links",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,

            "Content-Type":
              "application/json",

            "Square-Version":
              "2026-08-19"
          },

          body: JSON.stringify({
            idempotency_key:
              crypto.randomUUID(),

            quick_pay: {
              name:
                "Shokher Alna Website Order",

              price_money: {
                amount:
                  amountCents,

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
                "https://shokheralna.github.io/shokher-alna-website-v2/pages/order-confirmation.html"
            },

            pre_populated_data: {
              buyer_email:
                clean(
                  customer.email
                ),

              buyer_phone_number:
                normalizePhone(
                  customer.phone
                ),

              buyer_address: {
                first_name:
                  clean(
                    customer.firstName
                  ),

                last_name:
                  clean(
                    customer.lastName
                  )
              }
            }
          })
        }
      );

    const squareData =
      await squareResponse.json();

    if (
      !squareResponse.ok
    ) {
      console.error(
        "Square error:",
        squareData
      );

      return res
        .status(
          squareResponse.status
        )
        .json({
          error:
            "Square checkout could not be created.",

          details:
            squareData
        });
    }

    const paymentUrl =
      squareData
        .payment_link
        ?.url;

    const squareOrderId =
      squareData
        .payment_link
        ?.order_id;

    const squarePaymentLinkId =
      squareData
        .payment_link
        ?.id;

    if (
      !paymentUrl ||
      !squareOrderId
    ) {
      return res
        .status(502)
        .json({
          error:
            "Square did not return a usable payment link."
        });
    }

    const orderRecord =
      await recordOrder({
        customer: {
          firstName:
            clean(
              customer.firstName
            ),

          lastName:
            clean(
              customer.lastName
            ),

          email:
            clean(
              customer.email
            ),

          phone:
            clean(
              customer.phone
            )
        },

        delivery: {
          method:
            deliveryMethod,

          address1:
            deliveryMethod ===
            "shipping"
              ? clean(
                  delivery.address1
                )
              : "",

          address2:
            deliveryMethod ===
            "shipping"
              ? clean(
                  delivery.address2
                )
              : "",

          city:
            deliveryMethod ===
            "shipping"
              ? clean(
                  delivery.city
                )
              : "",

          state:
            deliveryMethod ===
            "shipping"
              ? clean(
                  delivery.state
                )
              : "",

          zip:
            deliveryMethod ===
            "shipping"
              ? clean(
                  delivery.zip
                )
              : ""
        },

        /*
         * Google Sheets also receives the server-
         * validated name and price.
         */
        items:
          trustedItems,

        totals,

        squareOrderId,
        squarePaymentLinkId,

        paymentStatus:
          "PENDING",

        orderStatus:
          "PENDING PAYMENT"
      });

    return res
      .status(200)
      .json({
        ok: true,

        paymentUrl,

        orderNumber:
          orderRecord
            .orderNumber,

        squareOrderId,

        totals
      });

  } catch (error) {
    console.error(
      "create-payment error:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.message ||
          "Server error"
      });
  }
}
