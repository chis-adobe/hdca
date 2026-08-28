/**
 * Shop by Department block — a tiled grid of department links.
 *
 * Authored structure:
 *   row 0: optional title (no links)
 *   a list of links to /dept/{slug} pages
 *
 * Each tile's title and thumbnail are pulled from /dept-index.json (populated from
 * each department page's og:title / og:image metadata). Falls back to the authored
 * link text when the index has no entry yet.
 *
 * @param {Element} block
 */

import { resolveIndexImage } from '../../scripts/scripts.js';

let indexPromise;
async function loadDeptIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/dept-index.json')
      .then((resp) => (resp.ok ? resp.json() : { data: [] }))
      .then((json) => json.data || [])
      .catch(() => []);
  }
  return indexPromise;
}

export default async function decorate(block) {
  const heading = block.querySelector('h1, h2, h3, h4, h5, h6');
  const links = [...block.querySelectorAll('a[href]')];

  const wrapper = document.createElement('div');
  wrapper.className = 'shop-by-department-inner';
  if (heading) {
    heading.classList.add('shop-by-department-title');
    wrapper.append(heading);
  }

  const grid = document.createElement('ul');
  grid.className = 'shop-by-department-grid';

  const index = await loadDeptIndex();
  const byPath = new Map(index.map((row) => [row.path, row]));

  links.forEach((link) => {
    const path = new URL(link.href, window.location).pathname;
    const entry = byPath.get(path);
    const li = document.createElement('li');
    const tile = document.createElement('a');
    tile.className = 'shop-by-department-tile';
    tile.href = path;

    const media = document.createElement('div');
    media.className = 'shop-by-department-tile-image';
    const imageUrl = resolveIndexImage(entry && entry.image);
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = (entry && entry.title) || '';
      img.loading = 'lazy';
      media.append(img);
    }
    tile.append(media);

    const label = document.createElement('span');
    label.className = 'shop-by-department-tile-label';
    label.textContent = (entry && entry.title) || link.textContent.trim();
    tile.append(label);

    li.append(tile);
    grid.append(li);
  });

  wrapper.append(grid);
  block.textContent = '';
  block.append(wrapper);
}
