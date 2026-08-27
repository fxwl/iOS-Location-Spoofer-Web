import { authOk, jsonResponse, errorResponse } from './_utils.js';

function textValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('');
  return value == null ? '' : String(value);
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authOk(request, env)) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const keywords = (url.searchParams.get('keywords') || '').trim();
  if (!keywords) {
    return errorResponse('请输入搜索关键词', 400);
  }

  if (!env.AMAP_KEY) {
    return errorResponse('未配置 AMAP_KEY，请在 Cloudflare Pages 中添加高德 Web 服务 API Key', 503);
  }

  const endpoint = new URL('https://restapi.amap.com/v3/place/text');
  endpoint.searchParams.set('key', env.AMAP_KEY);
  endpoint.searchParams.set('keywords', keywords.slice(0, 80));
  endpoint.searchParams.set('offset', '12');
  endpoint.searchParams.set('page', '1');
  endpoint.searchParams.set('extensions', 'base');
  endpoint.searchParams.set('children', '1');

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { 'Accept': 'application/json' }
    });
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch (_) {
      return errorResponse('高德 API 返回了无法解析的数据', 502);
    }

    if (!response.ok || data.status !== '1') {
      const info = textValue(data.info) || `HTTP ${response.status}`;
      const infocode = textValue(data.infocode);
      let message = `高德搜索失败：${info}`;
      if (infocode) message += ` (${infocode})`;
      message += '。请确认 AMAP_KEY 为“Web 服务 API”类型 Key，并已启用 Web 服务权限。';
      return jsonResponse({ ok: false, error: message, infocode }, 502);
    }

    const pois = Array.isArray(data.pois) ? data.pois : [];
    const results = pois
      .filter((poi) => poi && typeof poi.location === 'string' && poi.location.includes(','))
      .map((poi) => ({
        name: textValue(poi.name) || '未命名地点',
        address: textValue(poi.address),
        district: [textValue(poi.pname), textValue(poi.cityname), textValue(poi.adname)]
          .filter(Boolean)
          .filter((value, index, array) => array.indexOf(value) === index)
          .join(''),
        location: poi.location
      }))
      .slice(0, 10);

    return jsonResponse({ ok: true, provider: 'amap', results });
  } catch (error) {
    return errorResponse(`高德搜索请求失败：${error && error.message ? error.message : String(error)}`, 502);
  }
}
