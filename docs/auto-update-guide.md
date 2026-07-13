# Electron Windows 自动更新小白教程

这份文档用 Sonic Topography 现在的做法当例子，教你理解和复用一套适合 Electron Windows 应用的“半自动更新”方案。

这里说的半自动更新不是后台偷偷替换程序，而是：

```text
用户打开旧版软件
-> 软件自动检查 GitHub Release
-> 如果发现更高版本，弹窗告诉用户
-> 弹窗显示 Release 正文，也就是更新日志
-> 用户点击立即更新
-> 软件下载新版安装包
-> 下载完成后打开安装包
-> 用户按安装器完成更新
```

这种方式简单、透明、好排查，也适合现在用 NSIS 打包出来的 `.exe` 安装包。

## 1. 先搞懂几个词

### 源码

源码就是 GitHub 仓库里的代码，比如 `src/`、`server/`、`desktop/`、`package.json`。

你把代码 push 到 GitHub，只是让开发者能看到新代码。已经安装软件的普通用户不会因为你 push 代码就自动更新。

### 安装包

安装包就是用户真正下载和安装的 `.exe` 文件。Sonic Topography 的安装包名字类似：

```text
SonicTopography-1.1.4-Setup.exe
```

用户的软件要更新，最终靠的是这个安装包，不是源码。

### 版本号 version

版本号写在 `package.json`：

```json
"version": "1.1.4"
```

软件检查更新时会比较：

```text
当前安装的软件版本
GitHub Release 最新版本
```

如果 GitHub 最新版本更高，比如当前是 `1.1.4`，GitHub 是 `1.1.5`，才会提示更新。

如果你代码改了很多，但版本号还是 `1.1.4`，旧版用户不会看到更新提示。

### GitHub Release

GitHub Release 是给用户发布安装包的地方。它通常包含：

- tag，比如 `v1.1.4`
- Release 标题，比如 `Sonic Topography v1.1.4`
- Release 正文，也就是更新日志
- 附件，也就是 `.exe` 安装包

Sonic Topography 的更新逻辑会去 GitHub API 查询最新 Release。

### tag

tag 是 Release 对应的版本标签。建议固定写成：

```text
v1.1.4
```

也就是 `v` 加上 `package.json` 里的 version。

### 更新日志

更新日志就是你在 GitHub Release 正文里写的内容，例如：

```md
## 更新内容

- 新增多个内置主题
- 修复更新下载进度卡在 0 的问题
- 优化歌词显示
```

Sonic Topography 的更新弹窗会读取 Release 正文并显示给用户。

### 镜像站

有些用户访问 GitHub 很慢，下载可能一直 0%。镜像站就是下载时额外尝试的加速地址。

Sonic Topography 现在配置在 `package.json`：

```json
"downloadMirrors": [
  {
    "name": "GH Proxy",
    "prefix": "https://gh-proxy.com/"
  },
  {
    "name": "GHFast",
    "prefix": "https://ghfast.top/"
  }
]
```

下载顺序大概是：

```text
GitHub 直连
-> GH Proxy
-> GHFast
```

镜像是第三方服务，不保证永远稳定，所以程序要能失败后自动换下一个。

## 2. Sonic Topography 现在的自动更新怎么跑

核心文件：

```text
package.json
server/update-service.mjs
src/components/UI/UI.tsx
src/lib/updatePrompt.ts
desktop/main.js
desktop/preload.cjs
```

### 2.1 版本和仓库配置

`package.json` 里有当前版本和 GitHub 更新源：

```json
{
  "version": "1.1.4",
  "sonicTopography": {
    "update": {
      "provider": "github",
      "owner": "yin-yizhen",
      "repo": "sonic-topography"
    }
  }
}
```

意思是：

```text
当前软件版本 = package.json version
最新版本来源 = https://github.com/yin-yizhen/sonic-topography/releases/latest
```

### 2.2 打包安装包

`package.json` 里的打包命令是：

```powershell
npm run build:electron
```

它实际做两件事：

```text
npm run build
electron-builder --win nsis
```

安装包输出到：

```text
release/
```

文件名模板是：

```text
SonicTopography-${version}-Setup.exe
```

比如 version 是 `1.1.4`，输出就是：

```text
release/SonicTopography-1.1.4-Setup.exe
```

### 2.3 应用启动后检查更新

前端 `src/components/UI/UI.tsx` 会在启动后延迟检查：

```text
GET /api/update/latest
```

这个接口由 `server/update-service.mjs` 提供。

它会做这些事：

```text
读取 package.json 当前版本
-> 请求 GitHub 最新 Release
-> 解析最新 tag/version
-> 找 Release 附件里的 .exe 安装包
-> 比较 GitHub 版本是否大于当前版本
-> 返回给前端
```

### 2.4 有新版本时弹窗

