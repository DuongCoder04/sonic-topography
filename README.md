# Sonic Topography

中文 | [English](./README.en.md)

[下载最新版 Release](https://github.com/yin-yizhen/sonic-topography/releases/tag/1.1.1) | [Windows 版](https://github.com/yin-yizhen/sonic-topography/releases/download/1.1.1/SonicTopography-1.1.1-Setup.exe) | [macOS Apple 芯片版](https://github.com/yin-yizhen/sonic-topography/releases/download/1.1.1/SonicTopography-1.1.1-mac-arm64.dmg) | [macOS Intel 芯片版](https://github.com/yin-yizhen/sonic-topography/releases/download/1.1.1/SonicTopography-1.1.1-mac-x64.dmg)

Sonic Topography 是一个桌面音乐播放器和 3D 音乐可视化应用。它会把音乐里的低频、中频、高频转换成会起伏、发光、闪烁的立体地形，让听歌变成一块正在呼吸的声音地图。

> 使用限制：本项目仅供学习、研究和个人非商业体验使用。未经作者明确许可，不得用于商业项目、商业演出、商业展示、付费服务、二次销售或任何营利用途。

![Sonic Topography 桌面端主界面](./public/screenshots/desktop-visualizer.png)

## 主要功能

- 桌面应用端：基于 Electron，打开后就是独立窗口，不需要一直挂着浏览器页面。
- 3D 音乐地形：音乐频段会驱动地面柱体、光效、涟漪、流星和歌词显示。
- 本地音乐播放：支持上传本地音频，也可以搭配 `.lrc` 歌词文件。
- 内置 Demo：第一次打开不用准备音乐，也能直接看到可视化效果。
- 网易云音乐：支持在桌面端打开官方登录窗口，扫码后读取本机 Cookie，用于搜索、歌单、每日推荐和播放。
- QQ 音乐：支持在桌面端打开官方登录窗口，扫码后读取 QQ 音乐 Cookie，用于搜索、播放和歌词。
- 本地歌单：可以把喜欢的歌曲保存到本地歌单。
- 更人性化的地面 EQ：用 8 个频段推子分别控制不同声音对地形的影响。
- 时间显示和番茄钟：可以把视觉画面切换成更适合专注、工作和休息的显示方式。
- 预设迁移：支持导入、导出歌单、特效、地面 EQ、自定义主题和浏览器设置。

## OS 版本

- Windows：下载 [SonicTopography-1.1.1-Setup.exe](https://github.com/yin-yizhen/sonic-topography/releases/download/1.1.1/SonicTopography-1.1.1-Setup.exe)。
- macOS Apple 芯片：下载 [SonicTopography-1.1.1-mac-arm64.dmg](https://github.com/yin-yizhen/sonic-topography/releases/download/1.1.1/SonicTopography-1.1.1-mac-arm64.dmg)，适用于 M1/M2/M3/M4 等 Apple 芯片。
- macOS Intel 芯片：下载 [SonicTopography-1.1.1-mac-x64.dmg](https://github.com/yin-yizhen/sonic-topography/releases/download/1.1.1/SonicTopography-1.1.1-mac-x64.dmg)，适用于 Intel 芯片 Mac。
- macOS DMG 是独立应用，已内置运行环境；新电脑不需要安装 Python、Node 或项目依赖。
- macOS 第一次打开时，先打开 DMG，把 `Sonic Topography.app` 拖到 `Applications` 后再运行。
- 第一次使用麦克风功能时，macOS 会弹出系统麦克风权限确认，请选择允许。

## 快速开始

如果你只是使用应用：

1. 下载并安装 Windows 安装包。
2. 打开 `Sonic Topography`。
3. 点击左上角 `AJIN.` 打开侧边栏。
4. 可以先点 `示例` 播放内置 Demo，确认画面和声音正常。
5. 想播放自己的音乐时，点击 `上传` 选择本地音频文件。
6. 想使用网易云或 QQ 音乐时，进入 `设置 -> 账号登录`，按提示打开官方窗口扫码登录。

## 界面入口

点击左上角 `AJIN.` 可以打开侧边栏。

- `可视化`：关闭面板，回到 3D 音乐地形画面。
- `设置`：打开可视化、地面 EQ、主题、账号登录和显示相关设置。
- `搜索`：搜索网易云音乐和 QQ 音乐。
- `网易云`：保存有效网易云 Cookie 后出现，可进入喜欢、歌单和每日推荐。
- `歌单`：打开本地保存的歌单。
- `示例`：播放内置 Demo。
- `上传`：选择本地音频或 `.lrc` 歌词。
- `全屏`：进入或退出全屏显示。

## 地面 EQ

地面 EQ 用来控制音乐的不同频段如何影响 3D 地形。它不是传统意义上只改变声音的均衡器，而是一个面向视觉效果的“地面特效混音台”。

![更人性化的自定义地面 EQ](./public/screenshots/ground-eq.png)

每个推子对应一种视觉性格：

- `SUB BASS / 中心抬升`：让低频更集中地推动地面中心。
- `BASS / 低频重量`：控制低频带来的厚重感。
- `LOW MID / 慢波流动`：让地形出现更缓慢的波动。
- `MID / 方向流`：控制中频带来的方向性起伏。
- `HIGH MID / 尖峰`：让节奏和亮点更容易形成凸起。
- `PRESENCE / 闪光触发`：控制局部闪光和高亮。
- `BRILLIANCE / 边缘微闪`：增强细碎、轻盈的边缘闪烁。
- `AIR / 空气颗粒`：控制更高频、更轻的颗粒感。

上方的 `起伏速度` 会影响地形升起和回落的速度。数值越高，地面越敏捷；数值越低，视觉会更柔和。

## 时间显示和番茄钟

Sonic Topography 也可以作为桌面专注背景使用。开启时间显示后，画面会在 3D 地形上叠加大号时间；配合番茄钟，可以用于工作、学习、阅读或休息计时。

![时间显示和番茄钟](./public/screenshots/focus-clock.png)

推荐用法：

1. 播放一首适合专注的音乐或环境音。
2. 打开时间显示。
3. 按自己的节奏启动番茄钟。
4. 进入全屏，让它成为一个轻量的专注桌面。

## 账号登录

打开 `设置 -> 账号登录`，选择 `网易云` 或 `QQ 音乐`。

在 Electron 桌面版里，点击 `打开官方窗口扫码` 会弹出官方网页登录窗口。扫码成功后，应用会自动读取当前登录窗口的 Cookie，并同步到本地代理服务。

在普通浏览器开发页面里，扫码登录不可用；手动 Cookie 文本框只作为降级调试入口。

Cookie 是敏感登录凭据，只保存在本机。不要导出、上传或分享自己的 Cookie。

## 预设导入导出

在设置中可以导入或导出预设。预设适合在不同电脑之间迁移自己的视觉习惯。

可以迁移的内容包括：

- 歌单
- 脉冲特效
- 流星特效
- 地面 EQ
- 自定义主题
- 浏览器设置

导出时可以选择是否包含 Cookie。一般不建议包含 Cookie，除非你非常清楚自己在做什么，并且只在自己的设备之间迁移。

## 本地数据

- 主题、特效、地面 EQ、账号 Cookie 和多数设置保存在本机。
- 开发源码运行时，本地歌单会通过 `/api/playlists` 保存到 `data/playlists.json`。
- 打包后的桌面应用会把本地服务数据保存到 Electron 用户数据目录。
- 上传的真实音频文件不会写入预设文件，也不会被打包进安装包。

## 开发运行

安装依赖：

```powershell
npm install
```

日常开发建议使用 Electron 模式：

```powershell
npm run dev:electron
```

这个命令会启动 Vite dev server，然后打开 Electron 窗口。修改 `src/`、CSS、React 组件和设置页 UI 时，一般会热更新。

如果只想在浏览器里调 UI：

```powershell
npm run dev
```

浏览器地址：

```text
http://127.0.0.1:3000
```

修改这些内容后通常需要重启 Electron：

- `desktop/main.js`
- `desktop/preload.cjs`
- Electron 打包配置、窗口行为、IPC 登录桥接
- 本地服务和代理相关代码

## 打包

发布前运行：

```powershell
npm run build:electron
```

生成的 Windows 安装包位于：

```text
release/
```

如果只想生成可运行目录、不生成安装器：

```powershell
npm run build:electron:dir
```

## 常用命令

```powershell
npm run dev:electron
npm run lint
npm run build
npm run build:electron:dir
npm run build:electron
```

## 注意事项

- 网易云和 QQ 音乐播放结果可能受版权、会员、地区和账号状态影响。
- 搜索结果只会展示当前匿名状态或当前 Cookie 权限下可访问的内容。
- 不要提交 `dist/`、`release/`、本地 `data/`、更新下载目录或账号 Cookie。
- 如果遇到音乐能搜到但不能播，优先检查账号状态、歌曲版权和当前音质是否可用。

## 请作者喝杯咖啡

如果你觉得 Sonic Topography 还不错，或者它刚好陪你完成了一段工作、学习或创作，可以请作者喝杯咖啡。

全部收益都会用于购买 token 和相关服务，继续优化应用、修 bug、做新功能和改善体验。

![请作者喝杯咖啡](./public/screenshots/coffee-qr.png)

感谢每一次支持。这个项目会继续慢慢长大。
