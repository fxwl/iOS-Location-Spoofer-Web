import { onRequestGet as handleSearch } from './search.js';

/**
 * Root-level Pages middleware.
 *
 * Cloudflare runs this middleware for the entire application, including requests
 * that would otherwise fall through to static assets. This makes /search robust
 * even when Pages' generated function route table is stale or a deployment treats
 * the unknown path as an SPA/static fallback.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname === '/search') {
    if (context.request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Allow': 'GET'
        }
      });
    }

    try {
      return await handleSearch(context);
    } catch (error) {
      return new Response(JSON.stringify({
        error: `高德搜索服务异常：${error && error.message ? error.message : String(error)}`
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  return context.next();
}
