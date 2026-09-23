# Open Playing Cards format, version 1

A deck of playing cards as data a game can use directly: one PNG image per card, the card back, and the facts needed to play with them (suit, rank, numeric value). It says nothing about how the cards were designed, so games that read it keep working whatever happens to the tool that wrote it.

Card Atelier writes these files from **Export → Open Playing Cards**, either as a single `<deck-name>.cards.json` with the pictures embedded, or as a `.zip` holding the same document plus the pictures as files. Each card can carry a rendered PNG, a vector SVG, or both. Any other tool is welcome to write them too.

The machine-readable definition is [`open-playing-cards.schema.json`](open-playing-cards.schema.json) (JSON Schema 2020-12). It is generated from [`src/model/open.ts`](../src/model/open.ts), so the two always agree.

## Example

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/bferg314/card-atelier/main/docs/open-playing-cards.schema.json",
  "format": "open-playing-cards",
  "version": 1,
  "deckId": "k3p2q8x1",
  "contentHash": "9f2c…",
  "deckType": "french-52",
  "name": "Classic Deck",
  "license": "CC-BY-4.0",
  "generator": { "name": "Card Atelier", "version": "0.1.0" },
  "createdAt": "2026-09-22T15:04:05.000Z",
  "card": { "widthMm": 63.5, "heightMm": 88.9, "cornerRadiusMm": 3.5, "imageWidth": 375, "imageHeight": 525, "dpi": 150 },
  "suits": [{ "id": "hearts", "name": "Hearts", "symbol": "♥", "color": "#c0162c", "order": 1 }],
  "ranks": [{ "id": "K", "label": "K", "value": 13 }],
  "back": { "image": "data:image/png;base64,…" },
  "cards": [
    { "id": "hearts-K", "kind": "standard", "order": 25, "suit": "hearts", "rank": "K", "value": 13,
      "label": "K♥", "name": "King of Hearts", "color": "#c0162c", "image": "data:image/png;base64,…" },
    { "id": "joker-1", "kind": "joker", "order": 52, "suit": null, "rank": null, "value": null,
      "label": "JOKER", "name": "Joker 1", "color": "#c0162c", "image": "data:image/png;base64,…" }
  ]
}
```

## Fields

| Field | Meaning |
| --- | --- |
| `format` | Always `"open-playing-cards"`. |
| `version` | Always `1` for this document. |
| `$schema` | Optional. Where to find the schema that validates the file. |
| `deckId` | A deck's stable id. The same deck exported again, edited or not, keeps this id. |
| `contentHash` | Optional. SHA-256 of the deck's content, computed as [described below](#contenthash). Two files with the same hash hold the same deck, whatever form they were written in. |
| `deckType` | Optional. `"french-52"` means the deck is exactly a standard pack under the ids below, so a game needing one can rely on it. Absent means anything else. |
| `name`, `author`, `description` | Deck metadata. `author` and `description` are omitted when unknown. |
| `license` | Optional. How the deck may be used, ideally an [SPDX id](https://spdx.org/licenses/) such as `CC-BY-4.0`. Absent means unstated, which is not permission. See [what a licence covers](#what-a-licence-covers). |
| `source` | Optional. Where the deck came from, for attribution. |
| `generator` | `name` and `version` of the program that wrote the file. Informational only; do not branch on it. |
| `createdAt` | ISO 8601 timestamp of the export. |
| `card.widthMm`, `card.heightMm`, `card.cornerRadiusMm` | Physical size of the finished (trimmed) card. |
| `card.bleedMm` | Optional. Extra image beyond the trim size on every side, for printing. Absent or `0` means the images are trimmed to size. |
| `card.imageWidth`, `card.imageHeight`, `card.dpi` | Pixel size of every PNG, bleed included, and the resolution they were rendered at. Absent when the deck ships vector cards only. |
| `suits[]` | `id`, `name`, `symbol`, `color` and `order` for each suit. |
| `ranks[]` | `id`, `label`, `value` and `indexHeightMm` for each rank, in ascending order. |
| `ranks[].indexHeightMm` | How tall this rank's corner index is drawn, in millimetres. Against `card.heightMm` it tells you whether the index survives the size you draw at. |
| `back.image` | The card back. |
| `back.vector` | Optional. The card back as vector art. |
| `cards[]` | Every card, in play order: suit by suit, ranks ascending, jokers last. |
| `cards[].id` | Stable id. Standard cards are `<suit id>-<rank id>`, e.g. `hearts-K`. |
| `cards[].kind` | `"standard"` or `"joker"`. |
| `cards[].order` | The card's position in play order, so a shuffled or filtered set can be sorted back. |
| `cards[].suit`, `cards[].rank` | Ids from `suits[]` and `ranks[]`; `null` for jokers. |
| `cards[].value` | Default ordinal for the rank; `null` for jokers. See the note below. |
| `cards[].label`, `cards[].name` | Short and long display names, e.g. `K♥` and `King of Hearts`. Repeated names, such as two jokers, are numbered. |
| `cards[].color` | The card's main ink colour. |
| `cards[].image` | The card face as a PNG. Optional: a deck may ship vector cards only. |
| `cards[].vector` | Optional. The same face as an SVG, sharp at any size. |

Colours are lower-case `#rrggbb`, or `#rrggbbaa` when they carry transparency.

