/**
 * Zero-copy utility wrapper for compiled WebAssembly physics engines (Rapier,
 * Box2D): `WebAssembly.Memory` views update transformation matrices in
 * WebGL/Three.js directly via pointers.
 *
 * @packageDocumentation
 */

export type * from './src/types/index.js'
export * from './src/WasmPhysicsBinding.js'
