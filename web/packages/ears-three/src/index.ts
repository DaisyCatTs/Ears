/**
 * three.js presentation for the Ears renderer.
 *
 * The display list this consumes is verified against Java quad-for-quad by `@ears/renderer`; this
 * package is the part that turns it into meshes, and is checked by looking at it.
 */

export { buildDisplayList, disposeGroup, type BuildOptions } from './display-list.js';
export { buildPlayerModel, type PlayerModelOptions } from './player-model.js';
export { PARTS, partFor, type PartDef } from './parts.js';
export { Preview, type PreviewState, type PreviewTextures } from './preview.js';
