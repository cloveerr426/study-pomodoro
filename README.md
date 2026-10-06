# 🍅 番茄自习室 · Study Pomodoro

> 一个可以自己换壁纸、换主题的番茄钟（自律学习计时器）。
> **单文件、零依赖、零安装**——一个 `index.html` 就是全部，双击即用，数据只存在你自己的浏览器里。

![默认外观](docs/screenshots/01-default.png)

<p align="center">
  <img src="docs/screenshots/02-custom-wallpaper.png" width="49%" alt="自定义壁纸与主题">
  <img src="docs/screenshots/03-mobile.png" width="24%" alt="手机端">
</p>

更多截图：[主题面板](docs/screenshots/04-theme.png) · [壁纸面板](docs/screenshots/05-wallpaper.png) · [统计面板](docs/screenshots/06-stats.png) · [沉浸模式](docs/screenshots/07-immersive.png)

<!-- 推送到 GitHub 后，可以把下面这行的注释去掉（记得把 USER/REPO 换成你的仓库）：
![License](https://img.shields.io/badge/license-MIT-green)
![Tests](https://github.com/cloveerr426/study-pomodoro/actions/workflows/test.yml/badge.svg)
![Pages](https://github.com/cloveerr426/study-pomodoro/actions/workflows/pages.yml/badge.svg)
-->

## 特性

**🖼 自定义壁纸**

- 上传本地图片（拖拽即可），或直接填图片链接
- 10 张内置渐变壁纸：极光、夜空、森林、深海、晨曦、蜜桃、纸质、素灰、薄荷、夜梅
- 铺满裁切 / 完整显示 / 平铺三种适应方式，背景模糊与遮罩深度可调
- 自动根据壁纸明暗调整文字颜色与遮罩，浅色壁纸不会让白色文字糊成一片
- 大图自动压缩后保存在本机，原图不会上传到任何服务器

**🎨 主题**

- 8 套主色 × 浅色 / 深色面板，实时预览
- 进度环、按钮、开关、图表、打卡热力图会一起换色

**⏱ 计时**

- 专注 / 短休息 / 长休息，时长与「每几轮长休息」都可调
- 专注结束自动进入休息，可选结束后自动开始下一个番茄
- 提示音（浏览器实时合成，不依赖音频文件）、可选滴答声、桌面通知、运行时自动防止息屏
- 沉浸模式（只留进度环）、全屏、标签页标题实时显示剩余时间

**📚 学习管理**

- 今日任务清单，可把某个任务设为当前专注目标，自动累计每个任务的番茄数与投入分钟
- 今日番茄 / 专注分钟 / 连续天数 / 目标进度
- 统计面板：最近 7 天柱状图、30 天打卡热力图、任务投入排行
- 数据可一键导出 / 导入，换设备或备份很方便

**🔒 隐私**

- 没有账号、没有后端、没有统计埋点
- 全部数据（设置、任务、专注记录、壁纸）都存在你自己浏览器的 localStorage / IndexedDB 中

## 快速开始

下载 `index.html`，双击用浏览器打开即可。想更像一个 App，可以在浏览器里「添加到主屏幕」或按 `F` 全屏。



## 键盘快捷键

| 按键 | 功能 |
| --- | --- |
| `空格` | 开始 / 暂停 |
| `R` | 重置当前计时 |
| `S` | 跳过当前阶段 |
| `F` | 全屏 |
| `Esc` | 退出沉浸模式 / 关闭抽屉 |


## 想改点什么

都在 `index.html` 里，改完刷新即可：

| 想改的东西 | 位置 |
| --- | --- |
| 内置壁纸 | `WALLPAPERS` 数组（`css` 是背景，`luma` 是亮度 0–1，用于自动明暗适配） |
| 主题主色 | `THEMES` 数组 |
| 默认时长 / 目标 | `DEFAULTS` 对象 |
| 配色变量、圆角、模糊 | 文件开头的 CSS 变量（`--accent`、`--radius` 等） |
| 快捷键 | 搜索 `键盘快捷键` |

## 常见问题

**关闭页面后还在计时吗？**
不会。网页关闭后计时就停了，标签页保持在后台可以继续计时（切到别的窗口也有桌面通知提醒）。

**我上传的图片存在哪里？**
只存在你自己浏览器的本地数据库里（IndexedDB，超大或环境受限时自动改用 localStorage 压缩存储）。
换浏览器、换设备或清理浏览器数据后需要重新上传，记得用「导出数据」备份任务与记录。

**为什么我用 file:// 直接打开时，图片画质好像被压缩了？**
部分浏览器在本地文件模式下会禁用 IndexedDB，此时应用会把图片压缩后存入 localStorage 以保证能用。
想要保留原图画质，用 `npm start` 通过本地服务器打开，或直接部署到 GitHub Pages。

**会自动开始下一个番茄吗？**
默认「自动开始休息」开启、「自动开始专注」关闭，都可以在设置里改。

## 浏览器兼容

Chrome / Edge / Safari / Firefox 的桌面与移动版均可使用。
需要注意：桌面通知、防息屏、File System 相关能力在不同浏览器上支持程度不同，应用会静默降级。

## 贡献

欢迎 Issue 和 PR，请先看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE) —— 可自由使用、修改、商用，保留版权声明即可。

---

## English

**Study Pomodoro** — a single-file Pomodoro timer you can make your own.
Upload your own wallpaper (or paste an image URL), pick from 10 built-in gradient backgrounds,
and choose from 8 accent colors with light/dark panels. Wallpaper brightness is detected automatically
so text stays readable. Includes focus/short/long cycles, task list with per-task pomodoro counts,
7-day and 30-day stats, keyboard shortcuts, an immersive mode, and JSON export/import.

No build step, no dependencies, no backend: everything lives in `index.html`, and all data stays in
your own browser. `npm test` runs 124 end-to-end checks against a real headless browser. MIT licensed.
