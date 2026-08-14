<p align="center">
  <img src="https://unascribed.com/ears-banner.png?v=2" alt="Ears" width="512"/>
  <h3 align="center">Faithful fancy fashion features for fuzzy folk.</h3>
</p>

**This is a fork of [Ears](https://github.com/exaskye/Ears) by Exa Skye and contributors**, focused
on current Minecraft versions and a rebuilt skin manipulator. For the full version-spanning
original — Forge 1.2 through the latest snapshots — go upstream.

Ears is a player model customization mod. This fork supports **Fabric and NeoForge on 1.21.11 and
26.1** (the 26.1 build also covers 26.1.x and 26.2). The skin data format is unchanged, so skins
made for upstream Ears work here and vice versa.

Get it and/or learn more at [CurseForge](https://www.curseforge.com/minecraft/mc-mods/ears), [Modrinth](https://modrinth.com/mod/ears),
or [Glass Repo](https://glass-repo.net/repo/mod/ears).

Check out the [Manipulator](https://unascribed.com/ears)! (A rewrite lives in `web/`; the original
`manipulator/` cannot be built from source since TeaVM was removed upstream.)

**Mappings Notice**: the supported ports are all on Mojang mappings. Upstream spans Plasma, Yarn and
MCP as well, and references to those still appear in common code and in the git history.

## Building

One JDK in the 17–25 range; the 26.1 ports fetch their own Java 25 toolchain.

```bash
./build.sh                                # common + all four ports → artifacts/
cd common && ./gradlew build              # or per-module (required on Windows)
cd web && bun install && bun run test:all # the TypeScript protocol and its golden tests
```

## Using the API

![Current API version](https://img.shields.io/maven-metadata/v?color=%23FB0&label=current%20api%20version&metadataUrl=https%3A%2F%2Frepo.unascribed.com%2Fcom%2Funascribed%2Fears-api%2Fmaven-metadata.xml)

Ears provides an API (identical for all ports) that allows forcing Ears features to not render, or
to change whether or not Ears thinks the player is wearing some kinds of equipment or has elytra
equipped, what Ears features a player has set, etc.

You can add it to your mod like so (it's the same for Fabric or Forge):

```gradle
repositories {
	maven {
		url "https://repo.unascribed.com"
		content {
			includeGroup "com.unascribed"
		}
	}
}

dependencies {
	implementation "com.unascribed:ears-api:1.4.5"
}
```

You can see examples of usage of both current APIs in real code in [Fabrication](https://github.com/unascribed/Fabrication/blob/2.0/1.17/src/main/java/com/unascribed/fabrication/features/FeatureHideArmor.java#L62)
and [Yttr](https://github.com/unascribed/Yttr/blob/trunk/src/main/java/com/unascribed/yttr/compat/EarsCompat.java).
Fabrication uses a state overrider to add support for its /hidearmor system, and Yttr uses the
inhibitor system to force things not to render when the diving suit is worn.
