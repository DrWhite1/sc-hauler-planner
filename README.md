# SC Hauler Planner

Star Citizen hauler mission planner with OCR contract reading, route optimization, cargo grid visualization, and voice commands.

## Features

- Screenshot OCR for contracts (Tesseract.js)
- Multi-stop mission support with running SCU tracking
- Genetic algorithm route optimizer (capacity, deadlines, current location)
- Cargo grid visualization with load order
- Mission progress tracker
- Voice commands that send keys to the game
- Desktop app for Windows and Linux

## Desktop App

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
```

In another terminal:
```bash
npm run electron:dev
```

## Notes

- Voice recognition uses Vosk (offline, works on Windows and Linux)
- Windows key sending requires AutoHotkey v2
- Linux key sending requires xdotool
- The first voice use downloads a ~40 MB speech model
