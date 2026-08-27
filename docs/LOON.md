# Loon 使用说明

本项目支持通过自建 Cloudflare Pages 域名直接生成 Loon 插件，无需引用 GitHub Raw 脚本。

## 一键导入

1. 打开 Web 面板并完成 Token 登录。
2. 打开左侧「客户端配置」。
3. 切换到 **Loon**。
4. 点击「一键导入 Loon 插件」。
5. 在 Loon 中确认导入，并开启插件。
6. 确认 Loon 已安装并信任 MITM 证书。

也可以手动添加：

`https://你的域名/ios-location-spoofer.lnplugin?token=你的Token`

动态插件会自动把当前域名与 Token 写入 `configUrl`，脚本每次拦截定位响应时会读取 Web 面板的 `/loc.json`。另外每 15 分钟会刷新一次远程配置缓存。

## Loon 插件包含的能力

- `http-request` 预处理：强制 `Accept-Encoding: identity`，减少二进制响应被压缩后无法改写的问题。
- `http-response`：以 `binary-body-mode=true` 拦截 Apple `/clls/wloc` 响应并改写坐标。
- 远程配置：优先使用 Web 面板锁定的坐标、精度和海拔。
- 备用参数：远程配置不可用时使用插件参数中的经纬度等备用值。
- 定时同步：每 15 分钟刷新远程配置缓存。
- Loon 专用 `$done` 二进制响应结构兼容。

## 免费地点搜索

Web 面板的地点搜索不再依赖高德 API，也不需要配置 `AMAP_KEY`。

搜索顺序：

1. **Photon / OpenStreetMap**：作为主搜索源，支持地点与 POI 搜索。
2. **Open-Meteo Geocoding**：Photon 没有结果或暂时不可用时自动兜底。

两个服务都无需 API Key。搜索结果原始坐标为 WGS84，Pages Function 会在国内区域自动转换为页面现有地图逻辑所需的 GCJ-02 坐标，因此切换高德图层、OSM 或 Esri 图层时不会因为坐标系不同再次产生偏移。

Cloudflare Pages 中只需要保留 `TOKEN` 与 `SPOOFER_DATA` 等项目自身配置；以前设置过的 `AMAP_KEY` 可以删除，也可以保留（当前代码不会读取它）。
