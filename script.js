document.addEventListener("DOMContentLoaded",()=>{const body=document.body,header=document.getElementById("siteHeader"),toggle=document.getElementById("menuToggle"),menu=document.getElementById("mobileMenu"),mobileToggle=document.getElementById("mobileCollectionsToggle"),submenu=document.getElementById("mobileSubmenu"),dropdown=document.querySelector(".nav-dropdown"),dropdownTrigger=document.querySelector(".dropdown-trigger");const closeMenu=()=>{if(!toggle||!menu)return;toggle.classList.remove("active");toggle.setAttribute("aria-expanded","false");menu.classList.remove("open");menu.setAttribute("aria-hidden","true");body.classList.remove("menu-open")};if(toggle&&menu)toggle.addEventListener("click",()=>toggle.getAttribute("aria-expanded")==="true"?closeMenu():(toggle.classList.add("active"),toggle.setAttribute("aria-expanded","true"),menu.classList.add("open"),menu.setAttribute("aria-hidden","false"),body.classList.add("menu-open")));if(mobileToggle&&submenu)mobileToggle.addEventListener("click",()=>{const open=mobileToggle.getAttribute("aria-expanded")==="true";mobileToggle.setAttribute("aria-expanded",String(!open));submenu.classList.toggle("open",!open)});if(dropdown&&dropdownTrigger){dropdownTrigger.addEventListener("click",()=>{const open=dropdown.classList.toggle("open");dropdownTrigger.setAttribute("aria-expanded",String(open))});document.addEventListener("click",e=>{if(!dropdown.contains(e.target))dropdown.classList.remove("open")})}if(header)window.addEventListener("scroll",()=>header.classList.toggle("scrolled",scrollY>8))});

window.normalizeShokherStatus = function(status) {
  const value = String(status || "").trim().toLowerCase();

  if (["active","available"].includes(value)) return "active";
  if (["out of stock","out-of-stock","out_of_stock","sold out","sold-out"].includes(value)) return "out-of-stock";
  if (["not available","not-available","not_available","unavailable"].includes(value)) return "not-available";
  if (["discontinued","discarded","discard","hidden"].includes(value)) return "discontinued";

  return value || "discontinued";
};

window.getShokherStatusInfo = function(product) {
  const status = window.normalizeShokherStatus(product && product.status);

  const info = {
    status,
    visible: status !== "discontinued",
    orderAllowed: status === "active" && Boolean(product && product.orderEnabled),
    badge: "Available",
    message: "Available"
  };

  if (status === "out-of-stock") {
    info.badge = "Out of Stock";
    info.message = "Currently out of stock";
  } else if (status === "not-available") {
    info.badge = "Not Available";
    info.message = "Currently not available";
  } else if (status === "discontinued") {
    info.badge = "Discontinued";
    info.message = "Discontinued";
  }

  return info;
};

document.addEventListener("DOMContentLoaded",()=>{
  const products=window.SHOKHER_ALNA_PRODUCTS||[];
  const config=window.SHOKHER_ALNA_CONFIG||{};
  const visibleProducts=products.filter(p=>window.getShokherStatusInfo(p).visible);

  function priceText(p){return p.price?`$${p.price}`:"Contact for price";}
  function createProductCard(p){
    const info=window.getShokherStatusInfo(p);
    const badge=info.status!=="active"?info.badge:(p.bestSeller?"Best Seller":p.newArrival?"New Arrival":"Available");
    const card=document.createElement("article");
    card.className="product-card";
    card.innerHTML=`<div class="product-image product-image-file"><span class="product-badge ${info.status!=="active"?"product-badge-dark":""}">${badge}</span><img src="${p.folder}/main.jpg" alt="${p.name}" loading="lazy"><div class="image-fallback" hidden><span>Upload main.jpg</span><small>${p.name}</small></div></div><div class="product-card-body"><div class="product-card-topline"><span class="product-category">${p.category.replaceAll("-"," ")}</span><span class="product-price">${priceText(p)}</span></div><h3>${p.name}</h3><p>${p.description}</p>${info.orderAllowed?`<div class="product-card-actions"><button class="sa-card-add-cart" type="button">Add to Cart</button><a class="product-order-link" href="${window.buildWhatsAppOrderUrl(p)}" target="_blank" rel="noopener">Order via WhatsApp →</a></div>`:`<span class="product-order-disabled">${info.status==="active"?"Ordering not enabled":info.message}</span>`}</div>`;
    const img=card.querySelector("img"),fallback=card.querySelector(".image-fallback");
    img.addEventListener("error",()=>{img.hidden=true;fallback.hidden=false});
    const addButton=card.querySelector(".sa-card-add-cart");
    if(addButton)addButton.addEventListener("click",()=>window.shokherAddToCart(p,1));
    return card;
  }

  function render(gridId,emptyId,filter){
    const grid=document.getElementById(gridId),empty=document.getElementById(emptyId);
    if(!grid||!empty)return;
    const list=visibleProducts.filter(filter).slice(0,4);
    grid.replaceChildren();
    empty.hidden=list.length>0;
    list.forEach(p=>grid.appendChild(createProductCard(p)));
  }

  render("bestSellersGrid","bestSellersEmpty",p=>p.bestSeller);
  render("newArrivalsGrid","newArrivalsEmpty",p=>p.newArrival);

  document.querySelectorAll('a[href*="instagram.com"]').forEach(a=>{if(config.instagramUrl)a.href=config.instagramUrl});
  document.querySelectorAll('a[href*="facebook.com"]').forEach(a=>{if(config.facebookUrl)a.href=config.facebookUrl});
});

