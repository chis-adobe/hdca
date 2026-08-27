/**
 * Product Details block — PIM-style spec sheet.
 *
 * Authored structure: every row is two cells — a Label and a Value:
 *   | Primary Images   | (one or more images; may be empty) |
 *   | Product Name     | ...                                |
 *   | Brand            | ...                                |
 *   | Price            | ...                                |
 *   | Short Description| ...                                |
 *   | Key Features     | <ul>…</ul>                         |
 *   | SKU              | ...                                |
 *   | …                | …                                  |
 *   | Source URL       | <a href>…</a>                      |
 *
 * The block is label-driven: rows whose label matches a known intro slot render in the
 * header (image + name/brand/price/description/features); every other Label|Value row
 * renders in the spec table with its label shown. Order-independent.
 *
 * @param {Element} block
 */

const norm = (s) => s.trim().toLowerCase();

// labels that render in the header/intro area → slot name
const INTRO_SLOTS = new Map([
  ['primary images', 'images'],
  ['primary image', 'images'],
  ['product name', 'name'],
  ['brand', 'brand'],
  ['price', 'price'],
  ['short description', 'description'],
  ['key features', 'features'],
]);

export default function decorate(block) {
  const media = document.createElement('div');
  media.className = 'product-details-media';
  const intro = document.createElement('div');
  intro.className = 'product-details-intro';
  const table = document.createElement('dl');
  table.className = 'product-details-specs';

  const slots = new Map();

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return; // a labelled row needs Label + Value
    const label = cells[0].textContent.trim();
    if (!label) return;
    const valueCell = cells[1];
    const slot = INTRO_SLOTS.get(norm(label));

    if (slot) {
      slots.set(slot, valueCell);
      return;
    }

    // spec row — label + value
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    const link = valueCell.querySelector('a');
    if (link) dd.append(link);
    else dd.textContent = valueCell.textContent.trim();
    table.append(dt, dd);
  });

  // media — collect every authored image in the Primary Images cell (supports multiple).
  // Images may be authored as <picture> (DA doc) or a bare <img> (Universal Editor).
  const imagesCell = slots.get('images');
  if (imagesCell) {
    imagesCell.querySelectorAll('picture').forEach((pic) => {
      const img = pic.querySelector('img');
      if (img && img.getAttribute('src')) media.append(pic);
    });
    // bare <img> not wrapped in a <picture>
    imagesCell.querySelectorAll('img[src]').forEach((img) => {
      if (!img.closest('picture')) media.append(img);
    });
  }

  // intro text
  const nameCell = slots.get('name');
  if (nameCell) {
    const h = document.createElement('h1');
    h.textContent = nameCell.textContent.trim();
    intro.append(h);
  }
  const brandCell = slots.get('brand');
  if (brandCell && brandCell.textContent.trim()) {
    const p = document.createElement('p');
    p.className = 'product-details-brand';
    p.textContent = brandCell.textContent.trim();
    intro.append(p);
  }
  const priceCell = slots.get('price');
  if (priceCell && priceCell.textContent.trim()) {
    const p = document.createElement('p');
    p.className = 'product-details-price';
    p.textContent = priceCell.textContent.trim();
    intro.append(p);
  }
  const descCell = slots.get('description');
  if (descCell && descCell.textContent.trim()) {
    const p = document.createElement('p');
    p.className = 'product-details-description';
    const inner = descCell.children.length === 1 && descCell.firstElementChild.tagName === 'P'
      ? descCell.firstElementChild : descCell;
    p.append(...inner.childNodes);
    intro.append(p);
  }
  const featuresCell = slots.get('features');
  if (featuresCell && featuresCell.querySelector('ul, ol')) {
    intro.append(featuresCell.querySelector('ul, ol'));
  }

  const header = document.createElement('div');
  header.className = 'product-details-header';
  if (media.querySelector('picture, img')) header.append(media);
  header.append(intro);

  block.textContent = '';
  block.append(header);
  if (table.children.length) block.append(table);
}
