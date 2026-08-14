package com.unascribed.ears.oracle;

import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import com.unascribed.ears.api.Slice;
import com.unascribed.ears.api.features.AlfalfaData;
import com.unascribed.ears.api.features.EarsFeatures;
import com.unascribed.ears.api.features.EarsFeatures.EarAnchor;
import com.unascribed.ears.api.features.EarsFeatures.EarMode;
import com.unascribed.ears.api.features.EarsFeatures.TailMode;
import com.unascribed.ears.api.features.EarsFeatures.WingMode;
import com.unascribed.ears.common.Alfalfa;
import com.unascribed.ears.common.EarsCommon;
import com.unascribed.ears.common.EarsFeaturesParser;
import com.unascribed.ears.common.EarsFeaturesWriterV1;
import com.unascribed.ears.common.OracleV0Writer;
import com.unascribed.ears.common.RawEarsImage;
import com.unascribed.ears.common.WritableEarsImage;

/**
 * Generates the golden fixtures that pin down Ears' on-skin data format.
 * <p>
 * The Java implementation is the authority: whatever it writes and reads back is, by definition,
 * what Minecraft understands. Every fixture is produced here and then <i>decoded again by Java</i>,
 * so {@code decoded.json} — not {@code config.json} — is the contract the TypeScript decoder must
 * reproduce. The two differ wherever encoding is lossy (unit quantization, v1's 3-bit tail field,
 * a zero-width snout dropping its other dimensions), which is exactly what makes them worth
 * checking in.
 * <p>
 * Run with {@code ./gradlew fixtures} from {@code common/}.
 */
public class Fixtures {

	private static final Charset UTF8 = Charset.forName("UTF-8");

	/** Base skin colours reused as the emissive palette. */
	private static final int EMISSIVE_A = 0xFFEE2200;
	private static final int EMISSIVE_B = 0xFF22EEFF;

	interface Painter {
		void paint(WritableEarsImage img);
	}

	static class Fixture {
		final String name;
		final String format;
		EarsFeatures.Builder config;
		AlfalfaData alfalfa = AlfalfaData.NONE;
		Painter painter;
		boolean emissivePalette;
		int height = 64;
		/** Set when this fixture is known not to survive a re-encode, and why. */
		String unstableReason;

		Fixture(String name, String format) {
			this.name = name;
			this.format = format;
		}

		Fixture unstable(String reason) {
			this.unstableReason = reason;
			return this;
		}
	}

	public static void main(String[] args) throws Exception {
		if (args.length < 1) {
			System.err.println("usage: Fixtures <output-dir>");
			System.exit(2);
		}
		File outDir = new File(args[0]);
		if (!outDir.exists() && !outDir.mkdirs()) {
			throw new IOException("Could not create "+outDir);
		}

		List<Fixture> fixtures = define();
		List<Object> index = new ArrayList<Object>();
		for (Fixture f : fixtures) {
			index.add(generate(f, new File(outDir, f.name)));
		}
		Map<String, Object> manifest = new LinkedHashMap<String, Object>();
		manifest.put("generator", "ears-oracle");
		manifest.put("earsVersion", com.unascribed.ears.common.EarsVersion.COMMON);
		manifest.put("fixtures", index);
		Files.write(new File(outDir, "index.json").toPath(), Json.write(manifest).getBytes(UTF8));

		System.out.println("Wrote "+fixtures.size()+" fixtures to "+outDir);
	}

