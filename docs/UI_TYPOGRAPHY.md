# CarMate UI typography

Use Inter for content, headings and controls. `font-display` uses the same font family as `font-sans`; the system falls back to a backup font only when Inter has not loaded. The monospace font is reserved for codes, PINs and technical information where each character must be preserved.

| Role | Class | Size | Weight |
| --- | --- | --- | --- |
| Large page title | `type-page-title` | 24px | 700 |
| Screen / dialog title | `type-title` | 20px | 700 |
| Block / card heading | `type-heading` | 16px | 600 |
| Body text | `type-body` | 14px | 400 |
| Emphasized body text | `type-body-strong` | 14px | 600 |
| Field label | `type-label` | 14px | 500 |
| Action button | `type-button` | 14px | 600 |
| Compact button / filter | `type-button-sm` | 13px | 600 |
| Input and select | `type-input` | 16px | 400 |
| Secondary explanation | `type-caption` | 13px | 400 |
| Timestamp / small note | `type-footnote` | 12px | 400 |
| Status label / counter | `type-badge` | 12px | 600 |
| Mobile navigation | `type-nav` | 12px | 500 |
| Highlighted metric | `type-metric` | 24px | 700 |

Font sizes are declared in `rem`; the table is computed with a 16px root size. Each class defines the size, weight, line height and letter spacing. Use one role per element; do not add `text-sm`, `font-bold`, `leading-*` or `tracking-*` that would skew that role.

- Information that drives the trip decision (time, seats, pickup point, price) uses body or heading text; do not shrink it into a caption.
- Inputs stay at 16px on both desktop and mobile; do not go below 16px on phones.
- Avoid changing font size when selecting a tab or button; use color, background or border to show state.
- Price and time use `tabular` if column alignment is needed; do not switch to monospace.
- Do not add 9–11px sizes or odd sizes specific to a single screen.
- Check Vietnamese text, line breaks and horizontal overflow on mobile when changing content.