document.addEventListener("DOMContentLoaded",()=>{
  const products=(window.SHOKHER_ALNA_PRODUCTS||[]).filter(p=>window.normalizeShokherStatus(p.status)==="active");
  const targets=[["bags",".collection-image-bags"],["jewelry",".collection-image-jewelry"],["sarees",".collection-image-sarees"],["clothing",".collection-image-clothing"],["handpicked-finds",".collection-image-handpicked"]];

  const probe=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(src);i.onerror=()=>r(null);i.src=src});

  async function build([category,selector]){
    const container=document.querySelector(selector);
    if(!container)return;
    const matches=products.filter(p=>p.category===category);
    const images=(await Promise.all(matches.map(p=>probe(`${p.folder}/main.jpg`)))).filter(Boolean);
    if(!images.length)return;

    container.querySelectorAll(".collection-placeholder-label").forEach(x=>x.remove());
    container.classList.add("collection-slideshow");

    const a=document.createElement("img");a.className="collection-slide active";a.src=images[0];container.appendChild(a);
    if(images.length===1)return;

    const b=document.createElement("img");b.className="collection-slide";b.src=images[1];container.appendChild(b);
    let index=0,first=true;
    setInterval(()=>{const next=(index+1)%images.length,showing=first?a:b,hidden=first?b:a;hidden.src=images[next];hidden.classList.add("active");showing.classList.remove("active");index=next;first=!first},3800);
  }

  targets.forEach(build);
});

window.SHOKHER_ALNA_CART_KEY="shokherAlnaCartV2";

window.shokherReadCart=function(){
  try{
    const data=JSON.parse(localStorage.getItem(window.SHOKHER_ALNA_CART_KEY)||"[]");
    return Array.isArray(data)?data:[];
  }catch(e){return[];}
};

window.shokherWriteCart=function(cart){
  localStorage.setItem(window.SHOKHER_ALNA_CART_KEY,JSON.stringify(cart));
  window.shokherRenderCart();
};

window.shokherAbsoluteImageUrl=function(src){
  try{return new URL(src,window.location.href).href}catch(e){return src||""}
};

window.shokherCartItemKey=function(productId,imageSrc){
  return `${productId}::${imageSrc||"main"}`;
};

window.shokherAddToCart=function(product,quantity=1,selectedPhoto=null){
  if(!product||!product.id)return;
  const info=window.getShokherStatusInfo(product);
  if(!info.orderAllowed)return;

  const prefix=window.location.pathname.includes("/pages/")?"../":"";
  const fallback={src:`${prefix}${product.folder}/main.jpg`,label:"Main"};
  const chosen=selectedPhoto||(window.shokherGetSelectedGalleryImage?window.shokherGetSelectedGalleryImage():null)||fallback;

  const selectedImage=chosen.src||fallback.src;
  const selectedLabel=chosen.label||"Main";
  const key=window.shokherCartItemKey(product.id,selectedImage);

  const cart=window.shokherReadCart();
  const existing=cart.find(item=>item.key===key);

  if(existing)existing.quantity+=quantity;
  else cart.push({
    key,
    id:product.id,
    name:product.name,
    price:Number(product.price)||0,
    category:product.category||"",
    folder:product.folder||"",
    selectedImage,
    selectedImageUrl:chosen.absoluteUrl||window.shokherAbsoluteImageUrl(selectedImage),
    selectedLabel,
    quantity
  });

  window.shokherWriteCart(cart);
  window.shokherOpenCart();

  const notice=document.getElementById("saCartNotice");
  if(notice){
    notice.textContent=selectedLabel==="Main"?`${product.name} added to cart`:`${product.name} — Photo ${selectedLabel} added to cart`;
    notice.classList.add("show");
    clearTimeout(window.__shokherCartNoticeTimer);
    window.__shokherCartNoticeTimer=setTimeout(()=>notice.classList.remove("show"),2200);
  }
};

window.shokherChangeCartQuantity=function(key,change){
  const cart=window.shokherReadCart();
  const item=cart.find(entry=>entry.key===key);
  if(!item)return;
  item.quantity+=change;
  window.shokherWriteCart(cart.filter(entry=>entry.quantity>0));
};

window.shokherRemoveFromCart=function(key){
  window.shokherWriteCart(window.shokherReadCart().filter(entry=>entry.key!==key));
};

