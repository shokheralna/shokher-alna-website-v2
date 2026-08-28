/*
 * SHOKHER ALNA — SERVER PRODUCT CATALOG LOADER
 *
 * Single source of truth:
 *     data/products.js
 *
 * The customer browser can see products.js, but this code does NOT
 * trust data sent back from the browser. Vercel independently loads
 * the repository copy of products.js on the server and uses that copy
 * for price/status/order validation.
 */

import fs from "fs";
import path from "path";
import vm from "vm";

let cachedCatalog = null;

function loadProductsFile() {
  const productsPath = path.join(
    process.cwd(),
    "data",
    "products.js"
  );

  if (!fs.existsSync(productsPath)) {
    throw new Error(
      "Server product catalog file data/products.js was not found."
    );
  }

  return fs.readFileSync(
    productsPath,
    "utf8"
  );
}

function executeProductsFile(source) {
  /*
   * products.js was designed for the browser and stores its catalog on
   * window.SHOKHER_ALNA_PRODUCTS. We execute it in a tiny isolated
   * server-side sandbox that provides only the browser-style globals
   * it needs.
   */
  const sandboxWindow = {};

  const sandbox = {
    window: sandboxWindow,
    globalThis: sandboxWindow,
    console: {
      log() {},
      warn() {},
      error() {}
    }
  };

  vm.createContext(sandbox);

  const script = new vm.Script(
    source,
    {
      filename: "data/products.js"
    }
  );

  script.runInContext(
    sandbox,
    {
      timeout: 1000
    }
  );

  const products =
    sandboxWindow.SHOKHER_ALNA_PRODUCTS;

  if (!Array.isArray(products)) {
    throw new Error(
      "data/products.js did not expose window.SHOKHER_ALNA_PRODUCTS."
    );
  }

  return products;
}

function normalizeProduct(product) {
  if (
    !product ||
    typeof product !== "object"
  ) {
    return null;
  }

  const id =
    String(product.id || "")
      .trim()
      .toUpperCase();

  if (!id) {
    return null;
  }

  const price =
    Number(product.price);

  return {
    ...product,
    id,
    price
  };
}

export function getServerProductCatalog() {
  /*
   * One function invocation can reuse the parsed catalog.
   * A new Vercel deployment automatically picks up the latest
   * committed data/products.js.
   */
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const source =
    loadProductsFile();

  const rawProducts =
    executeProductsFile(source);

  const products =
    rawProducts
      .map(normalizeProduct)
      .filter(Boolean);

  const byId = new Map();

  for (const product of products) {
    if (byId.has(product.id)) {
      throw new Error(
        `Duplicate Product ID in data/products.js: ${product.id}`
      );
    }

    byId.set(
      product.id,
      product
    );
  }

  cachedCatalog = {
    products,
    byId
  };

  return cachedCatalog;
}

export function getServerProductById(id) {
  const normalizedId =
    String(id || "")
      .trim()
      .toUpperCase();

  if (!normalizedId) {
    return null;
  }

  return (
    getServerProductCatalog()
      .byId
      .get(normalizedId) ||
    null
  );
}

export function validateProductForCheckout(
  id
) {
  const product =
    getServerProductById(id);

  if (!product) {
    throw new Error(
      `Product ${String(id || "(unknown)")} is not available for online checkout.`
    );
  }

  /*
   * These rules now respond automatically to products.js.
   *
   * Example:
   * status: "active" + orderEnabled: true  -> can pay
   * status: "out-of-stock"                 -> blocked
   * status: "not-available"                -> blocked
   * status: "discontinued"                 -> blocked
   * orderEnabled: false                    -> blocked
   */
  if (
    String(product.status || "")
      .trim()
      .toLowerCase() !== "active"
  ) {
    throw new Error(
      `${product.name || product.id} is not currently available for online checkout.`
    );
  }

  if (
    product.orderEnabled !== true
  ) {
    throw new Error(
      `${product.name || product.id} is not currently available for online checkout.`
    );
  }

  if (
    !Number.isFinite(product.price) ||
    product.price <= 0
  ) {
    throw new Error(
      `${product.name || product.id} does not have a valid online price.`
    );
  }

  return product;
}
