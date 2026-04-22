# Interview Copilot Local

本地会议/面试辅助应用，技术栈为 `Electron + React + TypeScript + Vite`。

当前仓库同时支持两种运行方式：

- `Electron Desktop`：完整桌面模式，可接入本地桥接、实时转写与分析
- `Web Preview / Web Embed`：网页展示模式，适合部署到 Vercel 后嵌入 Framer

## 技术栈

- Electron
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Zustand
- React Flow

## 环境要求

- Node.js `24+`
- npm `11+`

## 环境变量

参考 [`.env.example`](D:/codex/interview-copilot-local/.env.example) 创建 `D:\codex\interview-copilot-local\.env`。

OpenAI / 兼容中转：

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

ByteDance AST：

```bash
BYTEDANCE_APP_ID=
BYTEDANCE_ACCESS_TOKEN=
BYTEDANCE_WS_URL=wss://openspeech.bytedance.com/api/v4/ast/v2/translate
BYTEDANCE_RESOURCE_ID=volc.service_type.10053
```

## 本地启动

安装依赖：

```bash
npm install
```

启动桌面版：

```bash
npm run dev
```

只调试浏览器界面：

```bash
npm run dev:web
```

构建静态前端：

```bash
npm run build
```

静态检查：

```bash
npm run lint
```

## 网页展示模式

网页模式用于展示 UI，不保证以下 Electron 相关能力可用：

- `window.interviewCopilot` 桥接
- ByteDance AST 实时转写
- Electron 内的 OpenAI 分析调用

当前实现中：

- 纯网页打开时会默认进入 `Replay` 示例会话，方便演示
- `Live Assist` 仍可查看界面，但“开始”按钮会被禁用
- 适合在 Vercel 部署后通过 Framer `Embed` 展示

## 部署到 Vercel

仓库已包含 [`vercel.json`](D:/codex/interview-copilot-local/vercel.json:1)，默认配置：

- Framework: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

### 方式一：Vercel 控制台导入仓库

1. 把仓库推到 GitHub / GitLab / Bitbucket
2. 在 Vercel 中 `Add New Project`
3. 选择这个仓库
4. 确认构建配置：
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. 点击 `Deploy`

### 方式二：Vercel CLI

```bash
npm install -g vercel
vercel
vercel --prod
```

首次执行 `vercel` 时会完成登录和项目绑定。

## 在 Framer 中嵌入

部署成功后，拿到公网地址，例如：

```text
https://your-app.vercel.app
```

在 Framer 页面中插入 `Embed`，填入：

```html
<iframe
  src="https://your-app.vercel.app"
  style="width:100%;height:100%;border:0;"
  allow="microphone"
></iframe>
```

建议：

- 先给 Framer 的 Embed 容器设置明确宽高
- 桌面端先按 `1440x900` 附近验证布局
- 如果只做展示，优先使用 `Replay` 示例会话

## 验证建议

本地验证：

```bash
npm run build
npm run preview
```

检查点：

- 首页能正常打开，不白屏
- 样式与脚本资源加载正常
- 网页模式默认进入 `Replay` 示例会话
- 在 `Live Assist` 下不会误触发桌面模式能力

## GitHub + Netlify + Render deployment

The full browser Live Assist deployment uses two runtime targets:

- Netlify hosts the Vite frontend and the OpenAI analysis HTTP API.
- Render Web Service hosts the ByteDance AST realtime WebSocket backend.

### Netlify

The repository includes `netlify.toml` with:

- Build Command: `npm run build:web`
- Publish Directory: `dist`
- Functions Directory: `netlify/functions`

Set these Netlify environment variables:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
VITE_REALTIME_WS_URL=wss://your-render-service.onrender.com/ws/ast
```

Keep `OPENAI_API_KEY` secret. Enable Netlify visitor password protection from the project settings.

### Render

Use the same GitHub repository for a Render Web Service:

- Build Command: `npm install && npm run build:realtime`
- Start Command: `npm run start:realtime`
- Health Check Path: `/health`

Set these Render environment variables:

```bash
BYTEDANCE_APP_ID=
BYTEDANCE_ACCESS_TOKEN=
BYTEDANCE_WS_URL=wss://openspeech.bytedance.com/api/v4/ast/v2/translate
BYTEDANCE_RESOURCE_ID=volc.service_type.10053
ALLOWED_ORIGIN=https://your-netlify-site.netlify.app
```

Keep `BYTEDANCE_APP_ID` and `BYTEDANCE_ACCESS_TOKEN` secret. Set `ALLOWED_ORIGIN` to the final Netlify production URL.

### Local checks

```bash
npm run lint
npm run build:web
npm run build:realtime
npm run build:electron
```
