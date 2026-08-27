/**
 * iOS Location Spoofer Web
 *
 * Copyright (c) 2026 akudamatata (https://github.com/akudamatata/iOS-Location-Spoofer-Web)
 * Licensed under CC BY-NC-SA 4.0
 * ⚠️【特别声明】：本项目完全免费开源，严禁以任何形式进行二次售卖、转售、商业收费代搭建！
 */

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
  return values.map(textValue).map((v) => v.trim()).filter(Boolean)
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

async function fetchJson(url) {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'iOS-Location-Spoofer-Web/1.0'
    }
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(`HTTP ${response.status} 返回了非 JSON 数据`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return data;
}

async function searchPhoton(keywords) {
  const endpoint = new URL('https://photon.komoot.io/api/');
  endpoint.searchParams.set('q', keywords.slice(0, 120));
  endpoint.searchParams.set('limit', '10');
  endpoint.searchParams.set('lang', 'zh');

  const data = await fetchJson(endpoint);
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
      p.district
    ]).join(' · ');
    const district = uniqueText([p.city, p.county, p.state, p.country]).join('');
    return { name, address, district, location: legacyLocation(lat, lng) };
  }).filter(Boolean).slice(0, 10);
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
      location: legacyLocation(lat, lng)
    };
  }).filter(Boolean).slice(0, 10);
}