如果接口返回有新版本，前端会弹出更新窗口。

弹窗显示：

- 当前版本
- 最新版本
- Release 标题
- 发布时间
- Release 正文，也就是更新内容
- 下载进度
- 当前下载通道

弹窗按钮有：

- `立即更新`
- `下次提醒`
- `不再提示这个版本`

`不再提示这个版本` 存在 localStorage 里，key 是：

```text
sonic-topography-skipped-update-version-v1
```

注意：只是不提示这个版本。如果以后有更高版本，还是会提示。

### 2.5 用户点击立即更新

点击后前端请求：

```text
POST /api/update/download
```

后端会：

```text
重新检查 GitHub 最新 Release
-> 找到 .exe 下载地址
-> 生成下载任务
-> 先试 GitHub 直连
-> 失败就试镜像
-> 边下载边记录 received 字节数
-> 下载完检查文件大小
-> 检查 Windows 安装包 MZ 文件头
```

前端每秒轮询：

```text
GET /api/update/download/status?id=<jobId>
```

这样 UI 才能显示实时下载进度。

### 2.6 下载完成后打开安装包

下载完成后，前端通过 `window.sonicDesktop.openUpdateInstaller(filePath)` 调用 Electron 主进程。

相关桥接在：

```text
desktop/preload.cjs
desktop/main.js
```

主进程会检查安装包路径必须在允许的更新下载目录里，然后用系统方式打开安装包。

用户看到安装器后，自己点击下一步完成安装。

## 3. 你每次发新版本应该怎么做

下面用 `1.1.4 -> 1.1.5` 举例。

### 第 1 步：确认代码已经改好

先本地运行或检查你改的功能。比如：

```powershell
npm run dev:electron
```

如果只是普通前端逻辑，也可以跑：

```powershell
npm run build
```

### 第 2 步：改版本号

推荐用命令改：

```powershell
npm version 1.1.5 --no-git-tag-version
```

它会同时改：

```text
package.json
package-lock.json
```

你也可以手动改，但容易漏 `package-lock.json`。

### 第 3 步：跑验证

基础验证：

```powershell
npm run lint
npm run build
```

如果改了更新功能，再跑：

```powershell
npx tsx src/lib/updateSource.test.ts
npx tsx src/lib/updatePrompt.test.ts
npx tsx server/update-service.test.mjs
```

### 第 4 步：提交并推送源码

```powershell
git status --short
git add .
git commit -m "Prepare Sonic Topography 1.1.5 release"
git push origin master
```

注意：推源码只是让 GitHub 仓库变新，还不会让用户软件更新。

### 第 5 步：打包安装包

```powershell
npm run build:electron
```

成功后看 `release/` 目录，应该有：

```text
SonicTopography-1.1.5-Setup.exe
SonicTopography-1.1.5-Setup.exe.blockmap
latest.yml
```

Sonic Topography 当前自定义更新逻辑主要读 GitHub Release 的 `.exe` 附件和正文。`latest.yml` 是 electron-builder 生成的元数据，可以保留，但核心是上传 `.exe`。

### 第 6 步：创建 GitHub Release

进入 GitHub 仓库：

```text
Releases -> Draft a new release
```

填写：

```text
Tag: v1.1.5
Title: Sonic Topography v1.1.5
```

上传附件：

```text
SonicTopography-1.1.5-Setup.exe
```

Release 正文写更新日志，例如：

```md
## 更新内容

- 新增 xxx
- 修复 xxx
- 优化 xxx
```

然后点击发布 Release。

### 第 7 步：验证旧版能看到更新

要用旧版本验证，比如本机安装的是 `1.1.4`，GitHub Release 是 `v1.1.5`。

打开旧版后应该看到：

```text
发现新版本 1.1.5
```

如果没有弹窗，可以在应用设置里手动点检查更新。

## 4. 别的 Electron Windows 应用怎么照搬

如果你以后做另一个 Electron Windows 应用，可以照这个最小清单做。

### 4.1 打包方式

推荐仍然用：

```text
electron-builder + NSIS
```

`package.json` 里至少要有：

```json
{
  "version": "1.0.0",
  "build": {
    "directories": {
      "output": "release"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "artifactName": "YourApp-${version}-Setup.${ext}"
    }
  }
}
```

### 4.2 更新源配置

给你的应用加一段自己的配置，例如：

```json
{
  "yourApp": {
    "update": {
      "provider": "github",
      "owner": "your-github-name",
      "repo": "your-repo-name",
      "downloadMirrors": [
        {
          "name": "GH Proxy",
          "prefix": "https://gh-proxy.com/"
        },
        {
          "name": "GHFast",
          "prefix": "https://ghfast.top/"
        }
      ]
    }
  }
}
```

### 4.3 后端更新服务

需要一个本地服务模块，职责是：

