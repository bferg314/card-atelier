# Card Atelier

A browser app for designing playing card decks and exporting them as portable JSON.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # model tests (schema, round trip, card list)
npm run build   # type check + production build in dist/
npm run schema  # regenerate docs/open-playing-cards.schema.json after changing src/model/open.ts
```

Decks save automatically to the browser (IndexedDB). **Export JSON** offers two formats:

- **Card Atelier file** (`<name>.deck.json`): everything needed to reopen and edit the deck. **Import** reads it back.
- **Open Playing Cards** (`<name>.cards.json`): a finished PNG of every card and the back, plus suit, rank and value. **Use this one in games.** It does not depend on how Card Atelier draws cards, so it stays stable as the editor changes. The spec is in [docs/open-playing-cards.md](docs/open-playing-cards.md).

## Card Atelier file format (v1)

The editor's own format. Images and uploaded fonts are embedded as `data:` URIs. It changes as the editor gains features; games should read the Open Playing Cards export instead.

| Field | Meaning |
| --- | --- |
| `format`, `version` | Always `"playing-card-deck"` and `1`. Check both before loading. |
| `name`, `author`, `description` | Deck metadata. |
| `card` | Physical size in mm (`widthMm`, `heightMm`, `cornerRadiusMm`), `background`, `border`, `accent` colors. |
| `suits[]` | `id`, `name`, `symbol`, `color`, `font` (`family`, `weight`), optional `pipImage`. |
| `ranks[]` | `id`, `label`, numeric `value` (A = 1 … K = 13), `lettering` (size and mm offsets for the corner index and court monogram, shared by every card of that rank). |
| `artFrame` | The picture window shared by face cards and jokers: `shape` (`rect`, `arch`, `oval`), margins, `cornerRadiusMm`, `lines` (`double`, `single`, `none`), `widthMm`, `color` (null follows the accent), `tint`. |
| `faces` | Pictures keyed by card id (`"hearts-K"`): `image`, `fit` (`scale`, `x`, `y`), `mirror`. |
| `back` | `kind` (`pattern` or `image`), `pattern`, `colors` [ground, ink], `image`, `border`. |
| `jokers` | `enabled` and `items[]` (`id`, `label`, `color`, `font`, `image`). |
| `fonts[]` | Where each font comes from: `google`, `system`, or `embedded` with `data`. |
| `cards[]` | A flat card list, one entry per card, in suit then rank order, jokers last when enabled: `{ id, kind, suit, rank, value, label, color }`. |

The editor rebuilds `cards` on every export and ignores it on import, so it always matches the rest of the file.
