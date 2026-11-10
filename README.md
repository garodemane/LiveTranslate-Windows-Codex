# Live Translate for Windows

Real-time speech-to-speech translation for system audio and microphone, powered by the Gemini Live API (Electron).

## Features
- System audio (loopback) or microphone input
- Speech-to-speech translation, 17 target languages
- Live transcripts: original and translation
- Multiple API keys (one per line) with automatic failover
- Light / dark / system theme, font size, UI languages: Deutsch, English, فارسی (RTL)

## Run
```bash
npm install
npm start
```

## Build portable exe
```bash
npm run dist
```

## Notes
- The translation model is a preview model; availability and pricing may change.
- Keys from the same Google project share limits.
- Keys are stored locally (localStorage). Audio is sent to Google for processing.
- Control the original sound in the Windows volume mixer or the player.
