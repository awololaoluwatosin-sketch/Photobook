# Photobook Studio

Desktop app for designing photo albums and photobooks: import photos, auto-design the whole album,
fine-tune every spread, and export print-ready JPG/PDF files.

## Run from source
```
npm install
npm start
```

## Build an installer
```
npm run dist:win     # Windows installer (.exe) + portable .zip   (run on Windows)
npm run dist:mac     # macOS .dmg                                  (run on a Mac)
npm run dist:linux   # Linux AppImage                              (run on Linux)
```
Output goes to the `dist/` folder.

## Features
- Import photos or whole folders (drag & drop supported); thumbnails/previews are cached; time taken read from EXIF
- Rate photos (1–5), flag as Main / Cover / Panoramic, filter and sort, see which are unused
- Auto design: groups photos by time into spreads, picks layouts that crop least, uses Main/Panoramic/Cover flags
- 12 spread layouts + 5 cover layouts, Smart "Shuffle" layouts, margin and gap control per spread
- Drag/drop photos onto frames, move/resize with snapping, crop (double-click), border, rounded corners, opacity, text, logos/PNGs
- Undo/redo (80 steps), autosave + recovery, project files (.pbook), photo relinking if files move
- Preview, slideshow and Client view (comments + approve per spread)
- Export JPG per spread (300/200/150 dpi, bleed option, dpi tagged) or one PDF

## Keyboard shortcuts
Press the `?` button in the app, or: Ctrl+N/O/S, Ctrl+Z/Y, Ctrl+E export, Ctrl+D duplicate, Delete,
arrows to nudge or change spread, Ctrl-drag one frame onto another to swap photos, F5 preview.

## Trial and licensing
The app is a trial until a license key is entered: everything works, but **Export** is locked.
See **SELLING.md** for payments, license keys and how to publish.
