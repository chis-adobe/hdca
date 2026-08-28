/* eslint-disable secure-coding/no-insecure-comparison
-- this is browser-side EDS code, not Node server auth logic. Not secret material; public DOM/content metadata validation. */
import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateBlock,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForFirstImage,
  loadBlock,
  loadSection,
  loadSections,
  loadCSS,
  readBlockConfig,
  toClassName,
  loadScript,
  buildBlock,
} from './aem.js';
import { applySectionBackgroundDecorations, decorateNestedSections } from './feature-flags/sections.js';
import loadThemeSpreadSheetConfig from './feature-flags/theme-sheet.js';
import { decorateSpanTags } from './feature-flags/bracket-tags.js';
import { isVideoLink } from './utils.js';
import FEATURES from './feature-flags/features.js';

/** Set max sections/children to process (CWE-770). */
const MAX_SECTIONS = 100;
const MAX_SECTION_CHILDREN = 200;

/** Keys that must not be used for object/dataset assignment (CWE-915). */
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Returns true if key is safe for plain object or dataset assignment.
 * @param {string} key Property name
 * @returns {boolean}
 */
function isSafeObjectKey(key) {
  return typeof key === 'string' && key.length > 0
    && !UNSAFE_OBJECT_KEYS.has(key)
    && !key.startsWith('__');
}

// DOMPurify loaded once for HTML sanitization (mitigates DOM XSS from contentMap/dataset)
let domPurifyReady = null;

/**
 * Ensures DOMPurify is loaded. Resolves with the script load. Safe to call multiple times.
 * @returns {Promise<void>}
 */
export async function ensureDOMPurify() {
  if (!domPurifyReady) {
    const base = window.hlx?.codeBasePath ?? '';
    domPurifyReady = loadScript(`${base}/scripts/dompurify.min.js`);
  }
  return domPurifyReady;
}

