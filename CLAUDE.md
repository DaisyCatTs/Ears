# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ears — a Minecraft player-model customization mod, ported to ~45 platform/version combinations
(Forge 1.2 → NeoForge 26.x, Fabric 1.14 → 26.x, Rift, StAPI/vanilla Beta 1.7.3), plus a browser-based
skin editor (the Manipulator). GitHub is a **mirror** of the canonical Gitea repo at
`git.sleeping.town/unascribed/Ears`. MIT licensed.

Mod features are encoded as "magic pixels" in the player's skin PNG; common code parses them and
drives an abstract renderer that each port adapts to its Minecraft version's rendering API.

## Repo layout

Each top-level directory is its **own independent Gradle build** (its own `settings.gradle` and
wrapper) — there is no root Gradle project. `gradlew`/`gradlew.bat`/`gradle-wrapper.jar` in each
subdirectory are **hard links** to the root copies (see `unify-wrappers.sh`); never replace them with
regular files, or Gradle will try to run in the root dir.

- `common/` — all real logic, split into many source sets (see below). Produces classifier jars that
  ports consume as **file dependencies** off `common/build/libs/`, so **common must be built first**.
- `platform-<loader>-<mcver>/` — one thin port per target. Contains the render-delegate impl, the
  mixins or ASM transformers, and mod metadata. Also has its own `README.md` naming which common
  target it uses, and a `version-suffix.txt` for per-port version bumps.
- `publish-curseforge/`, `publish-modrinth/` — publishing-only builds; a big `switch (target)`
  mapping each platform to game versions/loaders/stability.
- `manipulator/` — the browser Manipulator (three.js). `ears-common.js` is a symlink into the common
  build. **Note:** TeaVM/JS compilation was torn out of `common/build.gradle` (commit `081aa8c`); the
  `closure` task its README references no longer exists, so the Manipulator build is currently
  non-functional in-tree.

## Common source sets

`common/src/README.md` is the authoritative explanation; the short version:

| Source set | Included in | Constraints |
|---|---|---|
| `api` | every port, published as `com.unascribed:ears-api` | ABI-stable; must not reference `common` and must not crash when Ears is absent |
| `main` | every port **including the browser** | must stay TeaVM-compatible (no `java.util.concurrent`, etc.) |
| `normal` | all non-JS ports | where TeaVM-incompatible code goes |
| `js` | JS ports only (Manipulator) | |
| `legacy` / `vlegacy` | pre-1.13 (LWJGL2) / pre-1.8 ports | `vlegacy` bundles MCAuthLib + Nanojson (shaded/relocated) |
| `modern` | 1.13+ non-JS ports | currently empty |
| `mixin` / `agent` | targets with SpongePowered Mixin / targets without it (ASM + the Mini patcher) | |
| `dummy` | compile-only facades (FML, LWJGL, EarsLog stub) | never shipped |

`common`'s `build` task produces one jar per combination (`ears-common-mixin-modern.jar`,
`ears-common-agent-legacy.jar`, `ears-common-mixin-vlegacy.jar`, …). A port's `build.gradle` picks
exactly one via `implementation files('../common/build/libs/ears-common-<target>.jar')` and inlines
it into the final jar. Common compiles at **source/target 1.6**.

## Architecture

- `EarsFeaturesParser` (+ `V0` pixelwise / `V1` binary) decodes the magic pixels at `(0,32)` of a
  64×64 skin into an `EarsFeatures`. `Alfalfa`/`AlfalfaData` is the extra data channel packed into
  the skin's alpha.
- `EarsRenderer.render(features, delegate)` is the single renderer for every port. All
  version-specific drawing lives behind `EarsRenderDelegate` (`common/src/main/.../render/`) — ports
  subclass `AbstractEarsRenderDelegate` / `Indirect…` / `Direct…` rather than reimplementing feature
  logic. **Feature/geometry changes belong in common, not in a port.**
- Ports hook skin-texture loading (mixin or ASM transformer) so the loaded texture object implements
  `EarsFeaturesHolder`, then read features back out of it at render time
  (`EarsMod.getEarsFeatures` in Fabric ports, `LayerEars`/`EarsLayerRenderer` elsewhere).
- Third-party integration: `EarsInhibitorRegistry` (force features not to render) and
  `EarsStateOverriderRegistry` (lie about armor/elytra/etc.), both in `api`.
- `EarsLog` is tag-based (`Common:Renderer`, `Platform:Inject`, …) and compiled out unless `DEBUG`.
- **Mappings vary by port** — Plasma, Yarn, MCP, Mojmap, sometimes referenced even from common code.
  Match whatever the port you're editing already uses.

## Building

**Supported matrix: Fabric and NeoForge on 1.21.11 and 26.1** (the 26.1 artifacts also declare
26.1.x and 26.2). The other `platform-*` directories are legacy — not built, not published.

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
(`install-test.fish` copies `artifacts/*` into Prism instances, handling coremod/agent layouts).

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

**Known gap**: `publish-curseforge` and `publish-modrinth` are still on Gradle 6.6.1 and cannot run
on a modern JDK. They need modernizing (cursegradle 1.4.0 is the likely blocker) before any release.

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
`gradle.properties` (`minecraft_version`, loader/mapping versions, `archives_base_name`), the common
target jar it depends on, mod metadata (`fabric.mod.json` / `mcmod.info` / `mods.toml`), and the
mixins/transformers for API changes. Re-run `unify-wrappers.sh` so the new wrapper is hard-linked.
