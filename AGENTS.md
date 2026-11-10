# AGENTS.md

## Project
Live Translate for Windows: an Electron app that captures system audio (WASAPI loopback) or microphone audio, streams it to the Gemini Live API over WebSocket, plays the translated speech, and shows live transcripts.

## Commands
- Install: `npm install`
- Run: `npm start`
- Build portable exe: `npm run dist`

## Structure
- `main.js`: Electron main process. Grants media permissions and answers `getDisplayMedia` with `audio: 'loopback'`.
- `index.html`, `style.css`: UI, light/dark/system themes, RTL support for Persian.
- `renderer.js`: WebSocket client, audio pipeline, i18n (de/en/fa), multi-key failover, settings in localStorage.
- `pcm-worklet.js`: AudioWorklet that emits 16 kHz mono PCM16 chunks of 1600 samples (100 ms).
- `build/`: icons.

## Protocol notes (Gemini Live API, raw WebSocket)
- Endpoint: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=API_KEY`
- Model: `models/gemini-3.5-live-translate-preview` (preview; may change).
- First message is `setup`. `translationConfig` and `responseModalities` live in `generationConfig`. `inputAudioTranscription` and `outputAudioTranscription` live directly in `setup`, not in `generationConfig`.
- Send audio only after `setupComplete`: `{"realtimeInput":{"audio":{"data":"<base64>","mimeType":"audio/pcm;rate=16000"}}}`.
- Server audio is PCM16 mono at 24 kHz in `serverContent.modelTurn.parts[].inlineData.data`.
- Transcripts arrive in `serverContent.inputTranscription.text` and `serverContent.outputTranscription.text`, in partial chunks.

## Behaviors to preserve
- Key failover: on a failed connection the key is skipped for 5 minutes; a connection that ran longer than 30 s reconnects with the same key.
- Original sound is not controlled by the app; users use the Windows volume mixer.
- Do not log or commit API keys.
- CSP in `index.html` only allows `wss://generativelanguage.googleapis.com`; update it if the endpoint changes.

## Ideas
- Save transcripts as `.srt` or text.
- Group transcript chunks per turn using `turnComplete`.
- Detect quota errors separately from network errors.
- Move keys to Electron `safeStorage`.
