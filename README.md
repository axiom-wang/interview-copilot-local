# 会议辅助助手

一款面向无领导小组讨论与群面场景的本地 Electron 桌面应用。它将实时转写、讨论阶段识别、共识与分歧提取、发言提示、思维导图和会后回放集中在同一个工作台中。

> 当前项目仍在开发中，接口和数据结构可能继续调整。

## 核心能力

- **Live Assist**：实时接收转写，持续识别讨论阶段、共识、分歧和待补充信息
- **发言提示**：根据当前讨论生成 15 秒、30 秒和 60 秒表达建议
- **AI 问答**：结合最近转写、题目背景和角色背景回答现场问题
- **思维导图**：将讨论结构转换为 React Flow 节点与连线
- **会议总结**：生成关键要点、下一步行动和 60 秒总结发言
- **Replay**：保存会话后按时间线回放转写与分析快照
- **本地数据**：会话保存在当前应用的本地存储中，可导出为 JSON、Markdown 或纯文本

## 技术架构

| 模块 | 实现 |
| --- | --- |
| 桌面运行时 | Electron |
| 界面 | React 19、TypeScript、Vite、Tailwind CSS |
| 状态管理 | Zustand |
| 思维导图 | React Flow |
| 实时转写 | ByteDance 同声传译 2.0 WebSocket 适配器 |
| AI 分析 | OpenAI Responses API，所有任务使用结构化 JSON 输出 |
| Provider | AST 与 LLM 均通过类型化适配器接入，并提供 Mock LLM 回退 |
| 数据存储 | 当前使用浏览器本地存储，数据结构保持文件或 SQLite 迁移友好 |

Electron 主进程负责持有服务凭证并连接外部服务，渲染进程通过受限 IPC 接口调用转写和分析能力。

## 环境要求

- Node.js 22.12 或更高版本
- npm 10 或更高版本
- 可用的麦克风
- OpenAI API 凭证
- ByteDance 同声传译 2.0 凭证

## 快速开始

1. 安装依赖：

   ```bash
   npm install
   ```

2. 创建本地配置：

   ```bash
   cp .env.example .env
   ```

3. 在 `.env` 中填写服务凭证：

   ```dotenv
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-5.4-mini
   OPENAI_BASE_URL=https://api.openai.com/v1

   BYTEDANCE_APP_ID=
   BYTEDANCE_ACCESS_TOKEN=
   BYTEDANCE_WS_URL=wss://openspeech.bytedance.com/api/v4/ast/v2/translate
   BYTEDANCE_RESOURCE_ID=volc.service_type.10053
   ```

4. 启动桌面应用：

   ```bash
   npm run dev
   ```

首次接入 ByteDance AST 时，可以在应用设置中执行连接测试，再开始实时会话。

## 常用命令

```bash
# 启动 Electron 开发环境
npm run dev

# 仅启动浏览器界面，用于 UI 调试和 Replay 演示
npm run dev:web

# 类型检查并构建 Electron 应用
npm run build:electron

# 运行静态检查
npm run lint
```

浏览器模式不包含 Electron IPC。未配置实时服务时，它主要用于界面调试和内置 Replay 示例；完整的实时转写与本地凭证调用请使用 Electron 模式。

## 项目结构

```text
electron/
  ast/                 ByteDance AST 会话、配置与 IPC
  llm/                 OpenAI 分析服务、结构化响应解析与 IPC
  main.ts              Electron 主进程
  preload.ts           安全的渲染进程桥接
src/
  components/          工作台界面组件
  modes/               Live Assist 与 Replay 页面
  prompts/             各类分析任务的提示词
  providers/           AST / LLM Provider 适配器
  schemas/             分析任务的 JSON Schema
  services/            分析编排、会话存储与导出
  store/               Zustand 应用状态
  types/               共享领域类型
```

## 数据与隐私

- 应用不包含用户账号、云同步或多人协作功能。
- 保存的会话、回放记录和上下文默认留在当前应用的本地存储中。
- `.env` 仅用于本地配置，切勿提交真实密钥。
- 启用实时能力后，麦克风音频会发送至配置的 ByteDance 服务，分析所需的转写文本会发送至配置的 OpenAI 或兼容服务；请在使用前确认数据合规要求。

## 开发约定

- 保持模块小而类型清晰。
- 新 Provider 先实现接口，再接入状态层。
- 所有 AI 分析任务必须返回可校验的结构化 JSON。
- 优先完善 Mock Provider 和 Replay 流程，再扩展真实服务能力。
- 不在本项目中加入账号、计费、云同步或公共 SaaS 基础设施。
