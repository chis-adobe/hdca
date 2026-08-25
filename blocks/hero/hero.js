/**
 * Hero block — image + text with a style variant.
 *
 * Authored structure (3 rows, one cell each):
 *   row 0: image  (a <picture>/<img>, or a link to an image asset)
 *   row 1: text   (heading, description, CTA link)
 *   row 2: style  (one of: "background-image", "left-image")
 *
 * Styles:
 *   - background-image: image fills the hero behind the text (text overlaid)
 *   - left-image:       image on the left, text on the right
 *
 * Images may be authored as links to AEM asset-delivery URLs; this block turns
 * those links into <img> elements (the EDS pipeline blanks site-path <img> tags).
 *
 * @param {Element} block
 */

const KNOWN_STYLES = ['background-image', 'left-image'];

function isImageUrl(url) {
  return /\.(avif|webp|png|jpe?g|gif|svg)(\?|$)/i.test(url) || /\/adobe\/assets\//i.test(url);
}

export default function decorate(block) {
  const rows = [...block.children];

  // row 2: style — read and remove so it isn't rendered
  let variant = '';
  if (rows.length >= 3) {
    const styleText = rows[2].textContent.trim().toLowerCase();
    variant = KNOWN_STYLES.find((s) => styleText.includes(s)) || '';
    rows[2].remove();
  }
  if (variant) block.classList.add(variant);

  // row 0: image — normalise a link-to-asset into an <img>
  const imageCell = rows[0];
  if (imageCell) {
    imageCell.classList.add('hero-image');
    if (!imageCell.querySelector('img')) {
      const link = [...imageCell.querySelectorAll('a[href]')].find((a) => isImageUrl(a.href));
      if (link) {
        const img = document.createElement('img');
        img.src = link.href;
        img.loading = 'lazy';
        img.alt = '';
        const picture = document.createElement('picture');
        picture.append(img);
        link.replaceWith(picture);
      }
    }
  }

  // row 1: text
  if (rows[1]) {
    rows[1].classList.add('hero-text');
    // style the CTA link as a button
    const cta = rows[1].querySelector('a');
    if (cta) cta.classList.add('button');
  }
}
