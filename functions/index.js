/**
 * iOS Location Spoofer Web
 *
 * Copyright (c) 2026 akudamatata (https://github.com/akudamatata/iOS-Location-Spoofer-Web)
 * Licensed under CC BY-NC-SA 4.0
 * ⚠️【特别声明】：本项目完全免费开源，严禁以任何形式进行二次售卖、转售、商业收费代搭建！
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const response = await env.ASSETS.fetch(request);

  if (!response.ok) {
    return response;
  }

  const token = env.TOKEN || '';
  const hasAmap = Boolean(env.AMAP_KEY);

  // Do not expose the real AMap key to the browser. The existing UI only needs a
  // truthy value to enable the AMap search path; requests are transparently routed
  // through the same-origin /search Pages Function below.
  const runtimeScript = `<script>
window.__CFG__=${JSON.stringify({ token, amapKey: hasAmap ? 'server-proxy' : '' })};
(function(){
  'use strict';
  var nativeFetch = window.fetch.bind(window);
  var serverToken = ${JSON.stringify(token)};
  var amapError = '';

  function escapeHtml(value){
    return String(value || '').replace(/[&<>\"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  window.fetch = function(input, init){
    var raw = typeof input === 'string' ? input : (input && input.url) || '';
    if (raw.indexOf('https://restapi.amap.com/v3/assistant/inputtips?') === 0) {
      try {
        var source = new URL(raw);
        var keywords = source.searchParams.get('keywords') || '';
        var proxy = new URL('/search', window.location.origin);
        proxy.searchParams.set('keywords', keywords);
        var authToken = localStorage.getItem('gps_token') || serverToken || '';
        if (authToken) proxy.searchParams.set('token', authToken);

        return nativeFetch(proxy.toString(), { method: 'GET', credentials: 'same-origin' })
          .then(function(resp){
            return resp.json().then(function(data){
              if (!resp.ok || !data || data.ok !== true) {
                amapError = (data && data.error) || ('高德搜索失败 (HTTP ' + resp.status + ')');
                return new Response(JSON.stringify({status:'0',info:amapError,tips:[]}), {
                  status: 200,
                  headers: {'Content-Type':'application/json'}
                });
              }
              amapError = '';
              return new Response(JSON.stringify({status:'1',info:'OK',tips:data.results || []}), {
                status: 200,
                headers: {'Content-Type':'application/json'}
              });
            });
          })
          .catch(function(error){
            amapError = '高德搜索请求失败：' + (error && error.message ? error.message : String(error));
            throw error;
          });
      } catch (_) {
        // Fall through to the original fetch implementation.
      }
    }
    return nativeFetch(input, init);
  };

  document.addEventListener('DOMContentLoaded', function(){
    var resultBox = document.getElementById('search-results');
    if (resultBox && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function(){
        if (amapError && /未找到结果|搜索失败|无有效定位结果/.test(resultBox.textContent || '')) {
          resultBox.innerHTML = '<div class="result-row"><div class="name">高德搜索不可用</div><div class="sub">' + escapeHtml(amapError) + '</div></div>';
          amapError = '';
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

    // Capture phase is required so the original Shadowrocket click handler does not
    // run when Loon is selected.
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
