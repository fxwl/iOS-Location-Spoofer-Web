# ios-location-spoofer-web

📱 基于 **Shadowrocket / Loon MITM** 的 iOS GPS 模拟定位 Web 管理面板。

采用 Apple 2026 **Liquid Glass（液态玻璃）** 视觉美学设计，全屏地图选点，并支持 Cloudflare Pages + KV 完整自建托管。定位脚本、Shadowrocket 模块与 Loon 插件均由自己的 Pages 域名提供，不依赖第三方 Raw 地址。

---

## 🌟 核心特性

| | 特性 | 说明 |
|---|---|---|
| 🗺 | **多地图切换** | CartoDB / Esri 卫星 / 高德地图 / 高德卫星，支持国内外定位 |
| 🎯 | **准星锁定** | 滑动地图对准目标，点击锁定后将坐标写入服务端配置 |
| 📍 | **当前位置** | 一键回到当前物理位置并纠偏对齐 |
| 🚀 | **Shadowrocket 支持** | 动态生成自建 `.sgmodule`，自动注入域名和 Token |
| 🐦 | **Loon 完整支持** | 动态生成 `.lnplugin`，包含参数 UI、请求预处理、二进制响应改写与定时配置同步 |
| 🔒 | **完全自建托管** | 内置 `location-spoofer.js`，插件与脚本均从自己的 Pages 域名加载 |
| ⭐ | **智能收藏夹** | 保存常用地点，相同坐标自动去重 |
| 🔢 | **高级参数** | 可调海拔、水平精度、垂直精度，支持地形高度自动获取 |
| 🔍 | **坐标直跳** | 可直接输入 `39.9087, 116.3975` 一类坐标跳转 |
| 🌙 | **深色模式** | 深色/浅色模式切换并自动记忆 |
| 📲 | **PWA 支持** | Safari「添加到主屏幕」后可全屏运行 |
| ☁️ | **Cloudflare Pages** | Serverless 部署 + KV 保存坐标和收藏数据 |

---

## 🛠 快速部署（Cloudflare Pages）

### 1. 创建 KV

1. 登录 Cloudflare。
2. 进入 **Workers & Pages → KV**。
3. 创建 KV 命名空间：`SPOOFER_DATA`。

### 2. Fork 仓库并创建 Pages 项目

1. Fork 本仓库。
2. Cloudflare 中进入 **Workers & Pages → Create application → Pages → Connect to Git**。
3. 选择 Fork 后的仓库。
4. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：`exit 0`
   - **Build output directory**：`public`
5. 环境变量：
   - `TOKEN`：访问密码，建议设置；网页、Shadowrocket 和 Loon 共用。
   - `AMAP_KEY`：高德 Web 服务 Key，可选。
6. 保存并部署。

### 3. 绑定 KV

进入 Pages 项目 **Settings → Functions → KV namespace bindings**：

- Variable name：`SPOOFER_DATA`
- KV namespace：选择刚创建的 `SPOOFER_DATA`

然后重新部署一次。

部署后假设你的地址为：

```text
https://your-project.pages.dev
```

---

## 📲 Shadowrocket 配置

动态模块地址：

```text
https://你的域名/ios-location-spoofer.sgmodule?token=你的Token
```

安装流程：

1. 浏览器打开 Web 面板并登录。
2. 打开页面中的配置面板，复制 Shadowrocket 模块链接。
3. Shadowrocket → **配置 → 模块 → +**，粘贴 URL 下载。
4. 开启模块。
5. 在当前配置中开启 **HTTPS 解密 / MitM**，生成并安装 CA 证书。
6. iPhone → **设置 → 通用 → 关于本机 → 证书信任设置**，完全信任 Shadowrocket CA。
7. 开启 Shadowrocket VPN，模式保持配置模式。

模块会从你的自建域名读取：

```text
https://你的域名/loc.json?token=你的Token
```

因此网页重新锁定位置后无需重新导入模块。

---

## 🐦 Loon 配置

### 1. 获取自建 Loon 插件

部署后使用：

```text
https://你的域名/ios-location-spoofer.lnplugin?token=你的Token
```

这个地址由 Cloudflare Pages Function 动态生成，自动完成以下替换：

