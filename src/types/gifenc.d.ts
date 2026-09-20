declare module 'gifenc' {
  export function GIFEncoder(opt?: { initialCapacity?: number; auto?: boolean }): {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Uint8Array | number[][]
        delay?: number
        repeat?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
      },
    ) => void
    finish: () => void
    bytes: () => Uint8Array
  }
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
  ): Uint8Array
}
