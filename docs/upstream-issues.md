# Upstream issue triage

Where the 41 open issues on `exaskye/Ears` stand for this fork, and one thing worth knowing about
upstream before planning around any of them.

## Upstream has moved to 2.0, and its source is not public

Ears **2.0.1** and **2.0.2** were published to Modrinth on 13 and 14 August 2026. Neither the GitHub
repo nor the Gitea repo it mirrors contains that code — both still end at `87ba63b`, the commit this
fork is built on. Checked directly:

```
git ls-remote --heads https://git.sleeping.town/exa.mods/Ears
  71363535…  refs/heads/1.3
  87ba63ba…  refs/heads/trunk        # same commit as our fork point
```

The licence is MIT, which requires preserving the copyright notice but not publishing source, so
this is entirely upstream's prerogative. The consequence for us is practical: **fixes made in 2.0
cannot be merged**, because there is nothing to merge from. Anything on this list has to be fixed
here or not at all.

It also means this fork is currently the maintained *open* continuation of the 1.4.7 line.

## Fix here — real, and on a version we support

| Issue | What | Status |
|---|---|---|
| [#242](https://github.com/exaskye/Ears/issues/242) | Mekanism MekaSuit crash **and world corruption** | Needs in-game repro with Mekanism. Highest severity by a distance — a crash that corrupts a world is worth more than everything else here combined. |
| [#235](https://github.com/exaskye/Ears/issues/235) | Emissive and base textures visibly mix on 1.21.11 | **Diagnosed, not fixed.** See below. |
| [#210](https://github.com/exaskye/Ears/issues/210) | Armour trim renders the whole trim atlas instead of the chest model | Needs repro with a trimmed chestplate on 1.21.11/26.1. |
| [#141](https://github.com/exaskye/Ears/issues/141) | Chest feature does not render trims | Same area as #210; likely the same fix. |
| [#133](https://github.com/exaskye/Ears/issues/133) | Head emissive pixels not rendered | Reported on 1.20.1; needs confirming on a supported version. |

### #235 — emissive z-fighting

The cause is visible in `EarsLayerRenderer.addVertex` in all four ports: the emissive pass draws
**the same geometry, at the same coordinates**, as the base pass, differing only in light level
(`LightTexture.pack(15, 15)`) and normals. Two coplanar surfaces at identical depth z-fight, and the
result is exactly the mixing in the screenshots on the issue.

Upstream's 2.0.2 changelog is one line — "Fixed emissive z-fighting" — which agrees with that
diagnosis, though not with any particular fix.

The standard remedy is to lift the emissive copy along its face normal. **It was attempted here and
backed out**, for a reason worth recording: `addVertex(float x, float y, int z, …)` takes `z` as an
*int*, so a sub-unit lift along the normal truncates to zero — and for a front-facing quad the
normal is almost entirely Z, so the lift does nothing at all. Doing it properly means translating
the pose matrix in the quad's local space before the vertices are emitted, and getting the sign
right for back faces.

That is a small change, but it is a *rendering* change that cannot be checked without launching the
game, and shipping one of those unverified across four ports is not worth the risk. Anyone with ten
minutes and a running client can confirm or reject it:

1. `cd common && ./gradlew testSkins`, then load `tests/in-game/29-emissive.png`.
2. Look for the mixing at a shallow angle, which is where z-fighting shows first.
3. Apply the lift in the pose matrix and look again.

## Drop — they were for ports this fork no longer has

#232, #220, #216, #202, #191, #180, #178, #127, #104, #99, #87, #70, #51, #34, and #217 (a request
for a new BTA port) all concern Forge, Rift, StAPI or vanilla-agent ports that were removed.

## Defer — they need the skin format to grow

#245, #244, #241, #234, #230, #190, #140, #128, #126, #122, #103, #97, #84, #77, #61, #50.

Each would need new fields in the on-skin data. v1's version byte was designed for exactly that —
append data, leave what came before untouched — but doing it makes skins that upstream Ears reads
only partially, and this fork's whole basis is that the format stays interoperable. That is a
decision to take deliberately, not to drift into.

#56 (Wildfire's Female Gender Mod displacement) needs that mod to reproduce. #209 was filed against
upstream's unreleased 2.0, not this tree.
