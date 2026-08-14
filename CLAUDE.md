# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ears — a Minecraft player-model customization mod. This is **DaisyCatTs/Ears**, a fork of
`exaskye/Ears` (still wired up as the `upstream` remote) narrowed to current versions: **Fabric and
NeoForge on 1.21.11 and 26.1**. MIT licensed; upstream attribution stays.

Mod features are encoded as "magic pixels" in the player's skin PNG; common code parses them and
drives an abstract renderer that each port adapts to its Minecraft version's rendering API.

Upstream carries ~45 ports back to Forge 1.2. Those were removed here — `git show legacy-ports`
(a tag) is the restore point, and `git checkout legacy-ports -- platform-forge-1.12` brings one back.

## Repo layout

Each top-level directory is its **own independent Gradle build** (its own `settings.gradle` and
wrapper) — there is no root Gradle project. `gradlew`/`gradlew.bat`/`gradle-wrapper.jar` in each
subdirectory are **hard links** to the root copies (see `unify-wrappers.sh`); never replace them with
regular files, or Gradle will try to run in the root dir.

- `common/` — all real logic, split into many source sets (see below). Produces classifier jars that
  ports consume as **file dependencies** off `common/build/libs/`, so **common must be built first**.
- `platform-<loader>-<mcver>/` — one thin port per target (four of them). Contains the
  render-delegate impl, the mixins, and mod metadata. Also has its own `README.md` naming which
  common target it uses, and a `version-suffix.txt` for per-port version bumps.
- `publish-curseforge/`, `publish-modrinth/` — publishing-only builds; a `switch (target)` mapping
  each platform to game versions/loaders/stability.
- `web/` — the TypeScript side (see below).
- `manipulator/` — the **old** browser Manipulator (three.js r122 + TeaVM). Kept only as reference
  while `web/` is built: `ears-common.js` is a dangling symlink into a TeaVM build whose Gradle
  tasks were deleted upstream in `081aa8c`, so this cannot run. It is still the only implementation
  of a few things (the v0 write path, the compatibility-notice table, the preview geometry).

## Common source sets

`common/src/README.md` is the authoritative explanation; the short version:

| Source set | Included in | Notes |
|---|---|---|
| `api` | every port, published as `com.unascribed:ears-api` | ABI-stable; must not reference `common` and must not crash when Ears is absent |
| `main` | every port | parsers, writer, Alfalfa, renderer |
| `normal` | `ears-common` and up | published for third parties who want the parser without the renderer |
| `mixin` | every supported port | |
| `modern` | 1.13+ ports | currently empty, so it isn't in git |
| `oracle` | nothing — never shipped | generates `tests/fixtures/`; see below |

`common`'s `build` task produces `ears-api.jar`, `ears-common.jar`, `ears-common-modern.jar` and
`ears-common-mixin-modern.jar`. Every supported port inlines the last of those via
`implementation files('../common/build/libs/ears-common-mixin-modern.jar')`. Common compiles at
**release 8**.

## Architecture

- `EarsFeaturesParser` (+ `V0` pixelwise / `V1` binary) decodes the magic pixels at `(0,32)` of a
  64×64 skin into an `EarsFeatures`. `Alfalfa`/`AlfalfaData` is the extra data channel packed into
  the skin's alpha.
- `EarsRenderer.render(features, delegate)` is the single renderer for every port. All
  version-specific drawing lives behind `EarsRenderDelegate` (`common/src/main/.../render/`) — ports
  subclass `AbstractEarsRenderDelegate` / `Indirect…` / `Direct…` rather than reimplementing feature
  logic. **Feature/geometry changes belong in common, not in a port.**
- Ports hook skin-texture loading (`MixinSkinTextureDownloader`) so the loaded texture object
  implements `EarsFeaturesHolder`, then read features back out of it at render time via
  `EarsMod.getEarsFeatures`.
- Third-party integration: `EarsInhibitorRegistry` (force features not to render) and
  `EarsStateOverriderRegistry` (lie about armor/elytra/etc.), both in `api`.
- `EarsLog` is tag-based (`Common:Renderer`, `Platform:Inject`, …) and compiled out unless `DEBUG`.
- **All supported ports are on Mojang mappings.** Upstream spans Plasma, Yarn and MCP too, so those
  names still turn up in git history and in the odd comment.

## Building

**Supported matrix: Fabric and NeoForge on 1.21.11 and 26.1** (the 26.1 artifacts also declare
26.1.x and 26.2). Those four `platform-*` directories are all that remain.

One JDK is enough: anything Gradle 9.2 can run on, i.e. **17 through 25** — *not* 26, which Gradle
9.2 rejects ("Unsupported class file major version 70"). The 26.1 ports request a Java 25
**toolchain**, which Gradle downloads itself via the foojay resolver, so the old `JAVA*_HOME`
juggling is gone.