window.shokherOpenCart=function(){
  const drawer=document.getElementById("saCartDrawer"),overlay=document.getElementById("saCartOverlay");
  if(!drawer||!overlay)return;
  drawer.classList.add("open");overlay.classList.add("open");
  drawer.setAttribute("aria-hidden","false");
  document.body.classList.add("sa-cart-open");
};

window.shokherCloseCart=function(){
  const drawer=document.getElementById("saCartDrawer"),overlay=document.getElementById("saCartOverlay");
  if(!drawer||!overlay)return;
  drawer.classList.remove("open");overlay.classList.remove("open");
  drawer.setAttribute("aria-hidden","true");
  document.body.classList.remove("sa-cart-open");
};

window.shokherRenderCart=function(){
  const cart=window.shokherReadCart();
  const count=cart.reduce((s,i)=>s+i.quantity,0);
  const subtotal=cart.reduce((s,i)=>s+(Number(i.price)||0)*i.quantity,0);

  document.querySelectorAll(".sa-cart-count").forEach(el=>{
    el.textContent=count;
    el.hidden=count===0;
  });

  const items=document.getElementById("saCartItems"),empty=document.getElementById("saCartEmpty"),subtotalEl=document.getElementById("saCartSubtotal");
  if(!items||!empty||!subtotalEl)return;

  items.replaceChildren();
  empty.hidden=cart.length>0;

  cart.forEach(item=>{
    const row=document.createElement("div");
    row.className="sa-cart-item";
    const prefix=window.location.pathname.includes("/pages/")?"../":"";
    const fallback=item.folder?`${prefix}${item.folder}/main.jpg`:"";
    const imageSrc=item.selectedImage||fallback;
    const key=item.key||window.shokherCartItemKey(item.id,item.selectedImage||"");
    const selected=item.selectedLabel&&item.selectedLabel!=="Main"?`<small class="sa-cart-selected-photo">Selected photo: ${item.selectedLabel}</small>`:"";

    row.innerHTML=`<div class="sa-cart-item-image">${imageSrc?`<img src="${imageSrc}" alt="${item.name} selected product photo">`:""}</div>
    <div class="sa-cart-item-copy"><strong>${item.name}</strong>${selected}<span>$${Number(item.price).toFixed(2)}</span>
    <div class="sa-cart-qty"><button type="button" data-cart-minus="${encodeURIComponent(key)}">−</button><span>${item.quantity}</span><button type="button" data-cart-plus="${encodeURIComponent(key)}">+</button></div>
    <button class="sa-cart-remove" type="button" data-cart-remove="${encodeURIComponent(key)}">Remove</button></div>`;
    items.appendChild(row);
  });

  subtotalEl.textContent=`$${subtotal.toFixed(2)}`;
};

document.addEventListener("DOMContentLoaded",()=>{
  const headerTarget=document.querySelector(".header-actions")||document.querySelector(".nav-container");

  if(headerTarget&&!document.getElementById("saCartButton")){
    const button=document.createElement("button");
    button.id="saCartButton";
    button.className="sa-cart-button";
    button.type="button";
    button.innerHTML='Cart <span class="sa-cart-count" hidden>0</span>';
    headerTarget.appendChild(button);
  }

  if(!document.getElementById("saCartDrawer")){
    document.body.insertAdjacentHTML("beforeend",`
      <div class="sa-cart-overlay" id="saCartOverlay"></div>
      <aside class="sa-cart-drawer" id="saCartDrawer" aria-hidden="true">
        <div class="sa-cart-header"><div><p class="eyebrow">Your selection</p><h2>Shopping Cart</h2></div><button class="sa-cart-close" id="saCartClose" type="button">&times;</button></div>
        <div class="sa-cart-body"><p class="sa-cart-empty" id="saCartEmpty">Your cart is empty.</p><div id="saCartItems"></div></div>
        <div class="sa-cart-footer"><div class="sa-cart-subtotal-row"><span>Subtotal</span><strong id="saCartSubtotal">$0.00</strong></div><p>Checkout will be added in the next stage.</p></div>
      </aside>
      <div class="sa-cart-notice" id="saCartNotice"></div>`);
  }

  document.getElementById("saCartButton")?.addEventListener("click",window.shokherOpenCart);
  document.getElementById("saCartClose")?.addEventListener("click",window.shokherCloseCart);
  document.getElementById("saCartOverlay")?.addEventListener("click",window.shokherCloseCart);

  document.getElementById("saCartItems")?.addEventListener("click",event=>{
    const minus=event.target.closest("[data-cart-minus]");
    const plus=event.target.closest("[data-cart-plus]");
    const remove=event.target.closest("[data-cart-remove]");
    if(minus)window.shokherChangeCartQuantity(decodeURIComponent(minus.dataset.cartMinus),-1);
    if(plus)window.shokherChangeCartQuantity(decodeURIComponent(plus.dataset.cartPlus),1);
    if(remove)window.shokherRemoveFromCart(decodeURIComponent(remove.dataset.cartRemove));
  });

  document.addEventListener("keydown",event=>{if(event.key==="Escape")window.shokherCloseCart();});
  window.shokherRenderCart();
});
