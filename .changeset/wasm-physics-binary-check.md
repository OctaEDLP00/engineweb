---
'@engineweb/wasm-physics-binding': patch
---

Validate the `\0asm` magic bytes before compiling in `init()`: HTML error pages served with HTTP 200 by SPA servers and CDNs now fall back to the JS integrator with a descriptive reason instead of a cryptic compile failure.
