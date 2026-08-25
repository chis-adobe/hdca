import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment — content lives in the authored fragment (DA: /fragments/page/footer,
  // local preview: /content/footer). All copy/links come from that DOM, never hardcoded here.
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/content/footer';
  let fragment = await loadFragment(footerPath);
  // local-dev fallback: aem up serves the fragment at /content/footer.plain.html
  if (!fragment && footerPath !== '/content/footer') {
    fragment = await loadFragment('/content/footer');
  }
  if (!fragment) return;

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);
}
