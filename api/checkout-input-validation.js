function clean(v){ return v == null ? "" : String(v).trim(); }
function digits(v){ return clean(v).replace(/\D/g,""); }

export function validateCheckoutInput(customer, delivery, deliveryMethod){
  if (clean(customer.firstName).length < 2)
    throw new Error("Please enter a valid first name.");

  if (clean(customer.lastName).length < 2)
    throw new Error("Please enter a valid last name.");

  const email = clean(customer.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Please enter a valid email address.");

  const phone = digits(customer.phone);
  if (!(phone.length === 10 || (phone.length === 11 && phone.startsWith("1"))))
    throw new Error("Please enter a valid 10-digit U.S. phone number.");

  if (deliveryMethod === "shipping"){
    if (clean(delivery.address1).length < 5)
      throw new Error("Please enter a complete street address.");
    if (clean(delivery.city).length < 2)
      throw new Error("Please enter a valid city.");
    if (!/^[A-Za-z]{2}$/.test(clean(delivery.state)))
      throw new Error("Please enter a 2-letter state abbreviation, for example NY.");
    if (!/^\d{5}(?:-\d{4})?$/.test(clean(delivery.zip)))
      throw new Error("Please enter a valid ZIP code.");
  }
}