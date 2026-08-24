# Apparel ERP - Product Development

Custom Frappe v16 app implementing:
- **Style** doctype (Style Information / Colours & Sizes / Style BOM / Matrix / REST API tabs)
- **Size** master with `size_code` used for SKU building
- Child tables: **Style Colour**, **Style Size** (also used as the Sizes "Table MultiSelect" source), **Style BOM Item**, **Style Matrix Item**

## What it does

1. **Multi-select sizes** - the `sizes` field on Style is a `Table MultiSelect` against `Style Size`.
   Picking sizes there *is* the size table (no separate sync needed) and, on save, `Style.validate()`
   auto-creates one placeholder row per active Colour x Size combination in `matrix_items`.
2. **Click-to-generate SKU + BOM** - the Matrix tab renders an HTML grid (`style.js -> render_matrix`).
   Clicking an ungenerated cell calls the whitelisted method
   `apparel_erp.product_development.doctype.style.style.generate_sku`, which:
   - creates an `Item` (SKU = `STYLE_NO-COLOUR_CODE-SIZE_CODE`) with the style image attached
   - creates a base `BOM` for that Item from the Style's BOM table (auto-creating simple
     component Items for any Fabric/Trim/Packaging line that isn't linked to a real raw material yet)
   - links both back onto the matrix row and marks it `Active`
   The browser is then redirected straight into the new `Item` form - Attach Image fields
   preview inline in Frappe, so the picture shows as an image, never as a bare file link.
3. **REST API tab** - shows the live `/api/resource/Style/<name>` endpoint for the record, a ready
   to use cURL example, and the common CRUD + the `generate_sku` method URL, with a Copy button.

## Install

```bash
bench get-app apparel_erp /path/to/this/folder
bench --site your-site install-app apparel_erp
bench --site your-site migrate
```

Then set up:
1. A few `Size` records (S / M / L / XL ...) with `size_code`.
2. A `Style`, add Colours (with `colour_code`), pick Sizes, add BOM lines, Save.
3. Open the **Matrix** tab and click any cell to generate its SKU + BOM.
