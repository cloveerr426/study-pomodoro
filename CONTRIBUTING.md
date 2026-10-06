# 贡献指南

感谢你愿意改进这个项目！无论是报 Bug、提需求还是直接提 PR 都很欢迎。

## 报告问题

请使用仓库里的 Issue 模板，尽量写清：

- 复现步骤（点哪里、期望看到什么、实际看到什么）
- 浏览器与版本、操作系统
- 是双击 `index.html` 打开，还是通过 http 服务器 / 在线地址打开
- 如果是显示问题，附一张截图

## 提交代码

1. Fork 仓库并新建分支：`git checkout -b fix/xxx` 或 `feat/xxx`；
2. 修改 `index.html`（应用本体）或 `tests/`；
3. 本地跑一遍测试：`npm test`；
4. 提交并推送，然后开 PR，按模板填写说明。

### 代码约定

- 应用是**单文件**设计：HTML、CSS、JS 都在 `index.html` 里，请保持这一点，
  不要引入构建步骤或第三方运行时依赖。
- 保持零依赖：不新增 `dependencies`，新增能力尽量用浏览器原生 API。
- 新增用户可见功能时，请在 `tests/functional.mjs` 里补上对应断言。
- 提交信息建议使用 `feat:` / `fix:` / `docs:` / `refactor:` / `test:` 前缀。

## 测试说明

测试需要 **Node.js ≥ 22** 和本机已安装的 **Chrome / Edge**，不需要 `npm install`：

```bash
npm test                      # 三套测试共 124 项
BROWSER=/path/to/chrome npm test   # 自动探测不到浏览器时手动指定
npm run shots                 # 更新文档截图
```

新增 UI 时，如果你改了布局，注意 `tests/layout.mjs` 会在 1280 / 900 / 400 / 340 四种宽度下
检查元素溢出、重叠与文字对比度，请确保仍然全部通过。

## 行为准则

保持友善与耐心。讨论针对代码，不针对人。
