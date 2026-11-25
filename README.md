# SC Hauler Planner

Star Citizen hauler mission planner with OCR contract reading, route optimization, cargo grid visualization, and voice commands.

## Features

- Screenshot OCR for contracts: local PaddleOCR in the desktop app (Windows and Linux), Tesseract.js as fallback and in the browser. Nothing is sent online
- Edit SCU per stop on a mission if the OCR misreads a number
- Multi-stop mission support with running SCU tracking
- Genetic algorithm route optimizer (capacity, deadlines, current location)
- Cargo grid visualization with load order: one square per SCU of the selected ship,
  "Fit to window" (no scrolling, even for a 4,608 SCU Hull C) or "Actual size"
- Box-size breakdown per stop (32/16/8/4/2/1 SCU) from each mission's max container size
- External cargo deck (EXT) flags for stations a Hull C can load at
- Mission progress tracker
- Voice commands that send keys to the game
- Desktop app for Windows and Linux

## Desktop App

The desktop app reads contract screenshots with PaddleOCR (PP-OCRv4 models, run locally through `@gutenye/ocr-node` and ONNX Runtime). It runs in a separate process. If it is missing or fails, or its read is incomplete, the app falls back to Tesseract.js. Contracts with hidden lines (for example lens flare over an objective) are refused instead of added with wrong data. If a number is misread, click the mission in the Missions list and fix the SCU per stop, then Save.

Setup for both platforms: `npm install` (downloads about 80 MB of OCR runtime and models) and the Node.js version Next.js 15 requires.

### Windows

**Requirements**
- [Node.js](https://nodejs.org/) (for building)
- [AutoHotkey v2](https://www.autohotkey.com/) (for voice key sending)

**Build**
```powershell
git clone https://github.com/DrWhite1/sc-hauler-planner.git
cd sc-hauler-planner
npm install
npm run dist:win
```

The installer is created in the `dist` folder.

**Voice commands**
1. Install AutoHotkey v2
2. Launch the app
3. In the Voice panel, click **Load model** (first time, ~40 MB)
4. Click **Start**, then speak a command
5. The matched key is sent via AutoHotkey

Key combinations use `+` (example: `alt+n`).

### Linux

**Requirements**
- Node.js
- `xdotool` for voice key sending

**Install xdotool**
```bash
sudo apt install xdotool
```

**Build**
```bash
git clone https://github.com/DrWhite1/sc-hauler-planner.git
cd sc-hauler-planner
npm install
npm run dist:linux
```

The AppImage is created in the `dist` folder.

**Voice commands**
1. Make sure `xdotool` is installed
2. Launch the app
3. In the Voice panel, click **Load model**
4. Click **Start**, then speak a command

## Development

```bash
npm install
npm run dev
npm test   # parser, container split, locations and cargo grid tests (plain node >= 22.6)
```

In another terminal:
```bash
npm run electron:dev
```

Tests: `node --experimental-strip-types tests/parseContract.test.mjs` (and `tests/routeValidity.test.mjs`).

## Notes

- OCR: PaddleOCR (desktop app only) first, Tesseract.js fallback. The desktop packages are built with `asar` disabled on purpose, because the OCR runtime loads native libraries
- Linux packages include the CPU ONNX runtime only (no CUDA/TensorRT)
- `xdotool` only works on X11. Under Wayland, run the game and the app via XWayland or use an X11 session

- Voice recognition uses Vosk (offline, works on Windows and Linux)
- Windows key sending requires AutoHotkey v2
- Linux key sending requires xdotool
- The first voice use downloads a ~40 MB speech model
