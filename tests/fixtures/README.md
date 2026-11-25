# OCR fixtures

Raw OCR output of K's two in-game screenshots of the Pyro Carbon contracts (Red Wind Linehaul,
"Member Hauler Needed for Medium Shipment", reward 745,250; one delivery of Carbon to Ruin Station
above Pyro VI fed from three pickup points; "(8 SCU or smaller)" in the briefing):

- A: 129 SCU from Starlight Service Station, Gaslight and Orbituary.
- B: 252 SCU from Stanton Gateway, Megumi Refueling and Rod's Fuel 'N Supplies.

The screenshots are 3575×2069 PNGs (not committed, 6.5 MB each). Text was captured on 2026-11-25
with the app's own code paths:

- `*.paddle.json`: `electron/ocr.js` `readContract()` unchanged (@gutenye/ocr-node 1.4.9,
  PP-OCRv4 models from @gutenye/ocr-models 1.4.2, onnxruntime-node 1.31.1, sharp 0.34.5).
  `{ header, objectives, found }` exactly as the desktop app passes them to the parser.
- `*.tesseract.json`: the tesseract.js 5.1.1 path of `components/MissionOCR.tsx` `processImage()`,
  replayed in Node: `full` is the whole-image read, `region` the objectives column found from its
  words, `passes` the cropped re-reads in the app's order (scale/psm), up to where the app stops
  because two reads agree, and `header` the reward box read (psm 6, scale 3). The browser canvas
  filter `grayscale(1) contrast(1.3)` and upscaling were reproduced with sharp, so pixel-level
  details can differ slightly from Chromium.

Notable real-OCR quirks these fixtures cover: the briefing's "(8 SCU or" / "smaller)" wraps onto
two lines with the objectives column read in between ("(8 SCU or Collect Carbon from Gaslight.
smaller)"), "0/l29" and "Pyro Vl" (l for 1/I), and a pass that reads "0/129" as "0/7129".
