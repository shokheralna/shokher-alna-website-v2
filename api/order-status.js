const ALLOWED_ORIGINS = new Set([
  "https://shokheralna.github.io",
  "https://shokher-alna-website-v2.vercel.app"
]);

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

  res.setHeader(
    "Vary",
    "Origin"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );
}

function clean(value) {
  return value == null
    ? ""
    : String(value).trim();
}

async function getOrderStatus({
  orderNumber,
  squareOrderId
}) {
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
            process.env.ORDER_API_SECRET,
          action:
            "get_order_status",
          orderNumber,
          squareOrderId
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
      "Order service returned an invalid response."
    );
  }

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.error ||
      "Could not verify this order."
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
    req.method === "OPTIONS"
  ) {
    return res
      .status(204)
      .end();
  }

  if (
    req.method !== "POST"
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
      !process.env.ORDER_API_URL ||
      !process.env.ORDER_API_SECRET
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

    const orderNumber =
      clean(body.orderNumber);

    const squareOrderId =
      clean(body.squareOrderId);

    if (
      !orderNumber ||
      !squareOrderId
    ) {
      return res
        .status(400)
        .json({
          error:
            "Order verification information is missing."
        });
    }

    const order =
      await getOrderStatus({
        orderNumber,
        squareOrderId
      });

    return res
      .status(200)
      .json({
        ok: true,
        order: {
          orderNumber:
            order.orderNumber || "",
          customerName:
            order.customerName || "",
          email:
            order.email || "",
          deliveryMethod:
            order.deliveryMethod || "",
          total:
            Number(order.total) || 0,
          paymentStatus:
            order.paymentStatus || "",
          orderStatus:
            order.orderStatus || "",
          paidAt:
            order.paidAt || ""
        }
      });

  } catch (error) {
    console.error(
      "order-status error:",
      error
    );

    return res
      .status(400)
      .json({
        error:
          error.message ||
          "Could not verify this order."
      });
  }
}
