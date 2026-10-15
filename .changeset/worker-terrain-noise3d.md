---
'@engineweb/worker-terrain': minor
---

Add 3D noise primitives: the `Noise3D` type, `createPerlin3D` and `fbm3D`. The 3D field shares the seed-shuffled permutation table with the 2D field, so one seed drives heightmaps and voxel density together. Existing 2D `fbm` output is bit-identical.