Pictures come in two forms, and a card carries at least one of them. `image` is a PNG, `vector` is an SVG. In a single-file deck each is a `data:` URI; in a zipped deck each is a path relative to the JSON, such as `cards/hearts-K.png` or `cards/hearts-K.svg`.

A path must stay inside the deck: no leading `/`, and no `..` segment. A reader unpacking a zip should refuse anything else rather than follow it out of the folder it chose. Card Atelier writes PNG data URIs as base64 and SVG data URIs as base64; a reader should accept percent-encoded SVG URIs too, since other writers use them.

Every PNG is exactly `card.imageWidth × card.imageHeight`. Without bleed, the area outside the rounded corners is transparent; with bleed, PNGs are square and fully opaque.

### The standard French pack

When `deckType` is `"french-52"`, these ids are guaranteed, and a reader can map from id to meaning without inspecting anything else:

- Suits: `spades`, `hearts`, `diamonds`, `clubs`, in that order.
- Ranks: `A`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `J`, `Q`, `K`, in that order.
- 52 cards, plus any number of jokers with `kind: "joker"`.

A game that needs a French deck should check `deckType` and refuse the file cleanly if it is absent, rather than guessing from suit names.

### `value` is a default, not a rule

`value` numbers the ranks in their conventional order, Ace low at 1 through King at 13. It is a convenience for sorting, not a statement about any game. A game where Aces are high, or where a Queen outranks a King, maps from `rank` id to its own values and ignores `value`.

### Vector cards

A `vector` is a complete SVG of the card. Its text is already outlined, so it needs no fonts and draws the same in a browser, in Inkscape and at a print shop. It carries `width` and `height` in millimetres alongside a `viewBox`, so it opens at true size in a design tool and scales to any box on screen. With bleed, the `viewBox` starts at negative coordinates and the millimetre size includes the bleed.

A vector card is self-contained, and a reader may rely on that. It **must** carry no scripts, no event handlers, no references to anything outside the file (no `<use href>` to another document, no external images, no `@import`, no web fonts) and no live text needing a font it does not carry. A reader is still entitled to sanitise what it is given; these rules mean a well-formed deck survives sanitising unchanged.

Artwork the designer uploaded stays as it was: a photograph or a painted court card is still a raster picture embedded in the SVG, while uploaded SVG art stays vector. Tracing a photograph into paths would make the file larger and the picture worse.

Prefer `vector` when a card is drawn small or at unpredictable sizes, and fall back to `image` when it is absent. One caution: vector makes a small card **sharp**, not **legible**. A corner index is about 6% of the card's height, so on a 30 px card it is 2 px tall whether it came from an SVG or a PNG. A deck meant to be played small should be designed with oversized indices; Card Atelier has a preset for it under Artwork → Lettering.

### What a licence covers

`license` states what the deck's author allows for the deck as published. It cannot grant rights the author never held: artwork, photographs or generated images brought into a deck keep whatever terms they came with, and a permissive `license` does not override them. A reader relying on a deck for anything that matters should know where it came from, which is what `source` is for.

