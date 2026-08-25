/**
 * Hero block — image + text + CTA, laid out as 3 rows × 2 columns.
 *
 * Authored structure:
 *   row 0: [ image ]            [ image style ]   image style: background-image | left-image
 *   row 1: [ text  ]            [ (reserved)   ]   text = heading + paragraph(s) in one cell
 *   row 2: [ CTA   ]            [ cta style    ]   cta style: primary | link
 *
 * Image styles:
 *   - background-image: image fills the hero behind the text (text overlaid)
 *   - left-image:       image on the left, text on the right
 * CTA styles:
 *   - primary: filled button
 *   - link:    plain text link
 *
 * Images may be authored as links to AEM asset-delivery URLs; this block turns
 * those links into <img> elements (the EDS pipeline blanks site-path <img> tags).
 *
 * @param {Element} block
 */

const IMAGE_STYLES = ['background-image', 'left-image'];
const CTA_STYLES = ['primary', 'link'];

function isImageUrl(url) {
  return /\.(avif|webp|png|jpe?g|gif|svg)(\?|$)/i.test(url) || /\/adobe\/assets\//i.test(url);
}

// pick the matching keyword from a cell's text, or '' if none/no cell
function readStyle(cell, allowed) {
  if (!cell) return '';
  const text = cell.textContent.trim().toLowerCase();
  return allowed.find((s) => text.includes(s)) || '';
}

// turn a link-to-image-asset inside a cell into a <picture><img>
function normaliseImage(cell) {
  if (!cell || cell.querySelector('img')) return;
  const link = [...cell.querySelectorAll('a[href]')].find((a) => isImageUrl(a.href));
  if (!link) return;
  const img = document.createElement('img');
  img.src = link.href;
  img.loading = 'lazy';
  img.alt = '';
  const picture = document.createElement('picture');
  picture.append(img);
  link.replaceWith(picture);
}

export default function decorate(block) {
  const [imageRow, textRow, ctaRow] = [...block.children];
  const cells = (row) => (row ? [...row.children] : []);
  const [imageCell, imageStyleCell] = cells(imageRow);
  const [textCell] = cells(textRow);
  const [ctaCell, ctaStyleCell] = cells(ctaRow);

  const imageStyle = readStyle(imageStyleCell, IMAGE_STYLES);
  const ctaStyle = readStyle(ctaStyleCell, CTA_STYLES);

  if (imageStyle) block.classList.add(imageStyle);

  // build the parts fresh so we control the 2-column authoring vs rendered layout
  const image = document.createElement('div');
  image.className = 'hero-image';
  if (imageCell) {
    normaliseImage(imageCell);
    while (imageCell.firstChild) image.append(imageCell.firstChild);
  }

  const text = document.createElement('div');
  text.className = 'hero-text';
  if (textCell) {
    while (textCell.firstChild) text.append(textCell.firstChild);
  }

  // CTA: move any link into the text block, styled per cta style
  if (ctaCell) {
    const cta = ctaCell.querySelector('a');
    if (cta) {
      if (ctaStyle === 'link') {
        cta.classList.add('hero-cta-link');
      } else {
        // default / primary → filled button
        cta.classList.add('button');
      }
      const ctaWrap = document.createElement('p');
      ctaWrap.className = 'hero-cta';
      ctaWrap.append(cta);
      text.append(ctaWrap);
    }
  }

  block.textContent = '';
  block.append(image, text);
}
