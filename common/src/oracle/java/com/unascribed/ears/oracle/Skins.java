package com.unascribed.ears.oracle;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import com.unascribed.ears.common.EarsFeaturesParser;
import com.unascribed.ears.common.EarsImage;
import com.unascribed.ears.common.QDPNG;
import com.unascribed.ears.common.RawEarsImage;
import com.unascribed.ears.common.WritableEarsImage;

/**
 * Image plumbing for the fixture generator. Deliberately deterministic: no randomness, no clock, no
 * platform-dependent behaviour, so regenerating fixtures produces byte-identical output.
 */
public final class Skins {

	private Skins() {}

	/**
	 * Ears' own PNG support is write-only ({@link QDPNG}), and each platform supplies its own
	 * decoder. The oracle runs on a real JVM, so it can use ImageIO for the reads.
	 */
	public static final EarsFeaturesParser.PNGLoader LOADER = new EarsFeaturesParser.PNGLoader() {
		@Override
		public EarsImage load(byte[] data) throws IOException {
			return decode(data);
		}
	};

	/**
	 * A fully opaque 64x64 skin with a deterministic gradient. Opaque matters: Alfalfa lives in the
	 * alpha channel, and a transparent pixel is skipped by the reader rather than read as zero.
	 */
	public static WritableEarsImage baseSkin() {
		int[] px = new int[64*64];
		for (int y = 0; y < 64; y++) {
			for (int x = 0; x < 64; x++) {
				int r = (x*4)&0xFF;
				int g = (y*4)&0xFF;
				int b = ((x^y)*4)&0xFF;
				px[(y*64)+x] = 0xFF000000|(r<<16)|(g<<8)|b;
			}
		}
		return new RawEarsImage(px, 64, 64, false);
	}

	/**
	 * A deterministic wing/cape texture: mostly transparent with two flat blocks, tinted so the
	 * two are distinguishable.
	 * <p>
	 * Flat on purpose. These get PNG-encoded and stuffed into Alfalfa, which only has 1372 bytes
	 * of real capacity across the whole skin, and a noisy gradient does not survive that budget.
	 */
	public static WritableEarsImage texture(int width, int height, int tint) {
		int[] px = new int[width*height];
		int primary = 0xFF000000|(tint<<16)|0x004080;
		int secondary = 0xFF000000|(tint<<8)|0x400020;
		for (int y = 0; y < height; y++) {
			for (int x = 0; x < width; x++) {
				int c = 0;
				if (x >= 1 && x < width-1 && y >= 1 && y < height-1) c = primary;
				if (x >= width/2 && y >= height/2) c = secondary;
				px[(y*width)+x] = c;
			}
		}
		return new RawEarsImage(px, width, height, false);
	}

	public static byte[] encode(WritableEarsImage img) {
		return QDPNG.write(img);
	}

	public static RawEarsImage decode(byte[] data) throws IOException {
		BufferedImage bi = ImageIO.read(new ByteArrayInputStream(data));
		if (bi == null) throw new IOException("Not a readable image");
		int w = bi.getWidth();
		int h = bi.getHeight();
		int[] px = new int[w*h];
		for (int y = 0; y < h; y++) {
			for (int x = 0; x < w; x++) {
				px[(y*w)+x] = bi.getRGB(x, y);
			}
		}
		return new RawEarsImage(px, w, h, false);
	}

	public static byte[] readAll(java.io.InputStream in) throws IOException {
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		byte[] buf = new byte[8192];
		int n;
		while ((n = in.read(buf)) != -1) {
			baos.write(buf, 0, n);
		}
		return baos.toByteArray();
	}

}
