/**
 * The only server-side code in the project: a proxy for looking up a player's current skin.
 *
 * It exists because Mojang's API sends no CORS headers, so a browser cannot call it directly. The
 * old manipulator solved that by routing through two third-party `b-cdn.net` proxies — someone
 * else's infrastructure seeing every lookup. This is ours, and it does nothing else.
 *
 * Everything about editing a skin still happens in the browser. This endpoint only fetches a
 * *public* profile and returns the PNG; it stores nothing, logs no usernames, and is never involved
 * in export.
 */

const PROFILE_API = 'https://api.mojang.com/users/profiles/minecraft/';
const SESSION_API = 'https://sessionserver.mojang.com/session/minecraft/profile/';

/** Mojang usernames are 3-16 of [A-Za-z0-9_]; anything else is not worth a round trip. */
const USERNAME = /^[A-Za-z0-9_]{1,16}$/;
const UUID = /^[0-9a-fA-F]{32}$/;

interface Env {
	ASSETS: Fetcher;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.startsWith('/api/skin/')) {
			return lookupSkin(decodeURIComponent(url.pathname.slice('/api/skin/'.length)));
		}

		// everything else is the static editor
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;

async function lookupSkin(name: string): Promise<Response> {
	if (!USERNAME.test(name) && !UUID.test(name)) {
		return json({ error: 'That does not look like a Minecraft username.' }, 400);
	}

	try {
		let uuid = name;
		if (!UUID.test(name)) {
			const profile = await fetch(PROFILE_API + encodeURIComponent(name), {
				cf: { cacheTtl: 300, cacheEverything: true },
			});
			if (profile.status === 404 || profile.status === 204) {
				return json({ error: `No player called "${name}".` }, 404);
			}
			if (!profile.ok) return json({ error: 'Mojang is not answering right now.' }, 502);
			const body = (await profile.json()) as { id?: string };
			if (!body.id) return json({ error: `No player called "${name}".` }, 404);
			uuid = body.id;
		}

		const session = await fetch(`${SESSION_API}${uuid}`, {
			cf: { cacheTtl: 300, cacheEverything: true },
		});
		if (!session.ok) return json({ error: 'Could not read that profile.' }, 502);
		const profile = (await session.json()) as {
			properties?: { name: string; value: string }[];
		};

		const textures = profile.properties?.find((p) => p.name === 'textures');
		if (!textures) return json({ error: 'That profile has no skin.' }, 404);

		const decoded = JSON.parse(atob(textures.value)) as {
			textures?: { SKIN?: { url?: string; metadata?: { model?: string } } };
		};
		const skinUrl = decoded.textures?.SKIN?.url;
		if (!skinUrl) return json({ error: 'That player is using a default skin.' }, 404);

		// Check the host, not the prefix: Mojang still hands these out as plain http URLs, so a
		// startsWith('https://...') test rejects every real profile. Validate the host and then
		// fetch over https ourselves rather than following them to port 80.
		let textureUrl: URL;
		try {
			textureUrl = new URL(skinUrl);
		} catch {
			return json({ error: 'That profile points somewhere unexpected.' }, 502);
		}
		if (textureUrl.hostname !== 'textures.minecraft.net') {
			return json({ error: 'That profile points somewhere unexpected.' }, 502);
		}
		textureUrl.protocol = 'https:';

		const skin = await fetch(textureUrl.toString(), { cf: { cacheTtl: 3600, cacheEverything: true } });
		if (!skin.ok) return json({ error: 'Could not download that skin.' }, 502);

		return new Response(skin.body, {
			headers: {
				'content-type': 'image/png',
				'cache-control': 'public, max-age=300',
				'x-skin-model': decoded.textures?.SKIN?.metadata?.model === 'slim' ? 'slim' : 'classic',
			},
		});
	} catch {
		return json({ error: 'Something went wrong talking to Mojang.' }, 502);
	}
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});
}
