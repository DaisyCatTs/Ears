package com.unascribed.ears.common;

import com.unascribed.ears.api.features.EarsFeatures;
import com.unascribed.ears.api.features.EarsFeatures.EarAnchor;
import com.unascribed.ears.api.features.EarsFeatures.EarMode;
import com.unascribed.ears.api.features.EarsFeatures.TailMode;
import com.unascribed.ears.api.features.EarsFeatures.WingMode;
import com.unascribed.ears.common.EarsFeaturesParserV0.MagicPixel;

/**
 * Writes v0 (pixelwise) Ears data, <b>for fixture generation only</b>.
 * <p>
 * Ears itself has never had a v0 writer — v0 is read-only in Java, and the only v0 encoder that has
 * ever existed is the inline JavaScript in the old manipulator. That matters because the old
 * manipulator is what wrote nearly every Ears skin in the wild, so v0 is the format the TypeScript
 * decoder will meet most often and it needs fixtures.
 * <p>
 * This lives in {@code com.unascribed.ears.common} because {@link EarsFeaturesParserV0} and its
 * magic pixel tables are package-private. The tables below deliberately mirror that class; where a
 * feature value has more than one valid magic pixel (NONE is both RED and BLUE for several fields),
 * the choice here matches what the old manipulator's dropdowns wrote.
 *
 * @see EarsFeaturesParserV0
 */
public final class OracleV0Writer {

	private OracleV0Writer() {}

	public static void write(EarsFeatures feat, WritableEarsImage img) {
		// index 0
		put(img, 0, MagicPixel.BLUE.rgb);
		// 1: ear mode
		put(img, 1, earMode(feat.earMode));
		// 2: ear anchor — the parser ignores this pixel entirely for NONE/BEHIND
		put(img, 2, earAnchor(feat.earAnchor));
		// 3: protrusions
		put(img, 3, protrusions(feat.claws, feat.horn));
		// 4: tail mode
		put(img, 4, tailMode(feat.tailMode));
		// 5: tail bends, ARGB-packed, with bend0 inverted in the alpha channel
		put(img, 5, tailBends(feat));
		// 6: snout, as R=width G=height B=depth
		if (feat.snoutWidth > 0 && feat.snoutHeight > 0 && feat.snoutDepth > 0) {
			put(img, 6, (feat.snoutWidth<<16)|(feat.snoutHeight<<8)|feat.snoutDepth);
		} else {
			put(img, 6, MagicPixel.BLUE.rgb);
		}
		// 7: "etc", as R=chest size G=snout offset B=flags
		int chest = (int)(feat.chestSize*128);
		if (chest > 255) chest = 255;
		put(img, 7, (chest<<16)|((feat.snoutOffset&0xFF)<<8)|(feat.capeEnabled ? 16 : 0));
		// 8: wing mode
		put(img, 8, wingMode(feat.wingMode));
		// 9: animate wings — anything but RED means "animate"
		put(img, 9, (feat.animateWings ? MagicPixel.BLUE : MagicPixel.RED).rgb);
		// 10: emissive — only ORANGE enables it
		put(img, 10, (feat.emissive ? MagicPixel.ORANGE : MagicPixel.RED).rgb);
	}

	private static int tailBends(EarsFeatures feat) {
		if (feat.tailMode == TailMode.NONE || feat.tailSegments <= 0) {
			return MagicPixel.BLUE.rgb;
		}
		int a = 255-unitToPxVal(feat.tailBend0/90);
		int r = feat.tailSegments > 1 ? unitToPxVal(feat.tailBend1/90) : 0;
		int g = feat.tailSegments > 2 ? unitToPxVal(feat.tailBend2/90) : 0;
		int b = feat.tailSegments > 3 ? unitToPxVal(feat.tailBend3/90) : 0;
		int rgb = (r<<16)|(g<<8)|b;
		if (rgb == MagicPixel.BLUE.rgb) {
			// the parser reads a Magic Blue bend pixel as "no bends at all"
			throw new IllegalArgumentException("Tail bends encode to Magic Blue; pick different angles for this fixture");
		}
		return (a<<24)|rgb;
	}

	/** Inverse of {@code EarsFeaturesParserV0.pxValToUnit}. */
	static int unitToPxVal(float f) {
		if (f == 0) return 0;
		int j = Math.round(f*128);
		if (j > 0) return j+127;
		return j+129;
	}

	private static void put(WritableEarsImage img, int idx, int rgb) {
		int x = idx%4;
		int y = 32+(idx/4);
		// only the bend pixel carries data in its alpha; everything else is opaque
		int argb = (rgb&0xFF000000) != 0 ? rgb : (0xFF000000|rgb);
		img.setARGB(x, y, argb);
	}

	private static int earMode(EarMode mode) {
		switch (mode) {
			case NONE: return MagicPixel.RED.rgb;
			case ABOVE: return MagicPixel.BLUE.rgb;
			case SIDES: return MagicPixel.GREEN.rgb;
			case BEHIND: return MagicPixel.PURPLE.rgb;
			case AROUND: return MagicPixel.CYAN.rgb;
			case FLOPPY: return MagicPixel.ORANGE.rgb;
			case CROSS: return MagicPixel.PINK.rgb;
			case OUT: return MagicPixel.PURPLE2.rgb;
			case TALL: return MagicPixel.WHITE.rgb;
			case TALL_CROSS: return MagicPixel.GRAY.rgb;
			default: throw new AssertionError("missing case for "+mode);
		}
	}

	private static int earAnchor(EarAnchor anchor) {
		if (anchor == null) return MagicPixel.BLUE.rgb;
		switch (anchor) {
			case CENTER: return MagicPixel.BLUE.rgb;
			case FRONT: return MagicPixel.GREEN.rgb;
			case BACK: return MagicPixel.RED.rgb;
			default: throw new AssertionError("missing case for "+anchor);
		}
	}

	private static int protrusions(boolean claws, boolean horn) {
		if (claws && horn) return MagicPixel.CYAN.rgb;
		if (claws) return MagicPixel.GREEN.rgb;
		if (horn) return MagicPixel.PURPLE.rgb;
		return MagicPixel.RED.rgb;
	}

	private static int tailMode(TailMode mode) {
		switch (mode) {
			case NONE: return MagicPixel.RED.rgb;
			case DOWN: return MagicPixel.BLUE.rgb;
			case BACK: return MagicPixel.GREEN.rgb;
			case UP: return MagicPixel.PURPLE.rgb;
			case VERTICAL: return MagicPixel.ORANGE.rgb;
			case CROSS: return MagicPixel.PINK.rgb;
			case CROSS_OVERLAP: return MagicPixel.PURPLE2.rgb;
			case STAR: return MagicPixel.WHITE.rgb;
			case STAR_OVERLAP: return MagicPixel.GRAY.rgb;
			default: throw new AssertionError("missing case for "+mode);
		}
	}

	private static int wingMode(WingMode mode) {
		switch (mode) {
			case NONE: return MagicPixel.RED.rgb;
			case SYMMETRIC_DUAL: return MagicPixel.PINK.rgb;
			case SYMMETRIC_SINGLE: return MagicPixel.GREEN.rgb;
			case ASYMMETRIC_L: return MagicPixel.CYAN.rgb;
			case ASYMMETRIC_R: return MagicPixel.ORANGE.rgb;
			case ASYMMETRIC_DUAL: return MagicPixel.PURPLE.rgb;
			case FLAT: return MagicPixel.PURPLE2.rgb;
			default: throw new AssertionError("missing case for "+mode);
		}
	}

}