	private static Map<String, Object> generate(Fixture f, File dir) throws IOException {
		if (!dir.exists() && !dir.mkdirs()) {
			throw new IOException("Could not create "+dir);
		}

		WritableEarsImage img = f.height == 64 ? Skins.baseSkin() : shortSkin();
		if (f.emissivePalette) {
			paintEmissive(img);
		}

		EarsFeatures config = null;
		if (f.painter != null) {
			f.painter.paint(img);
		} else {
			config = f.config.emissiveSkin(Slice.EMPTY).emissiveWing(Slice.EMPTY).alfalfa(f.alfalfa).build();
			if ("v0".equals(f.format)) {
				OracleV0Writer.write(config, img);
				Alfalfa.write(f.alfalfa, img);
			} else {
				// this also writes the alfalfa, from config.alfalfa
				EarsFeaturesWriterV1.write(config, img);
			}
		}

		byte[] png = Skins.encode(img);
		Files.write(new File(dir, "skin.png").toPath(), png);

		// decode from the PNG rather than the in-memory image, so the fixture proves the whole
		// round trip a consumer actually performs
		WritableEarsImage readBack = Skins.decode(png);
		AlfalfaData alfalfa = Alfalfa.read(readBack);
		EarsFeatures decoded = EarsFeaturesParser.detect(readBack, alfalfa, Skins.LOADER);

		if (config != null) {
			Files.write(new File(dir, "config.json").toPath(), Json.write(features(config)).getBytes(UTF8));
		}
		Files.write(new File(dir, "decoded.json").toPath(), Json.write(features(decoded)).getBytes(UTF8));

		// "read" is what came straight out of the alpha channel; "afterDetect" is what the parser
		// hands the renderer. They differ when a 12x12 wing gets upgraded to 20x16 in flight.
		Map<String, Object> alfalfaBoth = new LinkedHashMap<String, Object>();
		alfalfaBoth.put("read", alfalfa(alfalfa));
		alfalfaBoth.put("afterDetect", alfalfa(decoded.alfalfa == null ? AlfalfaData.NONE : decoded.alfalfa));
		Files.write(new File(dir, "alfalfa.json").toPath(), Json.write(alfalfaBoth).getBytes(UTF8));

		CaptureDelegate capture = new CaptureDelegate(false, false);
		EarsCommon.render(decoded, capture);
		Files.write(new File(dir, "display-list.json").toPath(), Json.write(capture.getObjects()).getBytes(UTF8));

		String reencode;
		if (!decoded.enabled) {
			// nothing decoded, so there is nothing to re-encode
			reencode = "n/a";
		} else {
			reencode = checkStable(f, decoded, png) ? "stable" : "known-unstable";
		}

		Map<String, Object> entry = new LinkedHashMap<String, Object>();
		entry.put("name", f.name);
		entry.put("format", f.format);
		entry.put("hasConfig", config != null);
		entry.put("quads", capture.getObjects().size());
		entry.put("reencode", reencode);
		if (f.unstableReason != null) {
			entry.put("reencodeNote", f.unstableReason);
		}
		return entry;
	}

	/**
	 * Encoding is lossy, but it must be lossy exactly once: whatever Java decodes, re-encoding and
	 * decoding again has to produce the same features. If that doesn't hold, the fixture is not a
	 * usable contract for the TypeScript port, so fail loudly rather than checking in a moving
	 * target.
	 * <p>
	 * The second pass starts from a fresh copy of the fixture PNG rather than a blank skin, because
	 * emissive extraction reads a palette out of the image (and erases it as it goes).
	 */
	private static boolean checkStable(Fixture f, EarsFeatures decoded, byte[] png) throws IOException {
		WritableEarsImage second = Skins.decode(png);
		if ("v0".equals(f.format)) {
			OracleV0Writer.write(decoded, second);
			Alfalfa.write(decoded.alfalfa == null ? AlfalfaData.NONE : decoded.alfalfa, second);
		} else {
			EarsFeaturesWriterV1.write(decoded, second);
		}
		WritableEarsImage third = Skins.decode(Skins.encode(second));
		EarsFeatures again = EarsFeaturesParser.detect(third, Alfalfa.read(third), Skins.LOADER);

		Map<String, Object> before = features(decoded);
		Map<String, Object> after = features(again);
		// compare the serialized form, because that is what the fixtures actually promise. It also
		// folds -0.0 into 0.0, which the SAM sign bit can otherwise produce out of a zero magnitude.
		if (Json.write(before).equals(Json.write(after))) {
			if (f.unstableReason != null) {
				throw new IllegalStateException("Fixture '"+f.name+"' is marked unstable ("+f.unstableReason
						+") but round-trips fine now — drop the marker.");
			}
			return true;
		}

		StringBuilder sb = new StringBuilder();
		sb.append("Fixture '").append(f.name).append("' does not survive a re-encode:\n");
		for (Map.Entry<String, Object> en : before.entrySet()) {
			Object a = en.getValue();
			Object b = after.get(en.getKey());
			if (a == null ? b != null : !Json.write(a).equals(Json.write(b))) {
				sb.append("  ").append(en.getKey()).append(": ").append(a).append(" -> ").append(b).append('\n');
			}
		}
		if (f.unstableReason != null) {
			System.out.println("note: "+sb.toString().trim()+"\n      (expected: "+f.unstableReason+")");
			return false;
		}
		throw new IllegalStateException(sb.toString());
	}

