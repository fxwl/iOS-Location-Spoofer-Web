export function buildRuntimeScript(token) {
  return `<script>
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

  // The original static page still follows its old AMap branch when amapKey is
  // truthy. Intercept that legacy request locally and route it to our own free
  // Photon/Nominatim/Open-Meteo endpoint before any request reaches AMap.
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

        return nativeFetch(proxy.toString(), {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store'
        })
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
}
