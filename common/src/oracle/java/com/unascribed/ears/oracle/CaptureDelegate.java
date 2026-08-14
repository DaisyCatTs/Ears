package com.unascribed.ears.oracle;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.unascribed.ears.common.EarsCommon;
import com.unascribed.ears.common.render.AbstractDetachedEarsRenderDelegate;

/**
 * Captures everything {@code EarsRenderer} draws into a plain display list, so the TypeScript port
 * of the renderer can be diffed against Java numerically instead of by eye.
 * <p>
 * This is a direct port of the capture delegate the old TeaVM manipulator used
 * ({@code common/src/js/.../EarsJS.java}), which is what the deployed preview rendered from — so
 * the shape of the output is deliberately identical to the old {@code window.renderObjects}.
 */
public class CaptureDelegate extends AbstractDetachedEarsRenderDelegate {

	private final List<Object> objects = new ArrayList<Object>();
	private final List<List<Object>> movesStack = new ArrayList<List<Object>>();
	private final boolean slim;
	private final boolean jacket;

	private List<Object> moves = new ArrayList<Object>();
	private TexSource texture = TexSource.SKIN;
	private boolean emissive = false;

	public CaptureDelegate(boolean slim, boolean jacket) {
		this.slim = slim;
		this.jacket = jacket;
	}

	public List<Object> getObjects() {
		return objects;
	}

	@Override
	public void bind(TexSource src) {
		texture = src;
	}

	@Override
	public void scale(float x, float y, float z) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("type", "scale");
		m.put("x", x);
		m.put("y", y);
		m.put("z", z);
		moves.add(m);
	}

	@Override
	public void translate(float x, float y, float z) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("type", "translate");
		m.put("x", x);
		m.put("y", y);
		m.put("z", z);
		moves.add(m);
	}

	@Override
	public void rotate(float ang, float x, float y, float z) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("type", "rotate");
		m.put("ang", ang);
		m.put("x", x);
		m.put("y", y);
		m.put("z", z);
		moves.add(m);
	}

	@Override
	public void anchorTo(BodyPart part) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("type", "anchor");
		m.put("part", part.name().toLowerCase(Locale.ROOT));
		moves.add(m);
	}

	@Override
	public void push() {
		movesStack.add(moves);
		moves = new ArrayList<Object>(moves);
	}

	@Override
	public void pop() {
		moves = movesStack.remove(movesStack.size()-1);
	}

	@Override
	public void renderFront(int u, int v, int width, int height, TexRotation rot, TexFlip flip, QuadGrow grow) {
		renderQuad(u, v, width, height, rot, flip, grow, false);
	}

	@Override
	public void renderBack(int u, int v, int width, int height, TexRotation rot, TexFlip flip, QuadGrow grow) {
		renderQuad(u, v, width, height, rot, flip, grow, true);
	}

	@Override
	public void renderDoubleSided(int u, int v, int width, int height, TexRotation rot, TexFlip flip, QuadGrow grow) {
		renderFront(u, v, width, height, rot, flip, grow);
		renderBack(u, v, width, height, rot, flip.flipHorizontally(), grow);
	}

	@Override
	public void renderDebugDot(float r, float g, float b, float a) {
		Map<String, Object> p = new LinkedHashMap<String, Object>();
		p.put("type", "point");
		p.put("moves", new ArrayList<Object>(moves));
		p.put("color", ((int)(a*255)<<24)|((int)(r*255)<<16)|((int)(g*255)<<8)|((int)(b*255)));
		objects.add(p);
	}

	private void renderQuad(int u, int v, int width, int height, TexRotation rot, TexFlip flip, QuadGrow grow, boolean back) {
		float w = width;
		float h = height;
		if (grow.grow > 0) {
			w += grow.grow*2;
			h += grow.grow*2;
			push();
			translate(-grow.grow, -grow.grow, 0);
		}
		Map<String, Object> q = new LinkedHashMap<String, Object>();
		q.put("type", "quad");
		q.put("moves", new ArrayList<Object>(moves));
		List<Object> uvs = new ArrayList<Object>();
		float[][] uvsArr = EarsCommon.calculateUVs(u, v, width, height, rot, back ? flip.flipHorizontally() : flip, texture);
		for (float[] arr : uvsArr) {
			List<Object> pair = new ArrayList<Object>();
			for (int i = 0; i < arr.length; i++) {
				pair.add(arr[i]);
			}
			uvs.add(pair);
		}
		q.put("uvs", uvs);
		q.put("width", w);
		q.put("height", h);
		q.put("back", back);
		q.put("texture", texture.lowerName());
		q.put("emissive", emissive);
		if (grow.grow > 0) {
			pop();
		}
		objects.add(q);
	}

	@Override
	public boolean isSlim() {
		return slim;
	}

	@Override
	public boolean isJacketEnabled() {
		return jacket;
	}

	@Override
	public void setEmissive(boolean emissive) {
		this.emissive = emissive;
	}

}
