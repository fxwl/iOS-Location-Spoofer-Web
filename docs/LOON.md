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

## 高德搜索

`AMAP_KEY` 必须使用高德开放平台申请的 **Web 服务 API** 类型 Key，而不是 Web 端 JS API Key。

本项目的搜索请求由 Cloudflare Pages Functions 的 `/search` 端点在服务端调用高德 POI 关键字搜索，浏览器不再直接暴露 `AMAP_KEY`。如果 Key 无效、权限不足或被限流，面板会直接显示高德返回的错误信息，而不是统一显示“未找到结果”。
