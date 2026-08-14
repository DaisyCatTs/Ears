# Ears web

The browser side of Ears: the skin data format in TypeScript, and (later) the manipulator built on
top of it.

```bash
bun install
bun run test        # forward golden tests (Java encoded, we decode)
bun run test:reverse # reverse golden tests (we encode, Java decodes) — needs a JDK
bun run typecheck
```

## packages/ears-protocol

The Ears skin data format, and nothing else. No DOM, no React, no three.js — it runs in a worker, a
test, or on a server just as happily as in the editor.

| Module | What it is |
|---|---|
| `model.ts` | the feature types; enum arrays are **ordinal-ordered**, because v1 writes ordinals to the wire |
| `bits.ts` | MSB-first bit reader/writer, including the ceil-on-write / divide-on-read asymmetry |
| `alfalfa.ts` | the alpha-channel payload: regions, bignum packing, entry codec |
| `v1.ts` / `v0.ts` | the two on-skin encodings |
| `detect.ts` | dispatch plus the post-processing Ears does (wing gating, legacy wing upgrade, emissive extraction) |
| `encode.ts` | writing a skin, choosing v1 or v0 |
| `png.ts` | PNG in and out |

### Things worth knowing before changing any of it

- **Never decode a skin through a canvas.** Alfalfa lives in the alpha channel and some browsers
  premultiply alpha on a canvas round trip, which silently destroys it. That's why `png.ts` works on
  raw bytes.
- **Alfalfa's pixel walk is column-major within each rectangle**, and pixel 0 carries the *least*
  significant 7 bits of the payload. Because 7 doesn't divide 8, that is not a byte reversal — it
  needs a bignum, which is why `alfalfa.ts` uses `BigInt`.
- **Java does this arithmetic in 32-bit float**, so the ports use `Math.fround` at each step. Drop
  those and the tail bends drift in the sixth decimal.
- **`detect()` mutates the skin it is given** when emissive is in play, clearing the matched pixels
  so they aren't drawn twice — exactly as Java does. Clone first if you need the original.
- Encoding is **lossy by design**: chest size and tail bends quantize, and a `STAR_OVERLAP` tail
  cannot be expressed in v1 at all, so `write()` falls back to v0 for it.

Correctness here is defined by the Java implementation, not by this code. See `../tests/README.md`.
