# Card Atelier

A browser app for designing playing card decks and exporting them as portable JSON.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # model tests (schema, round trip, card list)
npm run build   # type check + production build in dist/
```

Decks save automatically to the browser (IndexedDB). **Export JSON** writes a single self-contained `<name>.deck.json`; **Import** reads one back.

## Deck file format (v1)

Everything a game needs is in one file. Images and uploaded fonts are embedded as `data:` URIs.

| Field | Meaning |
| --- | --- |
| `format`, `version` | Always `"playing-card-deck"` and `1`. Check both before loading. |
| `name`, `author`, `description` | Deck metadata. |
| `card` | Physical size in mm (`widthMm`, `heightMm`, `cornerRadiusMm`), `background`, `border`, `accent` colors. |
| `suits[]` | `id`, `name`, `symbol`, `color`, `font` (`family`, `weight`), optional `pipImage`. |
| `ranks[]` | `id`, `label`, numeric `value` (A = 1 … K = 13). |
| `faces` | Pictures keyed by card id (`"hearts-K"`): `image`, `fit` (`scale`, `x`, `y`), `mirror`. |
| `back` | `kind` (`pattern` or `image`), `pattern`, `colors` [ground, ink], `image`, `border`. |
| `jokers` | `enabled` and `items[]` (`id`, `label`, `color`, `font`, `image`). |
| `fonts[]` | Where each font comes from: `google`, `system`, or `embedded` with `data`. |
| `cards[]` | **The flat card list most games want.** One entry per card, in suit then rank order, jokers last when enabled: `{ id, kind, suit, rank, value, label, color }`. |

Minimal consumer:

```js
const deck = JSON.parse(text)
if (deck.format !== 'playing-card-deck' || deck.version !== 1) throw new Error('Unsupported deck')
const drawPile = [...deck.cards]          // 52, or 52 + jokers
const art = (card) => deck.faces[card.id]?.image ?? null
```

The editor rebuilds `cards` on every export and ignores it on import, so it always matches the rest of the file.
