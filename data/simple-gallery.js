window.SHOKHER_ALNA_GALLERY={maxGalleryImages:20,productBase(p){return `../${p.folder}`;},mainImage(p){return `${this.productBase(p)}/main.jpg`;},galleryImage(p,n){return `${this.productBase(p)}/gallery/${String(n).padStart(2,"0")}.jpg`;}};

window.shokherProbeImage=function(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(src);i.onerror=()=>r(null);i.src=src;});};

window.shokherLoadProductImages=async function(product){
  const g=window.SHOKHER_ALNA_GALLERY,images=[];
  const main=await window.shokherProbeImage(g.mainImage(product));
  if(main)images.push({src:main,label:"Main"});
  const checks=[];
  for(let i=1;i<=g.maxGalleryImages;i++)checks.push(window.shokherProbeImage(g.galleryImage(product,i)));
  const results=await Promise.all(checks);
  results.forEach((src,index)=>{if(src)images.push({src,label:String(index+1).padStart(2,"0")});});
  return images;
};

window.SHOKHER_ALNA_SELECTED_GALLERY_IMAGE=null;
window.shokherGetSelectedGalleryImage=()=>window.SHOKHER_ALNA_SELECTED_GALLERY_IMAGE;
window.shokherSetSelectedGalleryImage=function(image){
  window.SHOKHER_ALNA_SELECTED_GALLERY_IMAGE=image;
  document.dispatchEvent(new CustomEvent("shokher:gallery-change",{detail:image}));
};

window.shokherRenderSimpleGallery=async function(product){
  const el=document.getElementById("productGallery");if(!el)return;

  el.innerHTML=`<div class="gallery-main"><img id="galleryMainImage" src="" alt="${product.name}" hidden><div class="gallery-fallback" id="galleryFallback">Product photos will appear here after upload.</div><button class="gallery-zoom-button" id="galleryZoomButton" type="button" hidden>Enlarge</button></div><div class="gallery-thumbs" id="galleryThumbs"></div><div class="gallery-lightbox" id="galleryLightbox" aria-hidden="true"><button class="gallery-lightbox-close" id="galleryLightboxClose" type="button">&times;</button><button class="gallery-lightbox-prev" id="galleryLightboxPrev" type="button">&#10094;</button><img id="galleryLightboxImage" src="" alt=""><button class="gallery-lightbox-next" id="galleryLightboxNext" type="button">&#10095;</button></div>`;

  const images=await window.shokherLoadProductImages(product);
  const main=document.getElementById("galleryMainImage"),fallback=document.getElementById("galleryFallback"),thumbs=document.getElementById("galleryThumbs"),zoom=document.getElementById("galleryZoomButton"),lightbox=document.getElementById("galleryLightbox"),lightboxImg=document.getElementById("galleryLightboxImage"),close=document.getElementById("galleryLightboxClose"),prev=document.getElementById("galleryLightboxPrev"),next=document.getElementById("galleryLightboxNext");

  if(!images.length){fallback.hidden=false;return;}
  fallback.hidden=true;main.hidden=false;zoom.hidden=false;
  let currentIndex=0;

  function select(index){
    currentIndex=index;
    const image=images[index];
    main.src=image.src;
    thumbs.querySelectorAll(".gallery-thumb").forEach((b,i)=>b.classList.toggle("active",i===index));
    window.shokherSetSelectedGalleryImage({...image,index,absoluteUrl:new URL(image.src,window.location.href).href});
    if(lightbox.classList.contains("open")){lightboxImg.src=image.src;lightboxImg.alt=`${product.name} photo ${image.label}`;}
  }

  images.forEach((image,index)=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="gallery-thumb"+(index===0?" active":"");
    b.innerHTML=`<img src="${image.src}" alt="${product.name} photo ${image.label}"><span>${image.label}</span>`;
    b.addEventListener("click",()=>select(index));
    thumbs.appendChild(b);
  });

  function open(){lightboxImg.src=images[currentIndex].src;lightbox.classList.add("open");lightbox.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
  function shut(){lightbox.classList.remove("open");lightbox.setAttribute("aria-hidden","true");document.body.style.overflow="";}
  function showNext(){select((currentIndex+1)%images.length);}
  function showPrev(){select((currentIndex-1+images.length)%images.length);}

  main.addEventListener("click",open);
  zoom.addEventListener("click",open);
  close.addEventListener("click",shut);
  prev.addEventListener("click",e=>{e.stopPropagation();showPrev();});
  next.addEventListener("click",e=>{e.stopPropagation();showNext();});
  lightbox.addEventListener("click",e=>{if(e.target===lightbox)shut();});
  document.addEventListener("keydown",e=>{
    if(!lightbox.classList.contains("open"))return;
    if(e.key==="Escape")shut();
    if(e.key==="ArrowRight")showNext();
    if(e.key==="ArrowLeft")showPrev();
  });

  let touchStartX=0;
  lightbox.addEventListener("touchstart",e=>{touchStartX=e.changedTouches[0].screenX;},{passive:true});
  lightbox.addEventListener("touchend",e=>{
    const d=touchStartX-e.changedTouches[0].screenX;
    if(d>50)showNext();
    if(d<-50)showPrev();
  },{passive:true});

  select(0);
};
