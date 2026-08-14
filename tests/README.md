# Golden protocol fixtures

These pin down Ears' on-skin data format so it can be reimplemented (in TypeScript, for the new
manipulator) without drifting away from what Minecraft actually reads.

**The Java implementation in `common/` is the authority.** Every fixture here is produced by it and
then decoded again by it, so the files are a record of real behaviour rather than of intent.

## Regenerating

```bash
cd common && ./gradlew fixtures
```

The generator is `common/src/oracle/java/com/unascribed/ears/oracle/` — a source set that is never
shipped in any jar. Output is deterministic: regenerate and `git diff` should be empty. If it isn't,
something about the format changed, and the diff is the review.

## What's in each fixture

| File | Meaning |
|---|---|
| `skin.png` | the encoded 64×64 skin — the input a consumer actually gets |
| `config.json` | what was *asked for* (absent for `raw` fixtures, which are painted by hand) |
| `decoded.json` | what Java **read back** out of `skin.png` |
| `alfalfa.json` | alfalfa `read` straight from the alpha channel, and `afterDetect` — they differ when a 12×12 wing is upgraded in flight |
| `display-list.json` | every quad the renderer emits, captured through the same delegate shape the old TeaVM manipulator used |

**`decoded.json`, not `config.json`, is the contract.** Encoding is lossy, and the two differ
wherever that matters:

- `chest-half` — `chestSize` 0.5 in, **0.516129** out. `writeUnit` ceils, `readUnit` divides.
- `tail-star-overlap` — `STAR_OVERLAP` is ordinal 8 and v1's tail field is 3 bits, so it truncates
  to `NONE` and the segments and bends vanish with it. Only v0 can carry this mode; see
  `v0-tail-star-overlap`.
- `snout-zero-width` — width 0 means "no snout", and height/depth/offset are then never written.

## Formats

`format: "v1"` is the binary encoding; `"v0"` is the older pixelwise one; `"raw"` fixtures are
painted directly to cover malformed and edge inputs.

v0 matters more than its age suggests: **Ears has never had a v0 writer**, so every v0 skin in the
wild was written by the old manipulator's inline JavaScript. A decoder that only handles v1 will
fail on most real skins. The fixture-only v0 writer used here lives in
`common/src/oracle/java/com/unascribed/ears/common/OracleV0Writer.java`.

## Round-trip status

`index.json` records a `reencode` status per fixture: 47 are `stable`, 3 are `n/a` (nothing
decoded), and 3 are `known-unstable` — genuine asymmetries in the upstream format, each carrying a
`reencodeNote`:

- **`wings-without-texture`** — a wing mode with no `wing` entry in alfalfa is forced back to
  `NONE` after decoding, which leaves `animateWings` set on a features object whose `wingMode` is
  `NONE`. v1 only writes the animate bit when a wing mode is present, so that pair cannot be
  re-encoded.
- **`bad-v1-all-ones`** and **`bad-alfalfa-garbage`** — a junk ear value decodes to mode `NONE` with
  a non-`CENTER` anchor. `NONE` writes no anchor at all, so the anchor resets on re-encode.

These are documented, not fixed: changing them would change what existing skins mean.

## Using them from TypeScript

Both directions have to be checked, or the encoder and decoder can agree with each other and both be
wrong:

1. **Forward** — decode each `skin.png` and compare against `decoded.json` and `alfalfa.json`.
2. **Reverse** — encode from a config, write the PNG, and have **Java** decode it, comparing against
   the same expectations. An encoder verified only against its own decoder proves nothing.
