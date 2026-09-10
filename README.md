# 会议智能助手

面向多人会议的 Web SaaS 应用（Netlify），可选 Electron 桌面壳。会话开始前可选择场景模板，把实时转写、讨论阶段识别、共识与分歧提取、发言提示、思维导图、口播总结、标准会议纪要和会后回放集中在同一个工作台中。

> 当前项目仍在开发中，接口和数据结构可能继续调整。

## 会议场景

分析提示词、阶段标签、上下文标题和快捷问题都由场景 profile 驱动，默认 **通用会议**。底层阶段枚举不变，已保存的回放快照继续可读。

| 场景 | 说明 |
| --- | --- |
| 通用会议 | 一般多人讨论、决策与协作 |
| 群面 / 小组面试 | 无领导小组讨论与群体面试 |
| 需求与方案评审 | 跨职能需求澄清与方案评审 |
| 头脑风暴 | 创意发散、聚类与优选 |
| 团队同步 / 站会 | 进展同步、阻塞处理与行动确认 |

场景是每场会议的属性，在会话准备抽屉中选择，并随会话保存在本地。

## 核心能力

- **登录与模型设置**：Netlify Identity 登录门；按用户在浏览器本地保存 BYO 密钥，并提供连接测试
- **Live Assist**：实时接收转写，持续识别讨论阶段、共识、分歧和待补充信息
- **发言提示**：根据当前讨论生成 15 秒、30 秒和 60 秒表达建议
- **AI 问答**：结合最近转写、会议背景和角色背景回答现场问题
- **思维导图**：将讨论结构转换为 React Flow 节点与连线
- **会议总结**：生成口播稿（时长与标题随场景变化）以及结构化会议纪要（议题、决策、待定问题、行动项）
- **Replay**：保存会话后按时间线回放转写与分析快照
- **本地数据**：会话保存在当前浏览器或桌面应用的本地存储中，可导出为 JSON、Markdown 或纯文本

## 技术架构

| 模块 | 实现 |
| --- | --- |
| 部署 | Netlify（静态站点 + Functions 分析代理） |
| 桌面运行时 | 可选 Electron |
| 界面 | React 19、TypeScript、Vite、Tailwind CSS |
| 状态管理 | Zustand |
| 思维导图 | React Flow |
| 实时转写 | ByteDance 同声传译 2.0 WebSocket 适配器 |
| AI 分析 | OpenAI Responses API，所有任务使用结构化 JSON 输出 |
| Provider | AST 与 LLM 均通过类型化适配器接入，并提供 Mock LLM 回退 |
| 数据存储 | 当前使用浏览器本地存储，数据结构保持文件或 SQLite 迁移友好 |

Web 模式下，分析请求走 Netlify Functions；Electron 主进程通过受限 IPC 调用转写和分析能力。密钥由用户自行配置，默认不写入服务端。

## 环境要求

- Node.js 22.12 或更高版本
- npm 10 或更高版本
- 可用的麦克风（实时转写）
- 用户自备的 OpenAI API 凭证
- 用户自备的 ByteDance 同声传译 2.0 凭证

## 快速开始

1. 安装依赖：

   ```bash
   npm install
   ```

2. 创建本地配置：

   ```bash
   cp .env.example .env
   ```

3. 在 `.env` 中按需填写服务凭证（本地开发可用 mock 登录）：

   ```dotenv
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-5.4-mini
   OPENAI_BASE_URL=https://api.openai.com/v1

   VITE_FORCE_MOCK_AUTH=true

   BYTEDANCE_APP_ID=
   BYTEDANCE_ACCESS_TOKEN=
   BYTEDANCE_WS_URL=wss://openspeech.bytedance.com/api/v4/ast/v2/translate
   BYTEDANCE_RESOURCE_ID=volc.service_type.10053
   ```

4. 启动界面：

   ```bash
   npm run dev:web
   ```

本地开发默认可使用任意邮箱密码登录。首次使用实时能力前，请在「模型设置」中填写并测试语音转写与文本分析配置。桌面壳使用 `npm run dev`。

## 常用命令

```bash
# 启动浏览器开发环境
npm run dev:web

# 启动 Electron 开发环境
npm run dev

# 类型检查并构建 Web 应用
npm run build:web

# 类型检查并构建 Electron 应用
npm run build:electron

# 运行静态检查
npm run lint
```

浏览器模式不包含 Electron IPC。未配置实时服务时，它仍可用于界面调试、场景切换和内置 Replay 示例。

## 项目结构

```text
electron/
  ast/                 ByteDance AST 会话、配置与 IPC
  llm/                 OpenAI 分析服务、结构化响应解析与 IPC
  main.ts              Electron 主进程
  preload.ts           安全的渲染进程桥接
netlify/functions/     Web 分析代理与连接探测
src/
  auth/                登录适配器（Netlify Identity / mock）
  components/          工作台界面组件
  modes/               Live Assist 与 Replay 页面
  pages/               登录页与模型设置页
  prompts/             各类分析任务的提示词
  providers/           AST / LLM Provider 适配器
  scenarios/           会议场景 profile
  schemas/             分析任务的 JSON Schema
  services/            分析编排、会话存储与导出
  settings/            按用户保存的模型配置
  store/               Zustand 应用状态
  types/               共享领域类型
```

## 数据与隐私

- 提供登录门，但不做计费、云端会话同步或多人实时协作。
- 保存的会话、回放记录、场景选择和上下文默认留在当前浏览器或桌面应用的本地存储中。
- 模型密钥按用户保存在浏览器本地，不会作为默认云配置下发。
- `.env` 仅用于本地或部署环境变量，切勿提交真实密钥。
- 启用实时能力后，麦克风音频会发送至配置的 ByteDance 服务，分析所需的转写文本会发送至配置的 OpenAI 或兼容服务；请在使用前确认数据合规要求。

## 开发约定

- 保持模块小而类型清晰。
- 新 Provider 先实现接口，再接入状态层。
- 场景相关文案放进 `src/scenarios/`，不要在 prompt 或 UI 里再写死群面口径。
- 所有 AI 分析任务必须返回可校验的结构化 JSON。
- 优先完善 Mock Provider 和 Replay 流程，再扩展真实服务能力。
- 不在本项目中加入计费、云同步或多人实时协作。
