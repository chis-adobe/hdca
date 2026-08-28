---
name: update-flyer-offers
description: Reorder the Top Flyer Offers block by product Sell Score (highest first). Reads the "Sell Score" metadata row from every product page under /fragments/products, sorts the products high-to-low, and rewrites the flyer-offers block's product list in the DA /index document, then previews and publishes. Use when the user says "update the flyer offers", "reorder flyer offers", "refresh top flyer offers", "sort flyer by sell score", or after Sell Score values change.
---

# Update Flyer Offers (by Sell Score)

Reorders the **Top Flyer Offers** block on the home page so products appear from the
highest Sell Score to the lowest. The Sell Score lives as a labelled row ("Sell Score")
in each product's spec sheet under `/fragments/products/{sku}`.

This skill is **content-only**: it edits the DA `/index` document's flyer-offers block
(the `<ul>` of product links) and re-publishes. It never touches block code — the
`flyer-offers` block already renders whatever product order the list is in.

## When to Use

- "update the flyer offers", "reorder flyer offers", "refresh top flyer offers"
- "sort flyer by sell score", "re-rank the flyer products"
- After changing any product's Sell Score value

**Do NOT use for:** adding/removing products from the flyer (edit the list in DA for that),
changing the block's design (that's `flyer-offers.css`/`.js`), or any non-flyer block.

## Prerequisites

- DA content source `chis-adobe/hdca` reachable via `admin.da.live` (credentials injected;
  never paste a token).
- Each product page has a "Sell Score" row with a numeric value. Products missing a valid
  score are treated as score 0 and sorted to the end (a warning is logged).

## Workflow

Run these steps in order. Use absolute `admin.da.live` / `admin.hlx.page` calls; auth is
injected automatically (send `Authorization: Bearer $DA_IMS_TOKEN` only when that env var
is set — otherwise send no auth header, per the project's credential rules).

### Step 1 — Read the current flyer-offers product list

Fetch the DA `/index` source and extract the flyer-offers block's product links **in order**,
capturing each link's `href` (the `/fragments/products/{sku}` path) **and** its anchor text
(the product label, which must be preserved verbatim):

```bash
curl -s "https://admin.da.live/source/chis-adobe/hdca/index.html" > /tmp/fo-index.html
```

Parse the `<ul>` inside `<div class="flyer-offers">…</div>` — its `<li><a href="…">label</a></li>`
entries are the products to reorder. If the block or its list is absent, stop and report.

### Step 2 — Read each product's Sell Score

For every product path in the list, fetch its fragment source and read the value cell of the
row whose label is exactly `Sell Score`:

```bash
curl -s "https://admin.da.live/source/chis-adobe/hdca/fragments/products/{sku}.html"
```

Match the label/value pair (structure: `<div><div><p>Sell Score</p></div><div><p>NN</p></div></div>`),
parse `NN` as an integer. Missing/non-numeric → 0 (log a warning listing those SKUs).

### Step 3 — Sort high → low

Sort the products by Sell Score descending. Break ties by the existing order (stable sort) so
equal scores keep their relative position.

### Step 4 — Rewrite the flyer-offers list in /index

Rebuild only the `<ul>`…`</ul>` inside the flyer-offers block, emitting the `<li><a>` entries in
the new order, **preserving each link's original href and label text exactly**. Replace that
`<ul>` in `/tmp/fo-index.html`; change nothing else in the document (this preserves the authored
hero images and every other block). Keep the surrounding
`<div class="flyer-offers"><div>…</div><div>…</div></div>` structure intact.

### Step 5 — Upload, preview, publish

```bash
# upload the edited /index back to DA
curl -s -X POST -F "data=@/tmp/fo-index.html;type=text/html" \
  "https://admin.da.live/source/chis-adobe/hdca/index.html"
# preview then publish
curl -s -X POST "https://admin.hlx.page/preview/chis-adobe/hdca/main/index"
curl -s -X POST "https://admin.hlx.page/live/chis-adobe/hdca/main/index"
```

(Prefix each `admin.da.live` call with `-H "Authorization: Bearer $DA_IMS_TOKEN"` only when
`$DA_IMS_TOKEN` is set.)

### Step 6 — Verify & report

Confirm the flyer-offers list in the delivered page reflects the new order:

```bash
curl -s --compressed "https://main--hdca--chis-adobe.aem.live/index.plain.html" \
  | grep -o '/fragments/products/[0-9]*'
```

Report the final ranked list as `label — score` (highest first), and note any products that
had no valid Sell Score.

## Implementation Notes

- Read scores **directly from the product pages**, not from `/product-index.json`. The query
  index's positional selectors don't reliably capture the Sell Score row, so the page source is
  the source of truth.
- The edit must be surgical (only the flyer `<ul>`). Never regenerate `/index` from a local
  file — that would wipe DA-authored hero images.
- `type=text/html` is required on the upload so DA stores it as a document.
- Do not add or drop products; only reorder the existing ones. If the user wants membership
  changes, that's a separate manual edit.
