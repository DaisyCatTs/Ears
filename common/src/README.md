# Source folders

Ears Common is split into a few pieces, because not every consumer wants the same subset. In order
of scope:

### api
Published, API/ABI-stable classes exposed in the Maven artifact (`com.unascribed:ears-api`). Other
mods are expected to use these, so care must be taken that nothing here references common, and that
nothing crashes when Ears is absent (as it will be in a dev env).

Every port includes api.

### main
Included in every port. Almost all of the meaningful code lives here: the feature parsers and
writer, Alfalfa, and the renderer.

### normal
Everything that isn't the API and isn't shared with a hypothetical non-JVM target. Historically
this held anything TeaVM couldn't compile; the split is kept because `ears-common` is published for
third parties (Visage and friends) who want the parser without the rendering abstraction.

### mixin
For ports whose target has SpongePowered Mixin — which is every supported port.

### modern
Empty at the moment, so it doesn't show up in git. For code used only by "modern" (1.13+, LWJGL3)
ports.

### oracle
Not shipped, and not part of any jar. Generates the golden fixtures in `tests/fixtures/` that pin
down the on-skin data format, and decodes the TypeScript implementation's output to check the two
agree. See `tests/README.md`.

# Putting it all together

These combine into the jars a port or a third party consumes:

* **ears-api** — just `api` (published to Maven)
* **ears-common** — `api`, `main`, `normal` (e.g. Visage)
* **ears-common-modern** — `api`, `main`, `normal`, `modern`
* **ears-common-mixin-modern** — `api`, `main`, `normal`, `mixin`, `modern` — what every supported
  port actually inlines

> Older versions of Ears also had `legacy`, `vlegacy`, `agent`, `dummy` and `js` source folders,
> feeding an `agent-*` (ASM/Mini patcher, for targets without Mixin), `mixin-vlegacy` and TeaVM
> browser build. They went away with the pre-1.21 ports; `git show legacy-ports` has them.
