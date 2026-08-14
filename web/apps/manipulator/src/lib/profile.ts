/**
 * Whether a player uses the slim (Alex) model.
 *
 * Split out from the skin fetch deliberately: it is a nicety, and a failure here should never stop
 * a skin from loading.
 */
export async function detectSlim(name: string): Promise<boolean> {
	try {
		const res = await fetch(`https://crafthead.net/profile/${encodeURIComponent(name)}`);
		if (!res.ok) return false;
		const profile = (await res.json()) as { properties?: { name: string; value: string }[] };
		const textures = profile.properties?.find((p) => p.name === 'textures');
		if (!textures) return false;
		const decoded = JSON.parse(atob(textures.value)) as {
			textures?: { SKIN?: { metadata?: { model?: string } } };
		};
		return decoded.textures?.SKIN?.metadata?.model === 'slim';
	} catch {
		return false;
	}
}
