import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Product Carousel block — promo tile + a rail of product cards.
 *
 * Authored structure: each row is Label + Value.
 *   | Background Image | (image; may be empty placeholder)       |
 *   | Thumbnail        | (image; top-left badge; may be empty)   |
 *   | Heading          | text                                    |
 *   | Description      | text                                    |
 *   | CTA              | <a href>Shop Event</a>                  |
 *   | Products         | <ul><li><a href="/fragments/products/…">…</a></li>…</ul> |
 *
 * The Products cell holds links to /fragments/products/{sku} pages. The block fetches
 * /product-index.json once and renders a card (thumbnail + name + price) per referenced
 * product, linking to its fragment page. Falls back to the authored link text if a
 * product is not yet in the index.
 *
 * @param {Element} block
 */

const norm = (s) => s.trim().toLowerCase();

const SLOTS = new Map([
  ['background image', 'bg'],
  ['thumbnail', 'thumb'],
  ['heading', 'heading'],
  ['description', 'description'],
  ['cta', 'cta'],
  ['products', 'products'],
]);

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

function firstImage(cell) {
  if (!cell) return null;
  const img = cell.querySelector('img');
  return img && img.getAttribute('src') ? img : null;
}

export default async function decorate(block) {
  const slots = new Map();
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const slot = SLOTS.get(norm(cells[0].textContent));
    if (slot) slots.set(slot, cells[1]);
  });

  // --- promo tile ---
  const promo = document.createElement('div');
  promo.className = 'product-carousel-promo';

  const bgImg = firstImage(slots.get('bg'));
  if (bgImg) {
    const bg = document.createElement('div');
    bg.className = 'product-carousel-bg';
    const optimized = createOptimizedPicture(bgImg.src, bgImg.alt || '', false, [{ width: '750' }]);
    bg.append(optimized);
    promo.append(bg);
  }

  const promoBody = document.createElement('div');
  promoBody.className = 'product-carousel-promo-body';

  const thumbImg = firstImage(slots.get('thumb'));
  if (thumbImg) {
    const thumb = document.createElement('div');
    thumb.className = 'product-carousel-thumb';
    thumb.append(createOptimizedPicture(thumbImg.src, thumbImg.alt || '', false, [{ width: '200' }]));
    promoBody.append(thumb);
  }

  const heading = slots.get('heading');
  if (heading && heading.textContent.trim()) {
    const h = document.createElement('h2');
    h.textContent = heading.textContent.trim();
    promoBody.append(h);
  }
  const desc = slots.get('description');
  if (desc && desc.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = desc.textContent.trim();
    promoBody.append(p);
  }
  const cta = slots.get('cta');
  const ctaLink = cta && cta.querySelector('a');
  if (ctaLink) {
    ctaLink.classList.add('button');
    promoBody.append(ctaLink);
  }
  promo.append(promoBody);

  // --- product cards ---
  const rail = document.createElement('ul');
  rail.className = 'product-carousel-rail';

  const productLinks = slots.get('products')
    ? [...slots.get('products').querySelectorAll('a[href]')]
    : [];
  const index = await loadProductIndex();
  const byPath = new Map(index.map((row) => [row.path, row]));

  productLinks.forEach((link) => {
    const path = new URL(link.href, window.location).pathname;
    const entry = byPath.get(path);
    const li = document.createElement('li');
    const card = document.createElement('a');
    card.className = 'product-carousel-card';
    card.href = path;

    const imageUrl = (entry && (entry.image || entry.imageSrc)) || '';
    if (imageUrl) {
      const media = document.createElement('div');
      media.className = 'product-carousel-card-image';
      if (/^https?:\/\//i.test(imageUrl)) {
        // external (AEM asset-delivery) URL — use a plain <img>
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = entry.productName || '';
        img.loading = 'lazy';
        media.append(img);
      } else {
        media.append(createOptimizedPicture(imageUrl, entry.productName || '', false, [{ width: '400' }]));
      }
      card.append(media);
    }

    const name = document.createElement('span');
    name.className = 'product-carousel-card-name';
    name.textContent = (entry && entry.productName) || link.textContent.trim();
    card.append(name);

    if (entry && entry.price) {
      const price = document.createElement('span');
      price.className = 'product-carousel-card-price';
      price.textContent = entry.price;
      card.append(price);
    }

    li.append(card);
    rail.append(li);
  });

  block.textContent = '';
  if (promo.children.length) block.append(promo);
  if (rail.children.length) block.append(rail);
}
