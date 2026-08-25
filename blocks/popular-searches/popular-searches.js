/**
 * Popular Searches block — a heading followed by a row of boxed link chips.
 *
 * Authored structure (default-content style inside the block):
 *   - an optional heading (first row, no links)
 *   - a list of links (each becomes a boxed chip)
 *
 * @param {Element} block
 */
export default function decorate(block) {
  const heading = block.querySelector('h1, h2, h3, h4, h5, h6');
  const links = [...block.querySelectorAll('a')];

  const wrapper = document.createElement('div');
  wrapper.className = 'popular-searches-inner';

  if (heading) {
    heading.classList.add('popular-searches-title');
    wrapper.append(heading);
  }

  const chips = document.createElement('ul');
  chips.className = 'popular-searches-chips';
  links.forEach((link) => {
    const li = document.createElement('li');
    link.classList.add('popular-searches-chip');
    li.append(link);
    chips.append(li);
  });

  wrapper.append(chips);
  block.textContent = '';
  block.append(wrapper);
}
