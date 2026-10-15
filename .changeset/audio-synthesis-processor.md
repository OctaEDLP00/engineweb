---
'@engineweb/audio-synthesis': minor
---

Ship the `EngineWebNoiseProcessor` worklet as a real `dist/processor.js` module importable via `@engineweb/audio-synthesis/processor` instead of an inline template string. `init()` loads it with `new URL('./processor.js', import.meta.url)`; unresolvable modules fall back to buffer-based noise as before.
