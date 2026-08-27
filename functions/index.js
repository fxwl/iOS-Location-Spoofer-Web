import { handleFreeSearch } from './_free_search.js';
import { buildRuntimeScript } from './_runtime.js';

/**
 * Root Cloudflare Pages Function.
 *
 * - Normal requests serve the static Web UI from /public and inject the small
 *   compatibility runtime used for free place search and Loon configuration.
 * - ?__api=search requests are handled server-side and never reach AMap.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.searchParams.get('__api') === 'search') {
    return handleFreeSearch(request, env);
  }

  const response = await env.ASSETS.fetch(request);
  if (!response.ok) return response;

  const runtimeScript = buildRuntimeScript(env.TOKEN || '');
  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(runtimeScript, { html: true });
      }
    })
    .transform(response);
}
