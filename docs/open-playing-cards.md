# Open Playing Cards format, version 1

A single JSON file that holds a finished deck of playing cards: one PNG image per card, the card back, and the facts a game needs to play with them (suit, rank, numeric value). It says nothing about how the cards were designed, so games that read it keep working whatever happens to the tool that wrote it.

Card Atelier writes these files as `<deck-name>.cards.json` from **Export JSON → Open Playing Cards**. Any other tool is welcome to write them too.

The machine-readable definition is [`open-playing-cards.schema.json`](open-playing-cards.schema.json) (JSON Schema 2020-12). It is generated from [`src/model/open.ts`](../src/model/open.ts), so the two always agree.

## Example

```jsonc
{
  "format": "open-playing-cards",
  "version": 1,
  "name": "Classic Deck",
  "author": "",
  "description": "",
  "generator": { "name": "Card Atelier", "version": "0.1.0" },
  "createdAt": "2026-09-22T15:04:05.000Z",
  "card": { "widthMm": 63.5, "heightMm": 88.9, "cornerRadiusMm": 3.5, "imageWidth": 375, "imageHeight": 525, "dpi": 150 },
  "suits": [{ "id": "hearts", "name": "Hearts", "symbol": "♥", "color": "#c0162c" }],
  "ranks": [{ "id": "K", "label": "K", "value": 13 }],
  "back": { "image": "data:image/png;base64,…" },
  "cards": [
    { "id": "hearts-K", "kind": "standard", "suit": "hearts", "rank": "K", "value": 13,
      "label": "K♥", "name": "King of Hearts", "color": "#c0162c", "image": "data:image/png;base64,…" },
    { "id": "joker-1", "kind": "joker", "suit": null, "rank": null, "value": null,
      "label": "JOKER", "name": "Joker", "color": "#c0162c", "image": "data:image/png;base64,…" }
  ]
}
```

## Fields

| Field | Meaning |
| --- | --- |
| `format` | Always `"open-playing-cards"`. |
| `version` | Always `1` for this document. |
| `name`, `author`, `description` | Deck metadata. Strings, possibly empty. |
| `generator` | `name` and `version` of the program that wrote the file. Informational only; do not branch on it. |
| `createdAt` | ISO 8601 timestamp of the export. |
| `card.widthMm`, `card.heightMm`, `card.cornerRadiusMm` | Physical card size, for printing or for sizing cards on screen. |
| `card.imageWidth`, `card.imageHeight`, `card.dpi` | Pixel size of every image in the file, and the resolution it was rendered at. |
| `suits[]` | `id`, `name`, `symbol`, `color` for each suit, in deck order. |
| `ranks[]` | `id`, `label`, `value` for each rank, in ascending order. |
| `back.image` | The card back. |
| `cards[]` | Every card, in play order: suit by suit, ranks ascending, jokers last. |
| `cards[].id` | Stable id. Standard cards are `<suit id>-<rank id>`, e.g. `hearts-K`. |
| `cards[].kind` | `"standard"` or `"joker"`. |
| `cards[].suit`, `cards[].rank` | Ids from `suits[]` and `ranks[]`; `null` for jokers. |
| `cards[].value` | Numeric rank (A = 1 … K = 13 in a standard deck); `null` for jokers. |
| `cards[].label`, `cards[].name` | Short and long display names, e.g. `K♥` and `King of Hearts`. |
| `cards[].color` | The card's main ink colour. |
| `cards[].image` | The card face. |

Colours are lower-case `#rrggbb`, or `#rrggbbaa` when they carry transparency.

Images are PNG, base64-encoded as `data:image/png;base64,…` URIs. Every image is exactly `card.imageWidth × card.imageHeight` pixels. The area outside the rounded corners is transparent.

## Rules for readers

1. Check `format` and `version` before anything else. Reject a `version` you do not know; a future version may change meaning.
2. Ignore fields you do not recognise. Later minor additions will add fields rather than change existing ones, so older readers keep working.
3. Do not assume 52 cards, four suits or thirteen ranks. Read `cards[]`; use `suits[]` and `ranks[]` for ordering and grouping.
4. Treat `id` as the key for a card. Labels and names are for display.

## Minimal readers

JavaScript (browser or Node):

```js
const deck = JSON.parse(text)
if (deck.format !== 'open-playing-cards' || deck.version !== 1) throw new Error('Unsupported deck file')

const drawPile = [...deck.cards]
const img = new Image()
img.src = drawPile[0].image   // data URIs work directly as an image source
```

Python:

```python
import base64, json

with open("classic-deck.cards.json") as f:
    deck = json.load(f)
if deck["format"] != "open-playing-cards" or deck["version"] != 1:
    raise ValueError("Unsupported deck file")

for card in deck["cards"]:
    png = base64.b64decode(card["image"].split(",", 1)[1])
    with open(f"{card['id']}.png", "wb") as out:
        out.write(png)
```

Engines that load images from bytes (Godot's `Image.load_png_from_buffer`, Unity's `Texture2D.LoadImage`, pygame via `io.BytesIO`) take the decoded PNG the same way.