```bash
./build.sh                                # common + all four supported platforms → artifacts/
./build.sh fabric-1.21.11                 # one platform (still rebuilds common first)
```

`build.sh` needs bash; `chronic` (moreutils) is used to hide output when present but is optional.
**On Windows, use the per-module wrapper** — this is the path actually exercised on this machine:

```bash
cd common && ./gradlew build              # must come first; ports consume its jars by filename
cd ../platform-fabric-1.21.11 && ./gradlew build
```

Each directory is its own build, so `./gradlew` must be run from inside it. `common` and all four
supported ports build on JDK 21 on Windows.

There is no test suite; verification is building the affected port(s) and running them in-game
(`install-test.fish` copies `artifacts/*` into matching Prism instances).

What *is* pinned down is the skin data format:

```bash
cd common && ./gradlew fixtures    # regenerates tests/fixtures from the Java implementation
```

`common/src/oracle/` is a never-shipped source set that encodes ~53 configurations, decodes them
again with Java, and writes the result to `tests/fixtures/` (skin PNG, decoded features, alfalfa,
and the renderer's display list). Output is deterministic — regenerate and `git diff` should be
empty. **If you change anything in the parsers, writers, `Alfalfa`, or `EarsRenderer`, run this;
the diff is the blast radius.** See `tests/README.md`, which also records three known asymmetries
in the format that are documented rather than fixed.

## web/

A Bun workspace holding the TypeScript side:

| Package | What |
|---|---|
| `packages/ears-protocol` | the skin data format, DOM-free; checked against the fixtures both ways |
| `packages/ears-renderer` | a literal port of `EarsRenderer`; its display list is diffed against Java's quad-for-quad |
| `packages/ears-three` | display list → three.js meshes. **No golden data** — verified by looking at it |
| `apps/manipulator` | the editor (Vite + React, client-only) |

```bash
cd web && bun install
bun run dev           # editor at :5273
bun run test          # protocol (forward) + renderer display list
bun run test:reverse  # we encode, Java decodes (runs common's decodeTsFixtures task)
bun run test:e2e      # browser smoke test; needs `bun run dev` running
```

The reverse direction exists because an encoder verified only against its own decoder can be
self-consistently wrong. It compares Java's decode against Java's own expectations, never against
our decode of the same skin. `tests/fixtures-ts/` is generated and gitignored.

Java remains the authority on the format; the TypeScript is the port.

## CI

`.github/workflows/ci.yml` runs on push to `trunk` and on PRs: builds each port (matrix), checks
`tests/fixtures` still regenerates identically, typechecks and runs both directions of the golden
tests, builds the editor, and drives it in Chromium. `release.yml` builds the four jars on a `v*`
tag and attaches them to a GitHub release.

**Known gap**: `publish-curseforge` and `publish-modrinth` are still on Gradle 6.6.1 and cannot run
on a modern JDK, so CurseForge/Modrinth publishing is *not* automated — the release workflow stops
at GitHub. Modernizing them (cursegradle 1.4.0 is the likely blocker) is what unblocks that.

## Versioning and release

- `version.txt` at the root is the shared version; each port appends its `version-suffix.txt`.
  `change-version.sh` bumps the root version and clears all suffixes. Bump only a port's suffix when
  re-releasing that port alone.
- A `stampVersion` Gradle task in `common` and in each supported port rewrites the
  `/*VERSION*/"…"/*/VERSION*/` marker in `EarsVersion.java` / `EarsPlatformVersion.java` before
  compiling. Don't hand-edit those literals. It replaces `common/replace-version.sh`, which could
  not run on Windows (`CreateProcess error=193`); the script is still there for the legacy ports.
- `publish.sh <curse-token> <modrinth-token> <mcmodcn-cookie> [platforms…]` publishes from
  `artifacts/`; pass `-` to skip a destination. It refuses to run if `changelog.html` is empty.
  When adding a port, register it in **four** places: `build.sh`'s `platforms` list, `publish.sh`'s
  list + mcmod.cn case, `publish-curseforge/build.gradle`, and `publish-modrinth/build.gradle`.

## Adding a new version port

Copy the nearest existing port directory, then update `settings.gradle` (root project name),
`gradle.properties` (`minecraft_version`, loader versions, `archives_base_name`), mod metadata
(`fabric.mod.json` / `neoforge.mods.toml`), and the mixins for API changes. Re-run
`unify-wrappers.sh` so the new wrapper is hard-linked.

Between 1.21.11 and 26.1 only `EarsLayerRenderer`, `MixinSkinTextureDownloader` and the version
strings differ — 13 of 18 files are byte-identical — so start by diffing the two closest existing
ports to see what a version bump actually costs.