```text
GET /api/update/latest
-> 查 GitHub latest release
-> 比较版本
-> 返回是否有更新、Release 正文、安装包下载地址

POST /api/update/download
-> 开始下载 .exe
-> 生成下载任务 id

GET /api/update/download/status?id=...
-> 返回下载进度、状态、错误信息
```

Sonic Topography 的参考文件：

```text
server/update-service.mjs
```

迁移时可以复制思路，不一定要复制所有业务代码。

### 4.4 前端更新弹窗

前端需要做：

```text
启动后延迟检查 /api/update/latest
-> 有更新就弹窗
-> 显示 Release notes
-> 用户点立即更新
-> 调 /api/update/download
-> 轮询 /api/update/download/status
-> ready 后请求 Electron 打开安装包
```

Sonic Topography 的参考文件：

```text
src/components/UI/UI.tsx
src/lib/updatePrompt.ts
```

### 4.5 Electron 打开安装包

不要让前端随便打开任何路径。Electron 主进程要检查：

```text
安装包路径必须在更新下载目录里
```

然后再打开。

Sonic Topography 的参考文件：

```text
desktop/main.js
desktop/preload.cjs
```

### 4.6 为什么不用完全静默更新

完全静默更新需要更多东西：

- 代码签名
- 权限处理
- 安装器后台替换
- 失败回滚
- 杀进程和重启逻辑
- 更复杂的安全校验

对小型 Windows Electron 应用来说，先做“检测 + 下载 + 打开安装包”更稳。

## 5. 常见问题和排查

### 问题 1：我 push 代码了，为什么用户没更新

原因：push 源码不等于发布安装包。

必须同时满足：

```text
package.json version 变大
GitHub Release tag 变大
Release 上传了新版 .exe
```

### 问题 2：我发了 Release，为什么软件不提示

检查：

```text
当前软件版本是不是低于 Release 版本
Release tag 是不是 v1.1.5 这种格式
Release 是不是最新 Release
Release 有没有发布，而不是 draft
package.json 里的 owner/repo 对不对
```

### 问题 3：下载一直 0%

常见原因：

- 用户访问 GitHub 很慢
- GitHub 被网络拦截
- 镜像站不稳定
- 没有 content-length，百分比显示不出来

Sonic Topography 已经做了流式下载，所以只要真的收到数据，进度会增长。

如果没有百分比，也应该能显示：

```text
已下载 xx MB
```

### 问题 4：下载完成但是打不开

检查：

```text
下载的文件是不是 .exe
文件大小是否等于 GitHub asset size
文件开头是否是 Windows MZ header
路径是否在允许的 updates/downloads 目录里
杀毒软件是否拦截
```

Sonic Topography 的后端已经检查大小和 MZ header。

### 问题 5：Release 正文不显示

检查：

```text
GitHub Release body 是否为空
接口 /api/update/latest 返回的 release.notes 是否有内容
前端弹窗是否读取 update.release.notes
```

### 问题 6：用户没有梯子怎么办

不要让用户自己找安装包。程序可以：

```text
先试 GitHub 直连
失败后试镜像
还是失败就显示“打开官方 Release 页面”
```

注意：镜像站不是你控制的服务，可能随时慢或失效，所以要准备多个候选。

### 问题 7：version、tag、安装包名字必须完全一样吗

建议保持一致：

```text
package.json: 1.1.5
Release tag: v1.1.5
安装包: SonicTopography-1.1.5-Setup.exe
```

这样最不容易混乱。

## 6. 发布前检查清单

每次发布前按这个勾：

```text
[ ] 功能已经本地测试
[ ] package.json version 已改
[ ] package-lock.json version 已同步
[ ] npm run lint 通过
[ ] npm run build 通过
[ ] 如果改了更新逻辑，更新相关测试通过
[ ] git status 只包含本次要提交的文件
[ ] git commit 已完成
[ ] git push origin master 已完成
[ ] npm run build:electron 已完成
[ ] release/ 下有新版 Setup.exe
[ ] GitHub Release tag 是 v版本号
[ ] Release 正文写了更新日志
[ ] Release 上传了新版 Setup.exe
[ ] 用旧版软件检查能看到新版本
[ ] 点击立即更新能下载并打开安装包
```

## 7. Sonic Topography 当前对应关系

当前项目的关键对应关系：

```text
当前版本:
package.json -> version

打包命令:
npm run build:electron

安装包输出:
release/SonicTopography-${version}-Setup.exe

更新源:
yin-yizhen/sonic-topography

检查更新:
GET /api/update/latest

开始下载:
POST /api/update/download

查询进度:
GET /api/update/download/status?id=<jobId>

跳过版本 localStorage:
sonic-topography-skipped-update-version-v1
```

记住一句话：

```text
用户能不能更新，主要看 GitHub Release 里有没有更高版本号的安装包，不是看你有没有 push 源码。
```
