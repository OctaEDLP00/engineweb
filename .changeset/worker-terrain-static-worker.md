---
'@engineweb/worker-terrain': minor
---

Ship the chunk-generation worker as a real `dist/worker.js` module importable via `@engineweb/worker-terrain/worker` instead of an inline template string. `createTerrainWorker` loads it with `new URL('./worker.js', import.meta.url)` and bootstraps it with `{ type: 'init', source }`; the `{ id, options }` request protocol and transferable-buffer responses are unchanged.
