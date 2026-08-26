# eBay Live Clean

A browser extension that rebuilds the [eBay Live](https://www.ebay.it/ebaylive/) desktop experience:

- **Full-height vertical video** (the stream is natively 720×1280, 9:16) sized
  exactly to its aspect ratio — no cropping, no letterboxing.
- **Chat + item/auction card in a right-hand column** filling the space the
  QR code used to waste (column width adjustable in the popup, default 360px).
- **Seller info column** (left) and **event listings** (below the player)
  stay exactly where eBay puts them; the page scrolls normally.
- **Hidden**: eBay header, event header, QR panel, global footer, marquee,
  legacy overlays/gradients.
- **Video controls stay on the video**: viewer count, item list, share, mute.
- Toggle ON/OFF from the popup; the toolbar icon shows an ON badge.

Works on any `ebay.it/ebaylive/…` live event page.

```
chrome/    Chrome MV3 build (also works on Edge, Brave, etc.)
firefox/   Firefox MV2 build (Firefox 121+)
```

## Install

### Chrome / Edge / Brave (from source)

1. Download and unpack the repo (or `git clone`)
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. **Load unpacked** → select the `chrome/` folder
5. Open a live event: <https://www.ebay.it/ebaylive/>

### Firefox (temporary add-on)

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `firefox/manifest.json`
3. Open a live event

> Temporary add-ons are removed when Firefox restarts. For a permanent
> install the extension must be signed on [addons.mozilla.org](https://addons.mozilla.org)
> (see [Releases](#releases) — the `.xpi` there is signed for self-distribution
> only if you build and submit it yourself).

### From Releases (easier)

Prebuilt packages are attached to each
[GitHub release](../../releases):

- `ebay-live-clean-chrome-<version>.zip` → unpack, then follow the
  "Load unpacked" steps above on the unpacked folder
- `ebay-live-clean-firefox-<version>.xpi` → drag & drop onto
  `about:debugging#/runtime/this-firefox` (temporary install)

## How it works

The live page is **three nested documents**:

| Document | Contents | CSS file |
|---|---|---|
| `ebay.it/ebaylive/events/*/stream` | headers, seller info, video slot, QR | `content/page.css` |
| `ebay.it/…/player.html` (same-origin iframe) | **chat + input + item card** | `content/player-frame.css` |
| `ir.ebaystatic.com/…/player.html` (iframe) | the `<video>` element only | `content/video-frame.css` |

The content script (`inject.js`, injected in every frame) only toggles an
`eblc-on` class on `<html>` and sets the `--eblc-sidebar` custom property.
**All layout is pure CSS** — no DOM nodes are moved, so eBay's re-renders
can't break it.

### Selectors

eBay's class names carry build-specific hashes that change on every deploy
(e.g. `_playerRow_ynlgm_298` → `_playerRow_1tko8_322`). The CSS therefore
targets only **stable class prefixes** (`[class*="_playerRow_"]`) and, where
needed, document structure (`:has()`). If eBay renames a class, you only fix
the prefix in the matching CSS file — no JS logic involved.

## Building the packages

```sh
./build.sh            # creates dist/ with the zip and the xpi
```

## License

MIT — see [LICENSE](LICENSE).
