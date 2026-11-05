# Application typography standard

The active React interface uses locally bundled **Inter Variable**, with a system sans-serif fallback during loading or for unsupported glyphs. It does not request fonts from a third-party CDN. The OFL notice is shipped at `/licenses/inter-OFL.txt` in the production frontend.

`react/src/typography.css` is the only application stylesheet that declares font family, size, weight, line height or letter spacing. Component geometry/colours remain in `styles.css`. Avoid inline font styles and component-specific size overrides. Use semantic HTML headings, labels, small supporting text and the shared classes.

| Purpose | Token | Size at a 16px browser base |
|---|---|---:|
| Supporting text, metadata, status badges | --text-caption | 12px |
| Field labels, legends, table column headings | --text-label | 13px |
| Body, guide content, table cells, buttons, inputs/selects/textareas | --text-body | 14px |
| Subsection/card headings | --text-subheading | 16px |
| Section headings | --text-section | 18px |
| Dialog titles | --text-dialog | 20px |
| Page title / brand | --text-title | 24px |
| Numeric summary metrics | --text-metric | 28px |

Regular text and entered values use weight 400; secondary emphasis uses 500, labels/actions use 600 and headings/metrics use 700. Body line height is 1.5; headings use 1.25. Metadata never drops below the caption size on narrow screens. Controls use rem-based sizing so they grow with the browser text setting; the root font size is not locked to a fixed pixel value. Dense tables and the workflow canvas retain their own scroll containers where two-dimensional content requires them.

A hierarchy of sizes is intentional: consistency means the same purpose has the same treatment, not that headings and captions are identical. Colour/state, focus indicators and permission behaviour are independent of typography.

Verification includes computed font/size checks across primary screens, representative forms/dialogs, loaded web-font checks, narrow-screen views and enlarged-text smoke checks. This is regression coverage, not a full WCAG conformance assessment. A CSS source check prevents font declarations reappearing in layout styles or inline component font-size/font-family overrides.
