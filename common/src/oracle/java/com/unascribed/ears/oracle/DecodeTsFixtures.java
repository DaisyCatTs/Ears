package com.unascribed.ears.oracle;

import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

import com.unascribed.ears.api.features.AlfalfaData;
import com.unascribed.ears.api.features.EarsFeatures;
import com.unascribed.ears.common.Alfalfa;
import com.unascribed.ears.common.EarsFeaturesParser;
import com.unascribed.ears.common.WritableEarsImage;

/**
 * Decodes skins written by the TypeScript encoder and records what Java made of them.
 * <p>
 * This is the direction that actually proves compatibility. An encoder verified only against its
 * own decoder can be self-consistently wrong in a way no amount of round-tripping will reveal;
 * only the implementation Minecraft ships can settle it.
 * <p>
 * The comparison itself happens on the TypeScript side, which has a JSON parser to hand — this
 * just writes {@code java-decoded.json} next to each skin.
 */
public class DecodeTsFixtures {

	private static final Charset UTF8 = Charset.forName("UTF-8");

	public static void main(String[] args) throws Exception {
		if (args.length < 1) {
			System.err.println("usage: DecodeTsFixtures <fixtures-ts-dir>");
			System.exit(2);
		}
		File root = new File(args[0]);
		File[] dirs = root.listFiles();
		if (dirs == null) {
			System.err.println("No TypeScript fixtures at "+root+" — run `bun run fixtures:emit` first.");
			System.exit(1);
			return;
		}
		Arrays.sort(dirs);
		int count = 0;
		for (File dir : dirs) {
			File skin = new File(dir, "skin.png");
			if (!dir.isDirectory() || !skin.isFile()) continue;
			WritableEarsImage img = Skins.decode(Files.readAllBytes(skin.toPath()));
			AlfalfaData alfalfa = Alfalfa.read(img);
			EarsFeatures feat = EarsFeaturesParser.detect(img, alfalfa, Skins.LOADER);
			Files.write(new File(dir, "java-decoded.json").toPath(), Json.write(features(feat)).getBytes(UTF8));
			count++;
		}
		System.out.println("Decoded "+count+" TypeScript-encoded fixtures in "+root);
	}

	/** Same field set and formatting as {@link Fixtures}, so the two are directly comparable. */
	private static Map<String, Object> features(EarsFeatures feat) throws IOException {
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
		return m;
	}

}
