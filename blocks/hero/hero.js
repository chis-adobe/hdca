/**
 * Hero block — image + text + CTA, laid out as 4 rows × 2 columns.
 *
 * Authored structure:
 *   row 0: [ image ]            [ image style ]   image style: background-image | left-image | right-image
 *   row 1: [ text  ]            [ (reserved)   ]   text = heading + paragraph(s) in one cell
 *   row 2: [ CTA   ]            [ cta style    ]   cta style: primary | link
 *   row 3: [ (reserved) ]       [ bg colour    ]   bg colour: white | orange | grey (left/right-image only)
 *
 * Image styles:
 *   - background-image: image fills the hero behind the text (text overlaid)
 *   - left-image:       image on the left, text on the right
 *   - right-image:      image on the right, text on the left
 * CTA styles:
 *   - primary: filled button
 *   - link:    plain text link
 * Background colour (left-image / right-image only; ignored for background-image):
 *   - white | orange | grey → adds .bg-white / .bg-orange / .bg-grey to the text side
 *
 * The image is a standard authored image (<picture>/<img>).
 *
 * @param {Element} block
 */

const IMAGE_STYLES = ['background-image', 'left-image', 'right-image'];
const CTA_STYLES = ['primary', 'link'];
const BG_COLOURS = ['white', 'orange', 'grey', 'blue'];

// pick the matching keyword from a cell's text, or '' if none/no cell
function readStyle(cell, allowed) {
  if (!cell) return '';
  const text = cell.textContent.trim().toLowerCase();
  return allowed.find((s) => text.includes(s)) || '';
}

// move the CTA link from its cell into the text block, styled per cta style
function appendCta(text, ctaCell, ctaStyle) {
  if (!ctaCell) return;
  const cta = ctaCell.querySelector('a');
  if (!cta) return;
  // link style = plain text link; default / primary = filled button
  cta.classList.add(ctaStyle === 'link' ? 'hero-cta-link' : 'button');
  const ctaWrap = document.createElement('p');
  ctaWrap.className = 'hero-cta';
  ctaWrap.append(cta);
  text.append(ctaWrap);
}

export default function decorate(block) {
  const [imageRow, textRow, ctaRow, bgRow] = [...block.children];
  const cells = (row) => (row ? [...row.children] : []);
  const [imageCell, imageStyleCell] = cells(imageRow);
  const [textCell] = cells(textRow);
  const [ctaCell, ctaStyleCell] = cells(ctaRow);
  const bgCells = cells(bgRow);
  const bgColourCell = bgCells[1] || bgCells[0];

  const imageStyle = readStyle(imageStyleCell, IMAGE_STYLES);
  const ctaStyle = readStyle(ctaStyleCell, CTA_STYLES);
  const bgColour = readStyle(bgColourCell, BG_COLOURS);

  if (imageStyle) block.classList.add(imageStyle);

  // background colour applies only to the split (left/right-image) layouts
  const isSplit = imageStyle === 'left-image' || imageStyle === 'right-image';
  if (isSplit && bgColour) block.classList.add(`bg-${bgColour}`);

  // build the parts fresh so we control the 2-column authoring vs rendered layout
  const image = document.createElement('div');
  image.className = 'hero-image';
  if (imageCell) {
    while (imageCell.firstChild) image.append(imageCell.firstChild);
  }

  const text = document.createElement('div');
  text.className = 'hero-text';
  if (textCell) {
    while (textCell.firstChild) text.append(textCell.firstChild);
  }

  appendCta(text, ctaCell, ctaStyle);

  block.textContent = '';
  block.append(image, text);
}
