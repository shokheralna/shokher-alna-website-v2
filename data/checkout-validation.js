document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("checkoutForm");
  const button = document.getElementById("continuePayment");
  const status = document.getElementById("checkoutStatus");
  if (!form || !button) return;

  const $ = id => document.getElementById(id);
  const f = {
    firstName:$("firstName"), lastName:$("lastName"), email:$("email"),
    phone:$("phone"), address1:$("address1"), city:$("city"),
    state:$("state"), zip:$("zip")
  };
  const method = () =>
    form.querySelector('input[name="deliveryMethod"]:checked')?.value || "shipping";
  const digits = v => String(v || "").replace(/\D/g,"");
  const validPhone = v => {
    const d = digits(v);
    return d.length === 10 || (d.length === 11 && d.startsWith("1"));
  };
  const validState = v => /^[A-Za-z]{2}$/.test(String(v||"").trim());
  const validZip = v => /^\d{5}(?:-\d{4})?$/.test(String(v||"").trim());

  function clearErrors(){
    Object.values(f).forEach(x => x && x.setCustomValidity(""));
  }

  function validate(){
    clearErrors();

    if ((f.firstName?.value.trim().length || 0) < 2)
      f.firstName?.setCustomValidity("Please enter your first name.");
    if ((f.lastName?.value.trim().length || 0) < 2)
      f.lastName?.setCustomValidity("Please enter your last name.");

    if (f.email){
      f.email.value = f.email.value.trim();
      if (!f.email.validity.valid || !f.email.value)
        f.email.setCustomValidity("Please enter a valid email address.");
    }

    if (!validPhone(f.phone?.value))
      f.phone?.setCustomValidity("Please enter a valid 10-digit U.S. phone number.");

    if (method() === "shipping"){
      if ((f.address1?.value.trim().length || 0) < 5)
        f.address1?.setCustomValidity("Please enter a complete street address.");
      if ((f.city?.value.trim().length || 0) < 2)
        f.city?.setCustomValidity("Please enter a valid city.");
      if (!validState(f.state?.value))
        f.state?.setCustomValidity("Use the 2-letter state abbreviation, for example NY.");
      if (!validZip(f.zip?.value))
        f.zip?.setCustomValidity("Please enter a valid ZIP code.");
    }

    const ok = form.checkValidity();
    if (!ok){
      if (status) status.textContent =
        "Please correct the highlighted information before continuing.";
      form.reportValidity();
    }
    return ok;
  }

  button.addEventListener("click", e => {
    if (!validate()){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  Object.values(f).forEach(x => x?.addEventListener("input", () => {
    x.setCustomValidity("");
    if (status?.textContent.includes("highlighted")) status.textContent = "";
  }));

  f.phone?.addEventListener("blur", () => {
    const d0 = digits(f.phone.value);
    const d = d0.length === 11 && d0.startsWith("1") ? d0.slice(1) : d0;
    if (d.length === 10)
      f.phone.value = `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  });

  f.state?.addEventListener("blur", () => {
    f.state.value = f.state.value.trim().toUpperCase();
  });
});