Fonts are a narrower question, and they do not arise here. These files hold rendered images, so a picture set in an OFL font carries no font obligations, and there is no font file to pass on. Only the editor's own project file (`.deck.json` in Card Atelier) embeds uploaded font files, and sharing one of those redistributes the font, which the font's own licence governs.

### contentHash

A writer computes it, and any reader can check it:

1. Take the file's JSON.
2. Remove `$schema`, `contentHash`, `createdAt` and `generator`.
3. Replace every picture reference (`back.image`, `back.vector`, `cards[].image`, `cards[].vector`) with the lower-case hex SHA-256 of the bytes that picture is made of: decode the `data:` URI, or read the file the path points at.
4. Serialise as JSON with every object's keys sorted by code point, arrays in their existing order, no insignificant whitespace, UTF-8.
5. `contentHash` is the lower-case hex SHA-256 of that text.

Hashing the picture bytes rather than the references is what lets the single-file and zipped forms of one deck agree, and sorting the keys is what lets a different program reproduce the value.

## Rules for readers

1. Check `format` and `version` before anything else. Reject a `version` you do not know; a future version may change meaning.
2. Ignore fields you do not recognise. Later additions add fields rather than change existing ones, so older readers keep working.
3. Do not assume 52 cards, four suits or thirteen ranks unless `deckType` says so. Read `cards[]`; use `suits[]` and `ranks[]` for ordering and grouping.
4. Treat `id` as the key for a card. Labels and names are for display.
5. Accept both packagings: a picture may be a `data:` URI or a relative path.
6. Take whichever picture you can use: `vector` when you want it and it is there, `image` otherwise. A card always has at least one.
7. Refuse a picture path with a leading `/` or a `..` segment, and refuse a vector that breaks the self-containment rules above.

## Using the images

**Decode once.** A 54-card deck is several megabytes of base64. Turn each `image` into a blob or an object URL (or a texture) once at load, and keep that. Holding the data URI strings in UI state, or passing them as component props, costs memory and re-renders for nothing.

**Small sizes.** The images are drawn in print proportions, so a corner index is around 6% of the card's height. Painted at 300 px that is legible; at 30 px it is two pixels of ink. If your game draws cards smaller than roughly 60 px wide, draw your own rank and suit badge over the image rather than relying on the printed index. Decks meant for screen play can also be exported with oversized indices: in Card Atelier, Artwork → Lettering → **Oversize for digital play**.

**Printing.** Export with bleed, place the images on your sheet at `widthMm + 2 × bleedMm`, and trim at the card size.

## Minimal readers

JavaScript (browser or Node):

```js
const deck = JSON.parse(text)
if (deck.format !== 'open-playing-cards' || deck.version !== 1) throw new Error('Unsupported deck file')
if (deck.deckType !== 'french-52') throw new Error('This game needs a standard 52-card deck')

const textures = new Map(deck.cards.map((c) => [c.id, c.image]))  // decode once, reuse everywhere
const drawPile = [...deck.cards]
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

Engines that load images from bytes (Godot's `Image.load_png_from_buffer`, Unity's `Texture2D.LoadImage`, pygame via `io.BytesIO`) take the decoded PNG the same way. For those, prefer the zipped export and load the PNG files directly.

## Changes

Version 1 gained these optional fields after the first game integration. Readers written against the original v1 are unaffected, since every addition is optional and rule 2 tells readers to ignore what they do not know.

- `$schema`, `deckId`, `contentHash`, `deckType`, `license`, `source`
- `cards[].order`, `suits[].order`, `card.bleedMm`
- `cards[].vector` and `back.vector`, for vector cards
- `ranks[].indexHeightMm`, so a game can judge legibility at the size it draws
- `card.imageWidth`, `card.imageHeight` and `card.dpi` are optional, since a vector-only deck has no pixels to describe
- `contentHash` is now defined canonically, over sorted keys and picture bytes, so the single-file and zipped forms of a deck agree. Hashes written before this change do not match the new algorithm.
- `image` may now be a relative path, for zipped decks
- `author` and `description` are omitted when empty rather than written as `""`

One change is not merely additive: `image` is now optional, because a deck may ship vector cards only. Such a file needs a reader that understands `vector`; a deck exported with both pictures, which is the default, stays readable by anything written against the original v1.
