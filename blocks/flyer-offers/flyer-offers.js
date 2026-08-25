/**
 * Flyer Offers block — a title and a horizontal carousel of product cards.
 *
 * Authored structure:
 *   row 0: [ Title ]
 *   row 1: [ <ul> of links to /fragments/products/{sku} ]
 *
 * Each product card is built from /product-index.json (image, brand, title,
 * rating + review count, price, savings, was price), linking to the product page.
 *
 * @param {Element} block
 */

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

function buildRating(rating, reviewCount) {
  const num = parseFloat(rating);
  if (!reviewCount || Number.isNaN(num)) return null;
  const wrap = document.createElement('span');
  wrap.className = 'flyer-offers-rating';
  const full = Math.round(num);
  const stars = document.createElement('span');
  stars.className = 'flyer-offers-stars';
  stars.setAttribute('aria-hidden', 'true');
  stars.textContent = '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full);
  const count = document.createElement('span');
  count.className = 'flyer-offers-rating-count';
  count.textContent = `(${reviewCount})`;
  wrap.append(stars, count);
  wrap.setAttribute('aria-label', `Rating ${num} out of 5`);
  return wrap;
}

function appendPricing(body, entry) {
  if (entry.price) {
    const price = document.createElement('span');
    price.className = 'flyer-offers-price';
    price.textContent = entry.price.replace(/ CAD$/, '');
    const per = document.createElement('span');
    per.className = 'flyer-offers-per';
    per.textContent = ' / each';
    price.append(per);
    body.append(price);
  }
  if (entry.savings) {
    const savings = document.createElement('span');
    savings.className = 'flyer-offers-savings';
    savings.textContent = entry.savings;
    body.append(savings);
  }
  if (entry.originalPrice) {
    const was = document.createElement('span');
    was.className = 'flyer-offers-was';
    was.textContent = `Was ${entry.originalPrice}`;
    body.append(was);
  }
}

function buildCard(entry, link) {
  const path = new URL(link.href, window.location).pathname;
  const card = document.createElement('a');
  card.className = 'flyer-offers-card';
  card.href = path;

  const rawImage = entry && (entry.image || entry.imageSrc);
  const imageUrl = rawImage && rawImage !== 'about:error' ? rawImage : '';
  const media = document.createElement('div');
  media.className = 'flyer-offers-card-image';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = (entry && entry.productName) || '';
    img.loading = 'lazy';
    media.append(img);
  }
  card.append(media);

  const body = document.createElement('div');
  body.className = 'flyer-offers-card-body';
  if (entry && entry.brand) {
    const brand = document.createElement('strong');
    brand.className = 'flyer-offers-card-brand';
    brand.textContent = entry.brand;
    body.append(brand);
  }
  const title = document.createElement('span');
  title.className = 'flyer-offers-card-title';
  title.textContent = (entry && entry.productName) || link.textContent.trim();
  body.append(title);
  if (entry) {
    const rating = buildRating(entry.rating, entry.reviewCount);
    if (rating) body.append(rating);
    appendPricing(body, entry);
  }
  card.append(body);
  return card;
}

export default async function decorate(block) {
  const [titleRow, productsRow] = [...block.children];

  const title = document.createElement('h2');
  title.className = 'flyer-offers-title';
  if (titleRow) title.textContent = titleRow.textContent.trim();

  const rail = document.createElement('ul');
  rail.className = 'flyer-offers-rail';
  const links = productsRow ? [...productsRow.querySelectorAll('a[href]')] : [];
  const index = await loadProductIndex();
  const byPath = new Map(index.map((row) => [row.path, row]));
  links.forEach((link) => {
    const entry = byPath.get(new URL(link.href, window.location).pathname);
    const li = document.createElement('li');
    li.append(buildCard(entry, link));
    rail.append(li);
  });

  block.textContent = '';
  block.append(title, rail);
}