- `script-path` → 你的 `/location-spoofer.js`
- `configHost` → 当前 Pages 域名
- `configToken` → URL 中提供的 Token

所以正常情况下**无需手动修改插件文本**。

### 2. 添加到 Loon

1. Loon → **配置 → 插件**。
2. 点击右上角 `+`，添加上面的 `.lnplugin` URL。
3. 启用 `iOS Location Spoofer (Self-Hosted)`。
4. 进入插件参数确认：
   - **启用定位修改**：开启
   - **配置服务器**：应为你的 Pages 地址
   - **配置 Token**：应为你的 Web Token
   - 经纬度 / 精度字段只是远程配置读取失败时的备用值
5. 开启 Loon 的 MITM，并安装、信任 Loon CA 证书。

### 3. Loon 插件内部工作方式

插件包含三条任务：

- `http-request`：先把 Apple 定位请求的 `Accept-Encoding` 调整为 `identity`，避免 Loon 收到无法可靠改写的压缩响应。
- `http-response`：以 `binary-body-mode=true` 获取 `/clls/wloc` 二进制响应，修改 Wi-Fi 热点与基站定位数据，再按照 Loon 的 `$done` 响应格式写回。
- `cron`：每 15 分钟同步远程配置；如果填写了插件里的「地址搜索」，同时刷新地址解析缓存。

脚本同时兼容 Loon 的对象型 `$argument` 与传统字符串参数，并支持远程配置缓存。即使临时无法访问 Web 配置端，也可以使用最近缓存或插件里的备用经纬度。

### 4. 推荐使用方式

Loon 中建议保持：

```text
configHost = https://你的域名
configToken = 你的Token
configUrl = 留空
```

如果你希望直接指定完整配置 URL，也可以填写：

```text
https://你的域名/loc.json?token=你的Token
```

`configUrl` 的优先级高于 `configHost + configToken`。

---

## 🧭 日常使用

1. 浏览器打开 Web 面板并登录。
2. 拖动地图、搜索地点或直接输入经纬度。
3. 点击 **锁定**。
4. Web 端把最新坐标、海拔及精度保存到 KV。
5. Shadowrocket / Loon 下一次收到 Apple 定位请求时会读取最新 `loc.json` 并改写定位数据。
6. 如果系统仍显示旧位置，可关闭再打开 iPhone **定位服务**，或重新打开需要定位的 App。

> 换位置只需要重新在网页锁定，不需要重新安装模块或插件。

---

## 🔌 自建端点

| 路径 | 用途 |
|---|---|
| `/` | Web 地图管理面板 |
| `/loc.json?token=...` | 当前定位配置 |
| `/location-spoofer.js` | Shadowrocket / Loon 共用定位脚本 |
| `/ios-location-spoofer.sgmodule?token=...` | 动态 Shadowrocket 模块 |
| `/ios-location-spoofer.lnplugin?token=...` | 动态 Loon 插件 |

---

## 🧩 Loon 兼容实现说明

本仓库对 Loon 的支持不仅是增加一个 `.lnplugin` 文件，还包含运行时适配：

- `[Argument]` 参数 UI 与 `argument=[{...}]` 参数传递。
- `$argument` 字符串 / 对象两种形式兼容。
- `$environment.product` / `$loon` 运行时识别。
- Loon 二进制 HTTP response 的 `$done({ status, headers, body })` 写回格式。
- Apple 定位响应压缩规避与请求预处理。
- `configHost + configToken` 自动组合远程 `loc.json`。
- 远程配置 5 分钟本地缓存及 cron 刷新。
- 地址解析与海拔缓存能力。
- 脚本异常时默认 fail-open，避免定位服务请求被直接阻断。

---

## ⚖️ 声明与鸣谢

1. iOS 定位数据的拆包、protobuf 改写及 Loon 兼容思路来源于 `mekos2772/ios-location-spoofer`，感谢原作者的开源工作。
2. 本项目主要增加自建 Web 管理、Cloudflare Pages/KV、动态配置与自托管插件能力。
3. 本项目仅用于地图开发测试、地理位置接口调试及技术研究。请遵守所在地法律法规及相关服务条款。

---

## 📄 License

MIT License