	private static Map<String, Object> features(EarsFeatures feat) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("enabled", feat.enabled);
		m.put("earMode", feat.earMode == null ? null : feat.earMode.name());
		m.put("earAnchor", feat.earAnchor == null ? null : feat.earAnchor.name());
		m.put("claws", feat.claws);
		m.put("horn", feat.horn);
		m.put("tailMode", feat.tailMode == null ? null : feat.tailMode.name());
		m.put("tailSegments", feat.tailSegments);
		m.put("tailBend0", feat.tailBend0);
		m.put("tailBend1", feat.tailBend1);
		m.put("tailBend2", feat.tailBend2);
		m.put("tailBend3", feat.tailBend3);
		m.put("snoutOffset", feat.snoutOffset);
		m.put("snoutWidth", feat.snoutWidth);
		m.put("snoutHeight", feat.snoutHeight);
		m.put("snoutDepth", feat.snoutDepth);
		m.put("chestSize", feat.chestSize);
		m.put("wingMode", feat.wingMode == null ? null : feat.wingMode.name());
		m.put("animateWings", feat.animateWings);
		m.put("capeEnabled", feat.capeEnabled);
		m.put("emissive", feat.emissive);
		m.put("emissiveSkinBytes", feat.emissiveSkin == null ? 0 : feat.emissiveSkin.size());
		m.put("emissiveWingBytes", feat.emissiveWing == null ? 0 : feat.emissiveWing.size());
		return m;
	}

	private static Map<String, Object> alfalfa(AlfalfaData data) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("version", data.version);
		// AlfalfaData wraps a HashMap, whose iteration order is not stable across runs or JVMs
		Map<String, Object> entries = new TreeMap<String, Object>();
		for (Map.Entry<String, Slice> en : data.data.entrySet()) {
			Map<String, Object> e = new LinkedHashMap<String, Object>();
			e.put("bytes", en.getValue().size());
			e.put("sha256", sha256(en.getValue().toByteArray()));
			entries.put(en.getKey(), e);
		}
		m.put("entries", entries);
		return m;
	}

	private static String sha256(byte[] data) {
		try {
			byte[] hash = java.security.MessageDigest.getInstance("SHA-256").digest(data);
			StringBuilder sb = new StringBuilder();
			for (byte b : hash) {
				sb.append(Character.forDigit((b>>4)&0xF, 16));
				sb.append(Character.forDigit(b&0xF, 16));
			}
			return sb.toString();
		} catch (java.security.NoSuchAlgorithmException e) {
			throw new AssertionError(e);
		}
	}

	private static WritableEarsImage shortSkin() {
		int[] px = new int[64*32];
		for (int y = 0; y < 32; y++) {
			for (int x = 0; x < 64; x++) {
				px[(y*64)+x] = 0xFF000000|((x*4)<<16)|((y*8)<<8)|((x^y)*4);
			}
		}
		return new RawEarsImage(px, 64, 32, false);
	}

	private static void paintEmissive(WritableEarsImage img) {
		// palette: a 4x4 block at (52,32); any pixel with alpha > 0 contributes its colour
		for (int y = 0; y < 4; y++) {
			for (int x = 0; x < 4; x++) {
				img.setARGB(52+x, 32+y, 0);
			}
		}
		img.setARGB(52, 32, EMISSIVE_A);
		img.setARGB(53, 32, EMISSIVE_B);
		// and some pixels on the face and torso that match, which is what makes them glow
		for (int i = 0; i < 4; i++) {
			img.setARGB(10+i, 10, EMISSIVE_A);
			img.setARGB(22+i, 22, EMISSIVE_B);
		}
	}

	private static EarsFeatures.Builder base() {
		@SuppressWarnings("deprecation")
		EarsFeatures.Builder b = EarsFeatures.builder();
		return b
				.earMode(EarMode.NONE)
				.earAnchor(EarAnchor.CENTER)
				.tailMode(TailMode.NONE)
				.wingMode(WingMode.NONE)
				.animateWings(true);
	}

	private static Fixture v1(String name, EarsFeatures.Builder config) {
		Fixture f = new Fixture(name, "v1");
		f.config = config;
		return f;
	}

	private static Fixture v0(String name, EarsFeatures.Builder config) {
		Fixture f = new Fixture(name, "v0");
		f.config = config;
		return f;
	}

	private static Fixture raw(String name, Painter painter) {
		Fixture f = new Fixture(name, "raw");
		f.painter = painter;
		return f;
	}

	private static List<Fixture> define() {
		List<Fixture> l = new ArrayList<Fixture>();

		// nothing at all — the config block is left as plain skin pixels
		l.add(raw("empty", new Painter() {
			@Override public void paint(WritableEarsImage img) {}
		}));

		// every ear mode, anchored centre
		for (EarMode mode : EarMode.values()) {
			if (mode == EarMode.NONE) continue;
			l.add(v1("ears-"+lower(mode.name()), base().earMode(mode).earAnchor(EarAnchor.CENTER)));
		}
		// and every anchor, for one mode
		for (EarAnchor anchor : EarAnchor.values()) {
			l.add(v1("ears-above-"+lower(anchor.name()), base().earMode(EarMode.ABOVE).earAnchor(anchor)));
		}

		l.add(v1("claws", base().earMode(EarMode.ABOVE).claws(true)));
		l.add(v1("horn", base().earMode(EarMode.ABOVE).horn(true)));
		l.add(v1("claws-and-horn", base().earMode(EarMode.ABOVE).claws(true).horn(true)));

		// every tail mode. STAR_OVERLAP is ordinal 8 and the v1 field is 3 bits wide, so this is
		// also the fixture that documents v1 silently truncating it to NONE.
		for (TailMode mode : TailMode.values()) {
			if (mode == TailMode.NONE) continue;
			l.add(v1("tail-"+lower(mode.name()), base().tailMode(mode).tailSegments(1).tailBends(30, 0, 0, 0)));
		}
		l.add(v1("tail-4-segments", base().tailMode(TailMode.DOWN).tailSegments(4).tailBends(45, -45, 90, -90)));
		l.add(v1("tail-extreme-bends", base().tailMode(TailMode.BACK).tailSegments(4).tailBends(90, 90, -90, -90)));

		// snout. width 0 means "no snout", and then the other three fields aren't written at all.
		l.add(v1("snout-min", base().snoutWidth(1).snoutHeight(1).snoutDepth(1).snoutOffset(0)));
		l.add(v1("snout-max", base().snoutWidth(7).snoutHeight(4).snoutDepth(8).snoutOffset(0)));
		l.add(v1("snout-offset", base().snoutWidth(4).snoutHeight(2).snoutDepth(3).snoutOffset(4)));
		l.add(v1("snout-zero-width", base().snoutWidth(0).snoutHeight(3).snoutDepth(3).snoutOffset(2)));

		// chestSize round-trips through writeUnit(5)/readUnit(5), which ceils on write and divides
		// on read — so these come back as something other than what went in
		l.add(v1("chest-half", base().chestSize(0.5f)));
		l.add(v1("chest-full", base().chestSize(1f)));

		for (WingMode mode : WingMode.values()) {
			if (mode == WingMode.NONE) continue;
			l.add(withWing(v1("wings-"+lower(mode.name()), base().wingMode(mode).animateWings(true))));
		}
		l.add(withWing(v1("wings-not-animated", base().wingMode(WingMode.SYMMETRIC_DUAL).animateWings(false))));
		// wing mode set but no wing texture: the parser forces the mode back to NONE, which leaves
		// animateWings set on a features object whose wingMode is NONE — a combination v1 cannot
		// re-encode, because the animate bit is only written when a wing mode is present
		l.add(v1("wings-without-texture", base().wingMode(WingMode.SYMMETRIC_DUAL).animateWings(true))
				.unstable("wingMode is forced to NONE after decode, so the animate bit stops being written"));
		// a 12x12 wing is upgraded to 20x16 by blitting at (x, y+2)
		Fixture legacyWing = v1("wing-legacy-12x12", base().wingMode(WingMode.SYMMETRIC_DUAL));
		legacyWing.alfalfa = alfalfaOf("wing", Skins.encode(Skins.texture(12, 12, 0x40)));
		l.add(legacyWing);

		Fixture cape = v1("cape", base().capeEnabled(true));
		cape.alfalfa = alfalfaOf("cape", Skins.encode(Skins.texture(20, 16, 0x80)));
		l.add(cape);

		Fixture emissive = v1("emissive", base().earMode(EarMode.ABOVE).emissive(true));
		emissive.emissivePalette = true;
		l.add(emissive);

		Fixture everything = v1("everything", base()
				.earMode(EarMode.AROUND).earAnchor(EarAnchor.FRONT)
				.claws(true).horn(true)
				.tailMode(TailMode.DOWN).tailSegments(4).tailBends(30, -20, 15, -10)
				.snoutWidth(4).snoutHeight(2).snoutDepth(3).snoutOffset(3)
				.chestSize(0.75f)
				.wingMode(WingMode.ASYMMETRIC_DUAL).animateWings(true)
				.capeEnabled(true).emissive(true));
		everything.emissivePalette = true;
		everything.alfalfa = alfalfaOf2(
				"wing", Skins.encode(Skins.texture(20, 16, 0x40)),
				"cape", Skins.encode(Skins.texture(20, 16, 0x80)));
		l.add(everything);

		// v0. This is the format the old manipulator wrote, so it's the one most existing skins in
		// the wild actually use.
		l.add(v0("v0-basic", base().earMode(EarMode.ABOVE).earAnchor(EarAnchor.CENTER).claws(true)
				.tailMode(TailMode.DOWN).tailSegments(1).tailBends(30, 0, 0, 0)));
		// the case v1 cannot represent at all
		l.add(v0("v0-tail-star-overlap", base().tailMode(TailMode.STAR_OVERLAP).tailSegments(2).tailBends(20, 40, 0, 0)));
		l.add(v0("v0-snout-chest-cape", base().earMode(EarMode.SIDES)
				.snoutWidth(3).snoutHeight(2).snoutDepth(4).snoutOffset(2)
				.chestSize(0.5f).capeEnabled(true)));
		// v0 leaves earAnchor null when the mode is NONE or BEHIND — a shape v1 can never produce
		l.add(v0("v0-behind-null-anchor", base().earMode(EarMode.BEHIND).earAnchor(EarAnchor.CENTER)));

		// malformed and edge inputs
		l.add(raw("bad-no-magic", new Painter() {
			@Override public void paint(WritableEarsImage img) {
				img.setARGB(0, 32, 0xFF123456);
			}
		}));
		l.add(raw("bad-v1-truncated", new Painter() {
			@Override public void paint(WritableEarsImage img) {
				// the magic, then a single byte of payload and nothing else
				img.setARGB(0, 32, 0xFFEA2501);
				img.setARGB(1, 32, 0xFF000000);
				for (int i = 2; i < 16; i++) {
					img.setARGB(i%4, 32+(i/4), 0xFF000000);
				}
			}
		}));
		// a saturated bitstream: every field at its maximum, including an out-of-range ear value
		// (63) whose mode falls back to NONE while its anchor still decodes to BACK
		l.add(raw("bad-v1-all-ones", new Painter() {
			@Override public void paint(WritableEarsImage img) {
				img.setARGB(0, 32, 0xFFEA2501);
				for (int i = 1; i < 16; i++) {
					img.setARGB(i%4, 32+(i/4), 0xFFFFFFFF);
				}
			}
		}).unstable("ear value 63 decodes to mode NONE with anchor BACK, and NONE writes no anchor"));
		l.add(raw("bad-alfalfa-garbage", new Painter() {
			@Override public void paint(WritableEarsImage img) {
				img.setARGB(0, 32, 0xFFEA2501);
				// alpha values that are not a valid alfalfa stream
				for (int y = 0; y < 8; y++) {
					for (int x = 8; x < 24; x++) {
						img.setARGB(x, y, 0x80000000|(img.getARGB(x, y)&0x00FFFFFF));
					}
				}
			}
		}).unstable("junk decodes to ear mode NONE with anchor FRONT, and NONE writes no anchor"));
		Fixture legacySize = raw("bad-64x32-skin", new Painter() {
			@Override public void paint(WritableEarsImage img) {}
		});
		legacySize.height = 32;
		l.add(legacySize);

		return l;
	}

	private static Fixture withWing(Fixture f) {
		f.alfalfa = alfalfaOf("wing", Skins.encode(Skins.texture(20, 16, 0x40)));
		return f;
	}

	private static AlfalfaData alfalfaOf(String key, byte[] value) {
		Map<String, Slice> m = new LinkedHashMap<String, Slice>();
		m.put(key, new Slice(value));
		return new AlfalfaData(1, m);
	}

	private static AlfalfaData alfalfaOf2(String k1, byte[] v1, String k2, byte[] v2) {
		Map<String, Slice> m = new LinkedHashMap<String, Slice>();
		m.put(k1, new Slice(v1));
		m.put(k2, new Slice(v2));
		return new AlfalfaData(1, m);
	}

	private static String lower(String s) {
		return s.toLowerCase(java.util.Locale.ROOT).replace('_', '-');
	}

}
