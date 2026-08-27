function escapeLoonInput(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const response = await env.ASSETS.fetch(request);
  if (!response.ok) {
    return new Response('Not found', { status: 404 });
  }

  let content = await response.text();
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const origin = `${protocol}://${host}`;
  const token = escapeLoonInput(url.searchParams.get('token') || '');

  content = content.replace(/https:\/\/你的域名/g, origin);
  content = content.replace(/你的域名/g, host);
  content = content.replace(/你的Token/g, token);

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
