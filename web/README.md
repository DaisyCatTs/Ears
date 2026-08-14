# Ears web

The browser side of Ears: the skin data format in TypeScript, the renderer, and the manipulator
built on top of them.

```bash
bun install
bun run dev          # the editor, at http://localhost:5273
bun run test         # golden tests: protocol (forward) + renderer display list
bun run test:reverse # reverse golden tests (we encode, Java decodes) — needs a JDK
bun run test:e2e     # browser smoke test, needs `bun run dev` in another terminal
bun run typecheck
```

## A note on the stack

The brief asked for TanStack Start. This is Vite + React instead, deliberately: the editor is
entirely client-side — no server functions, no data loading, nothing to render on a server — and
SSR would only add a hydration boundary for code that needs `window`, `File` and WebGL on the first
paint. Start becomes worth it the day there are docs pages worth pre-rendering or a shared gallery;
moving then is a routing change, not a rewrite. TanStack Router isn't in here yet either, for the
same reason: there is one view.

shadcn/ui is likewise not installed. The editor needs five controls, all of them wanting the same
dense tool-like proportions, so `components/ui.tsx` defines them directly rather than pulling in a
component library and restyling it.

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

- **Real skins are not 8-bit RGBA.** In a sample of fifteen pulled from live accounts, eight were
  palette images, two were RGB with a tRNS colour key, and one was 4-bit indexed. `png.ts` handles
  every colour type and bit depth, and `tests/png-variants/` checks the output against an
  independent decoder rather than against itself.
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

## packages/ears-renderer

A literal port of `EarsRenderer` — same order, same magic numbers, same push/pop nesting. It walks
the features and emits quads through an `EarsRenderDelegate`; nothing in it knows about WebGL, so
the same code drives both the fixture comparison and (soon) the three.js preview.

`CaptureDelegate` collects the output into a flat display list with the same shape the Java oracle
captures, so **"does the preview match the game" is a numeric diff**: 1632 objects across 47
fixtures, compared quad by quad, move by move, UV by UV. Numbers are compared to four decimal
places, because Java does this arithmetic in 32-bit float and we do it in double — exact equality
would be testing IEEE rounding rather than geometry.

Feature geometry belongs in `common`, not here. If the two disagree, this one is wrong.

## packages/ears-three

Turns the display list into three.js meshes, plus the vanilla player model it hangs off. The
transform semantics (Z flip, negated Y translations, `(-x, y, -z)` rotation axes) come from the old
manipulator, because Minecraft's space is left-handed relative to three's.

**This layer has no golden data behind it.** The display list is verified; how it's turned into
meshes is checked by looking at it. If the preview looks wrong but `bun run test` passes, start here.

## apps/manipulator

The editor: config panel, 3D preview, inspector.

Two decisions worth knowing:

- **The preview renders what the parser sees, not what the UI thinks.** Every change is written into
  a skin and read straight back before rendering (`lib/derive.ts`). That costs about a millisecond
  and buys exactness — a wing mode with no texture disappears in the preview exactly as it will
  in-game, rather than showing something the game won't agree with.
- **Export refuses to hand over a skin that doesn't survive its own round trip.** `exportSkin`
  encodes, decodes, compares, and reports rather than downloading if they disagree.

### Deploying

```bash
bun run deploy:dry   # build + validate
bun run deploy       # build + publish to skin.daisy.cat
```

Static assets on Cloudflare Workers, with no Worker script — there is nothing to run on a server.
The page says skins stay in your browser, and that is literally true: no upload endpoint exists.

The username box is the one part that talks to anyone: it fetches from **crafthead.net**, which
serves skins with permissive CORS. Mojang's own API cannot be used — it sends no CORS headers, so a
browser cannot call it, and it answers **403 to datacenter traffic**, so proxying it through a
Worker of our own does not help either (tried, deployed, measured). That request carries a username
and nothing else, and never touches the skin you are editing.

One caveat to the privacy claim: Cloudflare injects its Web Analytics beacon
(`static.cloudflareinsights.com`) into the deployed page automatically. It does not see skins, but
it is a third-party script on a page that advertises privacy — turn it off in the Cloudflare
dashboard (Web Analytics / Browser Insights for the zone) if that bothers you.

Everything the old manipulator did is here: wing and cape upload with the legacy conversions, a
sample skin, load-by-username, the compatibility notices, and copy-to-clipboard. The old
`manipulator/` directory has been deleted; `git show legacy-ports:manipulator/index.html` has it if
a detail ever needs checking.

Deliberately not carried over: the `xyzzy` and `idkfa` console cheats that hid the chest and cape
sections. Both are just visible now.