async function handleFreeSearch(env, url) {
  const token = url.searchParams.get('token');
  if (env.TOKEN && token !== env.TOKEN) {
    return apiJson({ ok: false, error: 'Unauthorized' }, 401);
  }

  const keywords = (url.searchParams.get('keywords') || '').trim();
  if (!keywords) return apiJson({ ok: false, error: '请输入搜索关键词' }, 400);

  let photonError = '';
  try {
    const results = await searchPhoton(keywords);
    if (results.length) return apiJson({ ok: true, provider: 'photon', results });
  } catch (error) {
    photonError = error && error.message ? error.message : String(error);
  }

  let openMeteoError = '';
  try {
    const results = await searchOpenMeteo(keywords);
    if (results.length) return apiJson({ ok: true, provider: 'open-meteo', results });
  } catch (error) {
    openMeteoError = error && error.message ? error.message : String(error);
  }

  if (photonError && openMeteoError) {
    return apiJson({
      ok: false,
      error: `免费搜索服务暂时不可用：Photon ${photonError}；Open-Meteo ${openMeteoError}`
    }, 502);
  }

  return apiJson({ ok: true, provider: photonError ? 'open-meteo' : 'photon', results: [] });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);

  if (requestUrl.searchParams.get('__api') === 'search') {
    return handleFreeSearch(env, requestUrl);
  }

  const response = await env.ASSETS.fetch(request);
  if (!response.ok) return response;

  const token = env.TOKEN || '';

  const runtimeScript = `<script>
window.__CFG__=${JSON.stringify({ token, amapKey: 'free-osm' })};
(function(){
  'use strict';
  var nativeFetch = window.fetch.bind(window);
  var serverToken = ${JSON.stringify(token)};
  var searchError = '';

  function escapeHtml(value){
    return String(value || '').replace(/[&<>\\"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function parseProxyResponse(resp){
    return resp.text().then(function(text){
      var data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        var preview = String(text || '').replace(/\\s+/g, ' ').slice(0, 120);
        throw new Error('搜索接口返回了非 JSON 数据 (HTTP ' + resp.status + ')' + (preview ? '：' + preview : ''));
      }
      return { resp: resp, data: data };
    });
  }

  // Compatibility shim: the original static page uses the old AMap branch when
  // amapKey is truthy. We intercept that request before it leaves the browser and
  // send it to our own free Photon/Open-Meteo search endpoint instead.
  window.fetch = function(input, init){
    var raw = typeof input === 'string' ? input : (input && input.url) || '';
    if (raw.indexOf('https://restapi.amap.com/v3/assistant/inputtips?') === 0) {
      try {
        var source = new URL(raw);
        var keywords = source.searchParams.get('keywords') || '';
        var proxy = new URL('/', window.location.origin);
        proxy.searchParams.set('__api', 'search');
        proxy.searchParams.set('keywords', keywords);
        var authToken = localStorage.getItem('gps_token') || serverToken || '';
        if (authToken) proxy.searchParams.set('token', authToken);
        proxy.searchParams.set('_ts', String(Date.now()));

        return nativeFetch(proxy.toString(), { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
          .then(parseProxyResponse)
          .then(function(result){
            var resp = result.resp;
            var data = result.data;
            if (!resp.ok || !data || data.ok !== true) {
              searchError = (data && data.error) || ('免费搜索失败 (HTTP ' + resp.status + ')');
              return new Response(JSON.stringify({status:'0',info:searchError,tips:[]}), {
                status: 200,
                headers: {'Content-Type':'application/json'}
              });
            }
            searchError = '';
            return new Response(JSON.stringify({status:'1',info:'OK',tips:data.results || []}), {
              status: 200,
              headers: {'Content-Type':'application/json'}
            });
          })
          .catch(function(error){
            searchError = '免费搜索请求失败：' + (error && error.message ? error.message : String(error));
            return new Response(JSON.stringify({status:'0',info:searchError,tips:[]}), {
              status: 200,
              headers: {'Content-Type':'application/json'}
            });
          });
      } catch (error) {
        searchError = '免费搜索请求失败：' + (error && error.message ? error.message : String(error));
      }
    }
    return nativeFetch(input, init);
  };

  document.addEventListener('DOMContentLoaded', function(){
    var resultBox = document.getElementById('search-results');
    if (resultBox && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function(){
        if (searchError && /未找到结果|搜索失败|无有效定位结果/.test(resultBox.textContent || '')) {
          resultBox.innerHTML = '<div class="result-row"><div class="name">免费搜索不可用</div><div class="sub">' + escapeHtml(searchError) + '</div></div>';
          searchError = '';
        }
      }).observe(resultBox, {childList:true, subtree:true});
    }

    var panel = document.getElementById('config-panel');
    var content = document.getElementById('config-content');
    var configButton = document.getElementById('config-btn');
    var importButton = document.getElementById('btn-config-import');
    var urlText = document.getElementById('config-url-text');
    var argText = document.getElementById('config-arg-text');
    if (!panel || !content || !importButton || !urlText) return;

    if (configButton) configButton.setAttribute('aria-label', '客户端配置');

    var style = document.createElement('style');
    style.textContent = '#client-switch{display:flex;gap:8px;padding:4px 0 14px}.client-switch-btn{flex:1;height:38px;border:1px solid rgba(60,60,67,.14);border-radius:11px;background:rgba(255,255,255,.45);color:var(--text);font-size:13px;font-weight:600;cursor:pointer}.client-switch-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}';
    document.head.appendChild(style);

    var switcher = document.createElement('div');
    switcher.id = 'client-switch';
    switcher.innerHTML = '<button class="client-switch-btn" data-client="shadowrocket">Shadowrocket</button><button class="client-switch-btn" data-client="loon">Loon</button>';
    content.insertBefore(switcher, content.firstChild);

    var sections = content.querySelectorAll('.config-section');
    var title = panel.querySelector('#config-panel-header h2');
    var selected = localStorage.getItem('ios_spoofer_client') || 'shadowrocket';

    function currentToken(){
      return localStorage.getItem('gps_token') || serverToken || '';
    }
    function resourceUrl(client){
      var suffix = client === 'loon' ? '/ios-location-spoofer.lnplugin' : '/ios-location-spoofer.sgmodule';
      var value = window.location.origin + suffix;
      var t = currentToken();
      return value + (t ? '?token=' + encodeURIComponent(t) : '');
    }
    function render(client){
      selected = client === 'loon' ? 'loon' : 'shadowrocket';
      localStorage.setItem('ios_spoofer_client', selected);
      switcher.querySelectorAll('.client-switch-btn').forEach(function(btn){
        btn.classList.toggle('active', btn.dataset.client === selected);
      });

      var url = resourceUrl(selected);
      urlText.textContent = url;
      if (selected === 'loon') {
        if (title) title.textContent = 'Loon 配置';
        if (sections[0]) {
          sections[0].querySelector('.config-title').textContent = '方法 A：一键导入 Loon 插件';
          sections[0].querySelector('.config-desc').textContent = '点击下方按钮直接唤起 Loon，并导入已经绑定当前自建域名与 Token 的插件。';
          sections[0].querySelector('.config-action-btn').textContent = '一键导入 Loon 插件';
        }
        if (sections[1]) {
          sections[1].querySelector('.config-title').textContent = '方法 B：手动复制插件链接';
          sections[1].querySelector('.config-desc').textContent = '也可以复制此链接，在 Loon 的插件页面中通过 URL 手动添加。';
        }
        if (sections[2]) sections[2].style.display = 'none';
      } else {
        if (title) title.textContent = 'Shadowrocket 配置';
        if (sections[0]) {
          sections[0].querySelector('.config-title').textContent = '方法 A：一键导入小火箭模块';
          sections[0].querySelector('.config-desc').textContent = '最推荐的方式。点击下方按钮即可唤醒手机上的 Shadowrocket 自动导入到【模块】列表中。';
          sections[0].querySelector('.config-action-btn').textContent = '一键导入模块';
        }
        if (sections[1]) {
          sections[1].querySelector('.config-title').textContent = '方法 B：手动复制模块链接';
          sections[1].querySelector('.config-desc').textContent = '复制下方模块链接，在 Shadowrocket 的【配置】→【模块】中通过 URL 添加。';
        }
        if (sections[2]) sections[2].style.display = '';
        if (argText) argText.textContent = 'configUrl=' + window.location.origin + '/loc.json' + (currentToken() ? '?token=' + encodeURIComponent(currentToken()) : '');
      }
    }

    switcher.addEventListener('click', function(event){
      var btn = event.target.closest('.client-switch-btn');
      if (btn) render(btn.dataset.client);
    });

    importButton.addEventListener('click', function(event){
      if (selected !== 'loon') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = 'loon://import?plugin=' + encodeURIComponent(resourceUrl('loon'));
    }, true);

    if (configButton) {
      configButton.addEventListener('click', function(){
        setTimeout(function(){ render(selected); }, 0);
      });
    }
    render(selected);
  });
})();
</script>`;

  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(runtimeScript, { html: true });
      }
    })
    .transform(response);
}
