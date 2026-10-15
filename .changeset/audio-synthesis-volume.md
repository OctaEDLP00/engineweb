---
'@engineweb/audio-synthesis': minor
---

Add master volume control: `get masterVolume()` reports the current output level and `setMasterVolume(value)` sets it in `[0, 1]`, storing the value when called before `init()` so game settings can apply eagerly.
