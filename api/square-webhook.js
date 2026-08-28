import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false
  }
};

const WEBHOOK_URL =
  "https://shokher-alna-website-v2.vercel.app/api/square-webhook";

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks).toString("utf8");
}

function validSquareSignature(rawBody, signature) {
  const key =
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (!key || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(WEBHOOK_URL + rawBody)
    .digest("base64");

  const expectedBuffer =
    Buffer.from(expected, "utf8");

  const signatureBuffer =
    Buffer.from(String(signature), "utf8");

  if (
    expectedBuffer.length !==
    signatureBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    signatureBuffer
  );
}

async function markOrderPaid({
  squareOrderId,
  squarePaymentId,
  paymentStatus
}) {
  const response = await fetch(
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
        action: "mark_paid",
        squareOrderId,
        squarePaymentId,
        paymentStatus,
        orderStatus: "PAID"
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
      "Order API returned an invalid response."
    );
  }

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error ||
      "Could not mark order as paid."
    );
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({
        error: "Method not allowed"
      });
  }

  try {
    if (
      !process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ||
      !process.env.ORDER_API_URL ||
      !process.env.ORDER_API_SECRET
    ) {
      console.error(
        "Webhook server configuration is incomplete."
      );

      return res
        .status(500)
        .json({
          error:
            "Server configuration is incomplete."
        });
    }

    const rawBody =
      await readRawBody(req);

    const signature =
      req.headers[
        "x-square-hmacsha256-signature"
      ];

    if (
      !validSquareSignature(
        rawBody,
        signature
      )
    ) {
      console.warn(
        "Rejected Square webhook: invalid signature."
      );

      return res
        .status(403)
        .json({
          error: "Invalid signature"
        });
    }

    const event =
      JSON.parse(rawBody);

    /*
     * Square can retry webhook events.
     * Our Apps Script mark_paid action is safe to
     * receive the same completed-payment event again:
     * it finds the same Square Order ID and updates
     * that order rather than creating another order.
     */

    if (
      event.type !== "payment.updated"
    ) {
      return res
        .status(200)
        .json({
          ok: true,
          ignored: true
        });
    }

    const payment =
      event.data?.object?.payment;

    if (!payment) {
      return res
        .status(200)
        .json({
          ok: true,
          ignored: true,
          reason:
            "No payment object"
        });
    }

    /*
     * Do not mark anything PAID until Square itself
     * reports COMPLETED.
     */
    if (
      payment.status !== "COMPLETED"
    ) {
      return res
        .status(200)
        .json({
          ok: true,
          ignored: true,
          paymentStatus:
            payment.status
        });
    }

    if (!payment.order_id) {
      console.warn(
        "Completed Square payment has no order_id:",
        payment.id
      );

      return res
        .status(200)
        .json({
          ok: true,
          ignored: true,
          reason:
            "Completed payment has no Square order ID"
        });
    }

    const result =
      await markOrderPaid({
        squareOrderId:
          payment.order_id,
        squarePaymentId:
          payment.id,
        paymentStatus:
          payment.status
      });

    console.log(
      "Order marked paid:",
      result.orderNumber,
      payment.id
    );

    return res
      .status(200)
      .json({
        ok: true,
        orderNumber:
          result.orderNumber
      });

  } catch (error) {
    console.error(
      "square-webhook error:",
      error
    );

    /*
     * Return non-2xx on a genuine processing failure
     * so Square can retry delivery.
     */
    return res
      .status(500)
      .json({
        error:
          error.message ||
          "Webhook processing failed"
      });
  }
}
