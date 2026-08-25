import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Product Details block — PIM-style spec sheet.
 *
 * Fixed authored row order (one value per row), shared by DA and Universal Editor:
 *   0 primaryImage, 1 productName, 2 brand, 3 price, 4 shortDescription,
 *   5 keyFeatures, 6 sku, 7 modelNumber, 8 breadcrumbCategory, 9 colourFamily,
 *   10 assembledDepthIn, 11 assembledHeightIn, 12 assembledWidthIn, 13 assembledWeightLbs,
 *   14 packagedDepthIn, 15 packagedHeightIn, 16 packagedWidthIn, 17 packagedWeightLbs,
 *   18 reviewCount, 19 warrantyText, 20 sourceUrl
 *
 * The intro area renders image + name/brand/price/description/features; the remaining
 * fields render as a labelled spec table.
 *
 * @param {Element} block
 */

// spec fields shown in the table, in order, with their display labels
const SPEC_FIELDS = [
  { idx: 6, label: 'SKU' },
  { idx: 7, label: 'Model Number' },
  { idx: 8, label: 'Breadcrumb Category' },
  { idx: 9, label: 'Colour Family' },
  { idx: 10, label: 'Assembled Depth (in)' },
  { idx: 11, label: 'Assembled Height (in)' },
  { idx: 12, label: 'Assembled Width (in)' },
  { idx: 13, label: 'Assembled Weight (lbs)' },
  { idx: 14, label: 'Packaged Depth (in)' },
  { idx: 15, label: 'Packaged Height (in)' },
  { idx: 16, label: 'Packaged Width (in)' },
  { idx: 17, label: 'Packaged Weight (lbs)' },
  { idx: 18, label: 'Review Count' },
  { idx: 19, label: 'Warranty' },
  { idx: 20, label: 'Source URL' },
];

export default function decorate(block) {
  const rows = [...block.children];
  const cellOf = (i) => (rows[i] ? rows[i].querySelector(':scope > div') || rows[i] : null);

  const header = document.createElement('div');
  header.className = 'product-details-header';

  // media (row 0)
  const media = document.createElement('div');
  media.className = 'product-details-media';
  const imageCell = cellOf(0);
  const picture = imageCell && imageCell.querySelector('picture');
  if (picture) media.append(picture);

  // intro: name, brand, price, description, features (rows 1–5)
  const intro = document.createElement('div');
  intro.className = 'product-details-intro';
  const name = cellOf(1)?.textContent.trim();
  if (name) {
    const h = document.createElement('h1');
    h.textContent = name;
    intro.append(h);
  }
  const brand = cellOf(2)?.textContent.trim();
  const price = cellOf(3)?.textContent.trim();
  if (brand) {
    const p = document.createElement('p');
    p.className = 'product-details-brand';
    p.textContent = brand;
    intro.append(p);
  }
  if (price) {
    const p = document.createElement('p');
    p.className = 'product-details-price';
    p.textContent = price;
    intro.append(p);
  }
  const descCell = cellOf(4);
  if (descCell && descCell.textContent.trim()) {
    const p = document.createElement('p');
    p.className = 'product-details-description';
    // unwrap a single nested <p> so we don't emit <p><p>…</p></p>
    const inner = descCell.children.length === 1 && descCell.firstElementChild.tagName === 'P'
      ? descCell.firstElementChild : descCell;
    p.append(...inner.childNodes);
    intro.append(p);
  }
  const featuresCell = cellOf(5);
  if (featuresCell && featuresCell.querySelector('ul, ol')) {
    intro.append(featuresCell.querySelector('ul, ol'));
  }

  // spec table (remaining fields)
  const table = document.createElement('dl');
  table.className = 'product-details-specs';
  SPEC_FIELDS.forEach(({ idx, label }) => {
    const cell = cellOf(idx);
    if (!cell || !cell.textContent.trim()) return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    const link = cell.querySelector('a');
    if (link) {
      dd.append(link);
    } else {
      dd.textContent = cell.textContent.trim();
    }
    table.append(dt, dd);
  });

  // optimize primary image
  media.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    img.closest('picture').replaceWith(optimized);
  });

  header.append(media, intro);
  block.textContent = '';
  block.append(header);
  if (table.children.length) block.append(table);
}
