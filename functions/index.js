export async function onRequestGet(context) {
  const { request, env } = context;

  // Fetch the static index.html from Cloudflare Pages ASSETS
  const response = await env.ASSETS.fetch(request);
  if (!response.ok) {
    return response;
  }

  const token = env.TOKEN || '';
  const amapKey = env.AMAP_KEY || '';

  const configScript = `<script>window.__CFG__=${JSON.stringify({ token, amapKey })};</script>`;
  const loonUiScript = `<script>
(function () {
  function currentToken() {
    try {
      return localStorage.getItem('gps_token') || (window.__CFG__ && window.__CFG__.token) || '';
    } catch (e) {
      return (window.__CFG__ && window.__CFG__.token) || '';
    }
  }

  function loonPluginUrl() {
    return window.location.origin + '/ios-location-spoofer.lnplugin?token=' + encodeURIComponent(currentToken());
  }

  function refreshLoonUrl() {
    var box = document.getElementById('loon-config-url-text');
    if (box) box.textContent = loonPluginUrl();
  }

  function copyText(value, successText) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        if (typeof toast === 'function') toast(successText);
      }).catch(function () {
        if (typeof toast === 'function') toast('复制失败，请手动选择复制');
      });
      return;
    }
    var input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      if (typeof toast === 'function') toast(successText);
    } finally {
      document.body.removeChild(input);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.getElementById('config-panel');
    var content = document.getElementById('config-content');
    if (!panel || !content || document.getElementById('loon-config-section')) return;

    var title = panel.querySelector('#config-panel-header h2');
    if (title) title.textContent = 'Shadowrocket / Loon 配置';

    var section = document.createElement('div');
    section.className = 'config-section';
    section.id = 'loon-config-section';
    section.innerHTML =
      '<div class="config-title">Loon：自建插件</div>' +
      '<div class="config-desc">复制下面的插件 URL，在 Loon 的【配置 → 插件】中通过右上角【+】添加。域名与 Token 会自动写入插件。</div>' +
      '<div class="config-code-box" id="loon-config-url-text"></div>' +
      '<button class="config-action-btn" id="btn-loon-copy-url">复制 Loon 插件链接</button>';

    var darkSection = content.lastElementChild;
    if (darkSection) content.insertBefore(section, darkSection);
    else content.appendChild(section);

    refreshLoonUrl();

    document.getElementById('btn-loon-copy-url').addEventListener('click', function () {
      refreshLoonUrl();
      copyText(loonPluginUrl(), 'Loon 插件链接已复制');
    });

    var configButton = document.getElementById('config-btn');
    if (configButton) {
      configButton.setAttribute('aria-label', 'Shadowrocket / Loon 配置');
      configButton.addEventListener('click', function () {
        setTimeout(refreshLoonUrl, 0);
      });
    }
  });
}());
</script>`;

  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(configScript, { html: true });
        element.append(loonUiScript, { html: true });
      }
    })
    .transform(response);
}