/**
 * Universal Editor use
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      // DA UE doesn't like the ?. operator, but I know it works with Xwalk
    // to?.setAttribute(attr, value);
    // from?.removeAttribute(attr);
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Universal Editor use
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/* add a block id_number to a block instance (when any decorate(block) defines it)
  to be used for martech tracking, aria-controls, aria-labelledby, etc.
*/
const blockIds = new Map();
export function getBlockId(name) {
  const forBlock = blockIds.get(name) ?? 0;
  blockIds.set(name, forBlock + 1);
  return `${name}_${forBlock}`;
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references — but skip links that blocks consume
    // as data references rather than includes (the fragment block itself, and
    // the product blocks that link to /fragments/products/{sku} to build cards).
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')]
      .filter((f) => !f.closest('.fragment, .flyer-offers, .product-carousel'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }

    // auto-embed bare YouTube/Vimeo links, wherever they appear — default content, inside another
    // block's cell, or in a fragment (skip links already inside an authored embed/video block).
    // decorateBlock/loadBlock are called directly since the embed block may not be at the row/cell
    // depth decorateBlocks() and loadSections() expect (e.g. nested inside a cards or columns cell).
    if (FEATURES.videoLinks) {
      const videoLinks = [...main.querySelectorAll('a[href]')]
        .filter((a) => !a.closest('.embed, .video') && isVideoLink(a.href));
      videoLinks.forEach((a) => {
        const { parentElement } = a;
        const embedBlock = buildBlock('embed', { elems: [a] });
        parentElement.replaceWith(embedBlock);
        decorateBlock(embedBlock);
        loadBlock(embedBlock);
      });
    }

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Hosts considered "local" — links to these open in the same tab.
 * Everything else (plus any PDF) opens in a new tab.
 */
const LOCAL_HOSTS = new Set(['localhost']);
const LOCAL_HOST_SUFFIXES = ['.page', '.live'];

/**
 * @param {URL} url
 * @returns {boolean} true when the URL points at a first-party/local host
 */
function isLocalUrl(url) {
  const host = url.hostname.toLowerCase();
  if (host === window.location.hostname.toLowerCase()) return true;
  if (LOCAL_HOSTS.has(host)) return true;
  return LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Opens external links (and any PDF) in a new tab. First-party links to local
 * hosts keep their default same-tab behavior. In-page anchors and non-http(s)
 * schemes (mailto:, tel:, etc.) are left untouched.
 * @param {Element} element The container element
 */
export function decorateExternalLinks(element) {
  element.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    const isPdf = url.pathname.toLowerCase().endsWith('.pdf');
    if (isLocalUrl(url) && !isPdf) return;

    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
}

/** Duration for the in-page anchor smooth scroll (matches xenazineusa.com). */
const ANCHOR_SCROLL_DURATION_MS = 1000;

const anchorEaseInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/**
 * Smooth-scrolls the window to a target Y with an explicit duration (native
 * smooth scroll speed is not configurable).
 * @param {number} targetY
 * @param {number} duration
 */
function animatedScrollTo(targetY, duration = ANCHOR_SCROLL_DURATION_MS) {
  const start = window.scrollY;
  const distance = targetY - start;
  if (distance === 0) return;
  const startTime = performance.now();

  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, start + distance * anchorEaseInOutQuad(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Resolves the in-page target for an anchor click, or null if the link is not
 * a same-page hash link (external, cross-page, or bare "#").
 * @param {HTMLAnchorElement} anchor
 * @returns {HTMLElement|null}
 */
function inPageTarget(anchor) {
  const href = anchor.getAttribute('href');
  if (!href || href === '#' || !href.includes('#')) return null;

  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  // must resolve to the current page (same path) to be an in-page anchor
  if (url.pathname !== window.location.pathname || !url.hash) return null;

  const id = decodeURIComponent(url.hash.substring(1));
  if (!id) return null;
  return document.getElementById(id);
}

/**
 * Delegated smooth-scroll for in-page anchor links (e.g. nav cards that jump to
 * an on-page section). Matches the animated scroll on xenazineusa.com without
 * changing the URL hash (the source site scrolls without updating the URL).
 * Cross-page and external links are left untouched.
 * @param {Document|Element} scope
 */
export function enableSmoothAnchorScroll(scope = document) {
  scope.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = e.target.closest('a[href*="#"]');
    if (!anchor) return;

    const target = inPageTarget(anchor);
    if (!target) return;

    e.preventDefault();
    const scrollMargin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const targetY = target.getBoundingClientRect().top + window.scrollY - scrollMargin;
    animatedScrollTo(targetY);
  });
}

function a11yLinks(main) {
  const links = main.querySelectorAll('a');
  links.forEach((link) => {
    let label = link.textContent;
    if (!label && link.querySelector('span.icon')) {
      const icon = link.querySelector('span.icon');
      label = icon ? icon.classList[1]?.split('-')[1] : label;
    }
    link.setAttribute('aria-label', label);
  });
}

function autolinkModals(doc) {
  doc.addEventListener('click', async (e) => {
    const origin = e.target.closest('a');
    if (origin && origin.href && origin.href.includes('/modals/')) {
      e.preventDefault();
      const { openModal } = await import(`${window.hlx.codeBasePath}/blocks/modal/modal.js`);
      openModal(origin.href);
    }
  });
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
export function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/* === SECTIONS === */

/**
 * Decorates all sections in a container element.
 * @param {Element} main The container element
 */
export function decorateSections(main) {
  const sectionEls = main.querySelectorAll(':scope > div');
  const sectionLimit = Math.min(sectionEls.length, MAX_SECTIONS);
  for (let si = 0; si < sectionLimit; si += 1) {
    const section = sectionEls.item(si);
    const wrappers = [];
    let defaultContent = false;
    // Snapshot children so moving nodes during iteration doesn't invalidate indices
    const sectionChildren = [...section.children].slice(0, MAX_SECTION_CHILDREN);
    sectionChildren.forEach((e) => {
      // from the da boilerplate
      if (e.classList.contains('richtext')) {
        e.removeAttribute('class');
        if (!defaultContent) {
          const wrapper = document.createElement('div');
          wrapper.classList.add('default-content-wrapper');
          wrappers.push(wrapper);
          defaultContent = true;
        } // end da boilerplate
      } else if (e.tagName === 'DIV' || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV';
        if (defaultContent) wrapper.classList.add('default-content-wrapper');
      }
      wrappers.at(-1)?.append(e);
    });

    // Add wrapped content back
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    section.setAttribute('data-section-status', 'initialized');
    section.style.display = 'none';

    // Process section metadata was removed from adobe/aem-boilerplate but AEMaaCS pipeline requires it
    // see https://github.com/adobe-rnd/aem-boilerplate-xwalk/pull/95
    const sectionMeta = section.querySelector('div.section-metadata');
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);
      Object.entries(meta).forEach(([key, value]) => {
        if (key === 'style') {
          const styleStr = typeof value === 'string' ? value : '';
          const styles = styleStr
            .split(',')
            .filter((style) => style)
            .map((style) => toClassName(style.trim()));
          styles.forEach((style) => section.classList.add(style));
        } else if (isSafeObjectKey(key)) {
          section.setAttribute(`data-${key}`, String(value ?? ''));
        }
      });
      sectionMeta.parentNode.remove();
    }

    // Apply background decorations from data-* attributes (set via section-metadata or by the platform)
    if (FEATURES.sectionBackground) {
      applySectionBackgroundDecorations(section, {
        background: section.getAttribute('data-background') || '',
        'background-color': section.getAttribute('data-background-color') || '',
        'background-image': section.getAttribute('data-background-image') || '',
      });
    }
  }
}

/* === END SECTIONS === */


/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  if (FEATURES.nestedSections) decorateNestedSections(main);
  decorateButtons(main);
  a11yLinks(main);
  if (FEATURES.spanTags) decorateSpanTags(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  if (FEATURES.themeSheet) loadThemeSpreadSheetConfig();
  if (getMetadata('breadcrumbs').toLowerCase() === 'true') {
    doc.body.dataset.breadcrumbs = true;
  }
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
  if (window.matchMedia('(min-width: 900px)').matches || sessionStorage.getItem('fonts-loaded')) {
    loadFonts();
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  autolinkModals(doc);

  const main = doc.querySelector('main');
  await loadSections(main);

  enableSmoothAnchorScroll(doc);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  const loadQuickEdit = async (...args) => {
    // eslint-disable-next-line import/no-cycle
    const { default: initQuickEdit } = await import('../tools/quick-edit/quick-edit.js');
    initQuickEdit(...args);
  };

  const addSidekickListeners = (sk) => {
    sk.addEventListener('custom:quick-edit', loadQuickEdit);
  };

  const sk = document.querySelector('aem-sidekick');
  if (sk) {
    addSidekickListeners(sk);
  } else {
    // wait for sidekick to be loaded
    document.addEventListener('sidekick-ready', () => {
    // sidekick now loaded
      addSidekickListeners(document.querySelector('aem-sidekick'));
    }, { once: true });
  }

  (() => {
    const hasQE = new URL(window.location.href).searchParams.has('quick-edit');
    if (hasQE) import('../tools/quick-edit/quick-edit.js').then((mod) => mod.default());
  })();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  const importDelayed = () => import('./delayed.js');

  if ('requestIdleCallback' in window) {
    // prevents INP/TBT issues by only loading when CPU has capacity
    window.requestIdleCallback(importDelayed, { timeout: 3000 });
  } else {
    window.setTimeout(importDelayed, 3000); // fallback 3-second timeout
  }
}

/* DA specific sidekick */
async function loadSidekick() {
  if (document.querySelector('aem-sidekick')) {
    import('../tools/sidekick/sidekick.js');
    return;
  }

  document.addEventListener('sidekick-ready', () => {
    import('../tools/sidekick/sidekick.js');
  });
}

export async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  loadSidekick();
}

// DA UE Editor support before page load
if (window.location.hostname.includes('ue.da.live')) {
  await import(`${window.hlx.codeBasePath}/ue/scripts/ue.js`).then(({ default: ue }) => ue());
}
loadPage();

/* new DA NX stuff */
const { searchParams, origin } = new URL(window.location.href);
const branch = searchParams.get('nx') || 'main';

/* eslint-disable browser-security/detect-mixed-content -- CWE-311: OWASP:A04-Cryptographic */
export const NX_ORIGIN = branch === 'local' || origin.includes('localhost') ? 'http://localhost:6456/nx' : 'https://da.live/nx';

(async function loadDa() {
  /* eslint-disable import/no-unresolved */
  if (searchParams.get('dapreview')) {
    import('https://da.live/scripts/dapreview.js')
      .then(({ default: daPreview }) => daPreview(loadPage));
  }
  if (searchParams.get('daexperiment')) {
    import(`${NX_ORIGIN}/public/plugins/exp/exp.js`);
  }
}());
