/**
 * The Ears renderer, ported from Java.
 *
 * `render()` walks the features and emits quads through an `EarsRenderDelegate`; nothing here knows
 * about WebGL, so the same code drives the golden-fixture comparison and the three.js preview.
 */

export {
	BODY_PARTS,
	DetachedEarsRenderDelegate,
	GROW_AMOUNTS,
	TEX_SOURCES,
	bodyPartSize,
	type BodyPart,
	type EarsRenderDelegate,
	type QuadGrow,
	type StateType,
	type TexFlip,
	type TexRotation,
	type TexSource,
} from './delegate.js';
export { CaptureDelegate, type Move, type Point, type Quad, type RenderObject } from './capture.js';
export { render } from './renderer.js';
export { calculateUVs } from './uvs.js';
