/**
 * WebAssembly binary prologue: `\0asm` magic plus the 4-byte version word.
 * Every valid module is at least these 8 bytes.
 */
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const
const WASM_MIN_BYTES = 8

/**
 * Whether raw bytes look like a WebAssembly module. Guards `compile`
 * against HTML error pages served with HTTP 200 by SPA servers and CDNs.
 *
 * @param bytes Fetched response body.
 * @returns `true` when the `\0asm` magic prefix is present.
 */
export default function isWebAssemblyBinary(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < WASM_MIN_BYTES) return false
  const head = new Uint8Array(bytes, 0, WASM_MAGIC.length)
  return WASM_MAGIC.every((byte, i) => head[i] === byte)
}
