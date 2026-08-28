/**
 * Product Carousel block — promo banner + a horizontal rail of product cards.
 *
 * Authored structure: each row is Label + Value.
 *   | Background Image | (link to an image asset, or empty) |
 *   | Thumbnail        | (link to an image asset, or empty) |
 *   | Heading          | text                               |
 *   | Description      | text                               |
 *   | CTA              | <a href>Shop Event</a>             |
 *   | Products         | <ul><li><a href="/fragments/products/{sku}">…</a></li>…</ul> |
 *
 * Layout: within the banner, the thumbnail sits top-left, the text (heading /
 * description / CTA) bottom-left, and the product carousel fills the space to the
 * right. Each product card shows its first image, bold brand, title, rating (if
 * present), price, savings (if present) and original price (if present) on a white
 * card — data pulled from /product-index.json by the product's fragment path.
 *
 * The banner background and thumbnail are standard authored images (<picture>/<img>);
 * product card images come from /product-index.json (a src URL).
 */

import { resolveIndexImage } from '../../scripts/scripts.js';

const norm = (s) => s.trim().toLowerCase();

const SLOTS = new Map([
  ['background image', 'bg'],
  ['thumbnail', 'thumb'],
  ['heading', 'heading'],
  ['description', 'description'],
  ['cta', 'cta'],
  ['products', 'products'],
]);

// Return the authored <img> from a cell, if present.
function imageFromCell(cell, alt) {
  if (!cell) return null;
  const existing = cell.querySelector('img');
  if (existing && existing.getAttribute('src')) {
    existing.loading = 'lazy';
    if (alt && !existing.alt) existing.alt = alt;
    return existing;
  }
  return null;
}

// Build an <img> from an index image URL (product card thumbnail).
function imageFromUrl(url, alt) {
  if (!url) return null;
  const img = document.createElement('img');
  img.src = url;
  img.loading = 'lazy';
  img.alt = alt || '';
  return img;
}

let indexPromise;
async function loadProductIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/product-index.json')
      .then((resp) => (resp.ok ? resp.json() : { data: [] }))
      .then((json) => json.data || [])
      .catch(() => []);
  }
  return indexPromise;
}

function buildRating(value) {
  const num = parseFloat(value);
  if (!value || Number.isNaN(num)) return null;
  const wrap = document.createElement('span');
  wrap.className = 'product-carousel-card-rating';
  const full = Math.round(num);
  const stars = document.createElement('span');
  stars.className = 'product-carousel-stars';
  stars.setAttribute('aria-hidden', 'true');
  stars.textContent = '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full);
  const label = document.createElement('span');
  label.className = 'product-carousel-rating-count';
  wrap.append(stars);
  wrap.setAttribute('aria-label', `Rating ${num} out of 5`);
  return { wrap, label };
}

// price + savings + original price rows
function appendPricing(body, entry) {
  if (!entry) return;
  if (entry.price) {
    const price = document.createElement('span');
    price.className = 'product-carousel-card-price';
    price.textContent = entry.price.replace(/ CAD$/, '');
    const per = document.createElement('span');
    per.className = 'product-carousel-card-per';
    per.textContent = ' / each';
    price.append(per);
    body.append(price);
  }
  if (entry.savings) {
    const savings = document.createElement('span');
    savings.className = 'product-carousel-card-savings';
    savings.textContent = entry.savings;
    body.append(savings);
  }
  if (entry.originalPrice) {
    const was = document.createElement('span');
    was.className = 'product-carousel-card-was';
    was.textContent = `Was ${entry.originalPrice}`;
    body.append(was);
  }
}

function buildCard(entry, link) {
  const path = new URL(link.href, window.location).pathname;
  const card = document.createElement('a');
  card.className = 'product-carousel-card';
  card.href = path;

  const imageUrl = resolveIndexImage(entry && entry.imageSrc);
  const media = document.createElement('div');
  media.className = 'product-carousel-card-image';
  const img = imageFromUrl(imageUrl, entry && entry.productName);
  if (img) media.append(img);
  card.append(media);

  const body = document.createElement('div');
  body.className = 'product-carousel-card-body';

  if (entry && entry.brand) {
    const brand = document.createElement('strong');
    brand.className = 'product-carousel-card-brand';
    brand.textContent = entry.brand;
    body.append(brand);
  }

  const title = document.createElement('span');
  title.className = 'product-carousel-card-title';
  title.textContent = (entry && entry.productName) || link.textContent.trim();
  body.append(title);

  if (entry && entry.reviewCount) {
    const rating = buildRating(entry.rating);
    if (rating) {
      rating.label.textContent = `(${entry.reviewCount})`;
      rating.wrap.append(rating.label);
      body.append(rating.wrap);
    }
  }

  appendPricing(body, entry);

  card.append(body);
  return card;
}


export default async function decorate(block) {
  const slots = new Map();
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const slot = SLOTS.get(norm(cells[0].textContent));
    if (slot) slots.set(slot, cells[1]);
  });

  // --- banner ---
  const banner = document.createElement('div');
  banner.className = 'product-carousel-banner';

  const bgImg = imageFromCell(slots.get('bg'), '');
  if (bgImg) {
    const bg = document.createElement('div');
    bg.className = 'product-carousel-bg';
    bg.append(bgImg);
    banner.append(bg);
  }

  const promo = document.createElement('div');
  promo.className = 'product-carousel-promo';

  const thumbImg = imageFromCell(slots.get('thumb'), '');
  if (thumbImg) {
    const thumb = document.createElement('div');
    thumb.className = 'product-carousel-thumb';
    thumb.append(thumbImg);
    promo.append(thumb);
  }

  const promoText = document.createElement('div');
  promoText.className = 'product-carousel-promo-text';
  const heading = slots.get('heading');
  if (heading && heading.textContent.trim()) {
    const h = document.createElement('h2');
    h.textContent = heading.textContent.trim();
    promoText.append(h);
  }
  const desc = slots.get('description');
  if (desc && desc.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = desc.textContent.trim();
    promoText.append(p);
  }
  const cta = slots.get('cta');
  const ctaLink = cta && cta.querySelector('a');
  if (ctaLink) {
    ctaLink.classList.add('button');
    promoText.append(ctaLink);
  }
  promo.append(promoText);
  banner.append(promo);

  // --- product rail ---
  const rail = document.createElement('ul');
  rail.className = 'product-carousel-rail';
  const productLinks = slots.get('products')
    ? [...slots.get('products').querySelectorAll('a[href]')]
    : [];
  const index = await loadProductIndex();
  const byPath = new Map(index.map((row) => [row.path, row]));
  productLinks.forEach((link) => {
    const entry = byPath.get(new URL(link.href, window.location).pathname);
    const li = document.createElement('li');
    li.append(buildCard(entry, link));
    rail.append(li);
  });
  banner.append(rail);

  block.textContent = '';
  block.append(banner);
}
