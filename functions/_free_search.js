function apiJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function textValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('');
  return value == null ? '' : String(value);
}

function uniqueText(values) {
  return values
    .map(textValue)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return ret;
}

function transformLng(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return ret;
}

function wgsToGcj(lat, lng) {
  if (outOfChina(lat, lng)) return [lat, lng];
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
  return [lat + dLat, lng + dLng];
}

function legacyLocation(lat, lng) {
  const gcj = wgsToGcj(Number(lat), Number(lng));
  return `${gcj[1].toFixed(6)},${gcj[0].toFixed(6)}`;
}

async function fetchJson(url, extraHeaders = {}) {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'iOS-Location-Spoofer-Web/1.0',
      ...extraHeaders
    }
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(`HTTP ${response.status} 返回了非 JSON 数据`);
  }
  if (!response.ok) {
    const reason = data && (data.error || data.reason || data.message);
    throw new Error(reason ? `HTTP ${response.status}: ${textValue(reason)}` : `HTTP ${response.status}`);
  }
  return data;
}

async function searchPhoton(keywords) {
  const endpoint = new URL('https://photon.komoot.io/api/');
  endpoint.searchParams.set('q', keywords.slice(0, 120));
  endpoint.searchParams.set('limit', '10');
  // Do not force lang=zh here. Public Photon instances only allow languages that
  // were indexed by that instance. Omitting lang lets Photon search local OSM names,
  // including Chinese names, instead of rejecting unsupported language codes.

  const data = await fetchJson(endpoint, { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5' });
  const features = Array.isArray(data && data.features) ? data.features : [];
  return features.map((feature) => {
    const p = feature && feature.properties ? feature.properties : {};
    const coords = feature && feature.geometry && Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates : [];
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const name = textValue(p.name) || textValue(p.street) || textValue(p.city) || textValue(p.locality) || '未命名地点';
    const address = uniqueText([
      [textValue(p.street), textValue(p.housenumber)].filter(Boolean).join(' '),
      p.locality,
      p.district,
      p.postcode
    ]).join(' · ');
    const district = uniqueText([p.city, p.county, p.state, p.country]).join('');
    return { name, address, district, location: legacyLocation(lat, lng), source: 'Photon' };
  }).filter(Boolean);
}

async function searchNominatim(keywords) {
  const endpoint = new URL('https://nominatim.openstreetmap.org/search');
  endpoint.searchParams.set('q', keywords.slice(0, 120));
  endpoint.searchParams.set('format', 'jsonv2');
  endpoint.searchParams.set('limit', '10');
  endpoint.searchParams.set('addressdetails', '1');
  endpoint.searchParams.set('namedetails', '1');
  endpoint.searchParams.set('dedupe', '1');
  endpoint.searchParams.set('accept-language', 'zh-CN,zh,en');

  const data = await fetchJson(endpoint, { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5' });
  const items = Array.isArray(data) ? data : [];
  return items.map((item) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const names = item.namedetails || {};
    const address = item.address || {};
    const displayParts = textValue(item.display_name).split(',').map((part) => part.trim()).filter(Boolean);
    const name = textValue(names['name:zh']) || textValue(names.name) || textValue(item.name) || displayParts[0] || '未命名地点';
    const subAddress = uniqueText([
      address.house_number && address.road ? `${address.road} ${address.house_number}` : address.road,
      address.neighbourhood,
      address.suburb,
      address.city_district
    ]).join(' · ');
    const district = uniqueText([
      address.city || address.town || address.municipality,
      address.county,
      address.state,
      address.country
    ]).join('');

    return {
      name,
      address: subAddress || displayParts.slice(1, 4).join(' · '),
      district,
      location: legacyLocation(lat, lng),
      source: 'Nominatim'
    };
  }).filter(Boolean);
}

async function searchOpenMeteo(keywords) {
  const endpoint = new URL('https://geocoding-api.open-meteo.com/v1/search');
  endpoint.searchParams.set('name', keywords.slice(0, 120));
  endpoint.searchParams.set('count', '10');
  endpoint.searchParams.set('language', 'zh');
  endpoint.searchParams.set('format', 'json');

  const data = await fetchJson(endpoint);
  const items = Array.isArray(data && data.results) ? data.results : [];
  return items.map((item) => {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      name: textValue(item.name) || '未命名地点',
      address: uniqueText([item.admin3, item.admin4]).join(' · '),
      district: uniqueText([item.admin2, item.admin1, item.country]).join(''),
      location: legacyLocation(lat, lng),
      source: 'Open-Meteo'
    };
  }).filter(Boolean);
}

function appendUnique(target, incoming, limit = 10) {
  for (const item of incoming) {
    if (target.length >= limit) break;
    const key = `${textValue(item.name).toLowerCase()}|${item.location}`;
    if (!target.some((existing) => `${textValue(existing.name).toLowerCase()}|${existing.location}` === key)) {
      target.push(item);
    }
  }
}

export async function handleFreeSearch(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (env.TOKEN && token !== env.TOKEN) {
    return apiJson({ ok: false, error: 'Unauthorized' }, 401);
  }

  const keywords = (url.searchParams.get('keywords') || '').trim();
  if (!keywords) return apiJson({ ok: false, error: '请输入搜索关键词' }, 400);

  const results = [];
  const diagnostics = {};

  try {
    const photon = await searchPhoton(keywords);
    diagnostics.photon = { count: photon.length };
    appendUnique(results, photon);
  } catch (error) {
    diagnostics.photon = { count: 0, error: error && error.message ? error.message : String(error) };
  }

  if (results.length < 8) {
    try {
      const nominatim = await searchNominatim(keywords);
      diagnostics.nominatim = { count: nominatim.length };
      appendUnique(results, nominatim);
    } catch (error) {
      diagnostics.nominatim = { count: 0, error: error && error.message ? error.message : String(error) };
    }
  }

  if (results.length < 5) {
    try {
      const openMeteo = await searchOpenMeteo(keywords);
      diagnostics.openMeteo = { count: openMeteo.length };
      appendUnique(results, openMeteo);
    } catch (error) {
      diagnostics.openMeteo = { count: 0, error: error && error.message ? error.message : String(error) };
    }
  }

  if (results.length) {
    const providers = [...new Set(results.map((item) => item.source))];
    return apiJson({ ok: true, provider: providers.join('+'), results: results.slice(0, 10), diagnostics });
  }

  const errors = Object.entries(diagnostics)
    .filter(([, value]) => value && value.error)
    .map(([name, value]) => `${name}: ${value.error}`);

  if (errors.length && errors.length === Object.keys(diagnostics).length) {
    return apiJson({ ok: false, error: `免费搜索服务暂时不可用：${errors.join('；')}`, diagnostics }, 502);
  }

  return apiJson({ ok: true, provider: 'free-geocoding', results: [], diagnostics });
}
