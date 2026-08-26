# eBay Live Clean

Estensione che ridisegna [eBay Live](https://www.ebay.it/ebaylive/) su desktop:

- **Video a piena altezza** (100vh), larghezza proporzionale al 9:16 nativo
  dello stream (720×1280) → zero crop, zero letterbox.
- **Chat + card oggetto/aste in una colonna laterale destra**
  (larghezza regolabile dal popup, default 360px): occupano lo spazio
  che nell'originale aveva il QR code.
- **Nascosti**: header eBay, header evento, QR code, footer, marquee.
- **Info del negozio** (colonna sinistra) e **sezioni eventi** (sotto il
  player) restano al loro posto: la pagina scorre normalmente.
- Toggle ON/OFF istantaneo dal popup (badge ON sull'icona).

```
chrome/    versione Chrome MV3 (sviluppo attivo)
firefox/   versione Firefox MV2 (min FF 121+, richiesto :has())
```

## Installazione (Chrome / Brave / Edge)

1. Apri `chrome://extensions`
2. Attiva **Modalità sviluppatore** (in alto a destra)
3. **Carica estensione non pacchettizzata** → seleziona la cartella `chrome/`
4. Apri una live: <https://www.ebay.it/ebaylive/>

## Installazione (Firefox)

1. Apri `about:debugging#/runtime/this-firefox`
2. **Carica componente aggiuntivo temporaneo…** → seleziona
   `firefox/manifest.json`
3. Apri una live

Nota: l'installazione temporanea svanisce al riavvio di Firefox;
durante lo sviluppo premi **Ricarica** nella stessa pagina
`about:debugging` dopo ogni modifica ai file. Per avere l'estensione
fissa serve firmarla su AMO o usare Firefox Developer Edition /
Nightly con `xpinstall.signatures.required = false`.

## Come funziona

Lo stream non è una pagina sola: è **tre documenti** innestati.

| Documento | Ruolo | File CSS |
|---|---|---|
| `ebay.it/ebaylive/events/*/stream` | header, info venditore, slot video, QR | `content/page.css` |
| `ebay.it/.../player.html` (iframe same-origin) | **chat + input + card oggetto** (footer) | `content/player-frame.css` |
| `ir.ebaystatic.com/.../player.html` (iframe) | solo il `<video>` | `content/video-frame.css` |

Il content script `inject.js` (iniettato in tutti i frame) si limita a
aggiungere la classe `eblc-on` su `<html>` e a impostare `--eblc-sidebar`;
**tutto il layout è CSS puro**. Nessun nodo DOM viene spostato, quindi i
re-render di eBay non rompono niente.

### Selettori

Le classi di eBay hanno suffissi hash che cambiano a ogni loro deploy
(es. `_playerRow_ynlgm_298` → `_playerRow_1tko8_322`). Per questo il CSS
usa solo **prefissi stabili** (`[class*="_playerRow_"]`) e, dove serve,
la struttura (`[class*="_playerFooter_"] > div:has(> section[class^="chat-"])`).
Se un giorno eBay rinomina una classe, basta aggiornare il prefisso nel CSS
corrispondente — nessuna logica JS da toccare.

## Porting Firefox

Il codice content-script è già cross-browser (`browser`/`chrome`, callback
+ promise). Per il porting a Firefox (MV2 o MV3) servono solo ritocchi al manifest:

- `manifest_version: 2` → `browser_action` invece di `action`,
  `browser_specific_settings.gecko.id`, e `background.scripts` invece di
  `service_worker` (oppure MV3 con min FF 109+, che accetta `action`).
- Attenzione a `:has()`: richiede Firefox **121+**.
- I CSS e `inject.js` non cambiano.

## Struttura

```
chrome/
  manifest.json            MV3, due content_scripts (ebay.it + ebaystatic.com)
  background.js            service worker: solo badge ON/OFF
  content/inject.js        stato (classe eblc-on + variabile --eblc-sidebar)
  content/page.css         pagina esterna
  content/player-frame.css iframe player (sidebar chat+oggetti)
  content/video-frame.css  iframe video (contain)
  popup/                   toggle + slider larghezza colonna
firefox/                   versione MV2 per Firefox (min 121, temporanea via about:debugging)
```
