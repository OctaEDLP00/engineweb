import { describe, expect, it } from 'vitest'
import isWebAssemblyBinary from './isWebAssemblyBinary.js'

function bytes(list: Array<number>): ArrayBuffer {
  return new Uint8Array(list).buffer as ArrayBuffer
}

describe('isWebAssemblyBinary', () => {
  it('accepts the magic prefix plus version word', () => {
    expect(isWebAssemblyBinary(bytes([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))).toBe(true)
  })

  it('rejects short and mistyped bodies', () => {
    expect(isWebAssemblyBinary(bytes([]))).toBe(false)
    expect(isWebAssemblyBinary(bytes([0x00, 0x61, 0x73]))).toBe(false)
    expect(isWebAssemblyBinary(bytes([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x00, 0x00]))).toBe(false)
  })
})
