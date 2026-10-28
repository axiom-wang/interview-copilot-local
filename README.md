# 会议智能助手

面向多人会议的助手，同一仓库提供本地桌面版（Electron）和线上网页版（Netlify）。两版独立启动、构建和配置，共享会议界面与分析核心。会话开始前可选择场景模板，把实时转写、讨论阶段识别、共识与分歧提取、发言提示、思维导图、口播总结、标准会议纪要和会后回放集中在同一个工作台中。

> 当前项目仍在开发中，接口和数据结构可能继续调整。

## 会议场景

分析提示词、阶段标签、上下文标题和快捷问题都由场景 profile 驱动，默认 **通用会议**。底层阶段枚举不变，已保存的回放快照继续可读。

| 场景 | 说明 |
| --- | --- |
| 通用会议 | 一般多人讨论、决策与协作 |
| 群面 / 小组面试 | 无领导小组讨论与群体面试 |
| 一对一面试 | 按住按键录入问题，结合岗位 JD 生成回答要点 |
| 需求与方案评审 | 跨职能需求澄清与方案评审 |
| 头脑风暴 | 创意发散、聚类与优选 |
| 团队同步 / 站会 | 进展同步、阻塞处理与行动确认 |

场景是每场会议的属性，在会话准备抽屉中选择，并随会话保存在本地。

一对一面试开始前必须填写岗位 JD，可选填真实经历要点。开始时保持静音；按住空格或「按住提问」录入问题，松开后立即停止采集并生成回答，也可直接输入文字问题。离开实时页面会结束正在进行的录音。完整问答记录随会话保存在本地，可在 Replay 的「AI 问答」页查看，并随 JSON、Markdown 导出。


## 核心能力

- **登录与模型设置**：线上使用 Netlify Identity，桌面版保留本地登录门；按用户在浏览器本地保存 BYO 密钥，并提供连接测试
- **Live Assist**：实时接收中文会议原话（中间结果持续更新、分句定稿并标记说话人），持续识别讨论阶段、共识、分歧和待补充信息
- **发言提示**：根据当前讨论生成 60 秒和 120 秒表达建议；无新增价值时建议倾听，内容不足时不凑时长
- **AI 问答**：结合最近转写、会议背景和角色背景回答现场问题
- **思维导图**：将讨论结构转换为 React Flow 节点与连线
- **会议总结**：生成口播稿（时长与标题随场景变化）以及结构化会议纪要（议题、决策、待定问题、行动项）
- **Replay**：保存会话后按时间线回放转写与分析快照
- **本地数据**：会话保存在当前浏览器或桌面应用的本地存储中，可导出为 JSON、Markdown 或纯文本

## 两版职责与共享代码

| 能力 | 本地桌面版 | 线上网页版 |
| --- | --- | --- |
| 入口 | `apps/desktop` | `apps/web` |
| 文本分析 | Codex、Claude 或 OpenAI Responses API | OpenAI Responses API，通过 Netlify Functions |
| 语音转写 | Electron IPC 直接连接火山引擎 | 浏览器通过独立实时服务连接火山引擎 |
| 登录 | 现有本地登录门 | Netlify Identity（开发环境可用 mock） |
| 产物 | `apps/desktop/dist` + `apps/desktop/dist-electron` | `apps/web/dist` |

`shared/ui` 提供 React 工作台、登录/设置/回放页面和 Zustand 状态。应用入口先注入运行环境，再挂载共享界面；界面不直接引用另一版代码或桌面桥接。

`shared/meeting` 提供场景、提示词、JSON Schema、模型设置、类型、分析编排、会话保存与导出。`shared/analysis` 提供两版服务端共用的 API 分析及火山引擎协议，实现中不导入 Electron。

会话格式、模型配置的存储键、场景和上下文键保持不变。桌面版沿用 `interview-copilot-local` 用户数据目录，默认开发地址继续为 `http://localhost:5173`；网页版默认继续为 `http://127.0.0.1:5173`。原有配置和已保存会话无需手工搬迁。改变访问端口会切换浏览器存储空间，开发时请留意这一点。

## 环境要求

- Node.js 22.13 或更高版本
- pnpm 12.8.1（项目固定版本）；已有 `npm run` 启动方式继续可用
- 可用的麦克风（实时转写）
- 文本分析：OpenAI API 凭证，或桌面版已安装并登录的 Codex CLI / Claude Code CLI
- 用户自备的火山引擎流式语音识别 2.0 凭证

## 本地桌面版启动

在仓库根目录运行：

```bash
pnpm install --frozen-lockfile
npm run dev:desktop
```

原命令 `npm run dev` 继续打开桌面版。进入「模型设置」选择 API 或 Codex，测试并保存配置；语音转写凭证仍在设置页填写。会议期间保持程序运行、电脑唤醒和联网。

可从 `apps/desktop/.env.example` 创建 `apps/desktop/.env`，设置桌面版服务端的开发备用配置。Codex 沿用自己的 CLI 登录，不需要项目 API Key。

## 线上网页版开发与部署

只安装网页及共享模块所需依赖：

```bash
pnpm --filter @meeting-assistant/web... install --frozen-lockfile
npm run dev:web
```

网页版开发不会启动 Electron，也不依赖 Codex CLI。开发模式保留 mock 登录；生产构建使用 Netlify Identity，除非显式设置 `VITE_FORCE_MOCK_AUTH=true`。

生产环境保持 `IDENTITY_REQUIRED=true`。`/api/analysis` 与 `/api/ast/probe` 都要登录。分析请求必须带上用户自己的 API Key，服务端不会改用 `OPENAI_API_KEY`。Base URL 只接受 https，默认只允许 `api.openai.com`；其他兼容主机写入 `ALLOWED_MODEL_HOSTS`。

从 `apps/web/.env.example` 创建 `apps/web/.env`，配置 `VITE_REALTIME_WS_URL`。网页语音转写需要部署实时服务；未配置时仍可使用 Replay 示例。

根目录 `netlify.toml` 已配置：

- 构建命令：`npm run build:web`
- 发布目录：`apps/web/dist`
- Functions 目录：`apps/web/netlify/functions`
- 依赖安装筛选：`PNPM_FLAGS=--filter=@meeting-assistant/web...`

Netlify 的 base directory 保持仓库根目录。无需构建桌面版。实时服务仍由 `render.yaml` 配置，它也只安装网页和共享模块依赖。仓库中的构建配置已更新，本次拆分不会自动发布线上站点。

两版独立读取各自目录下的 `.env`，暂时兼容根目录 `.env` 作为旧配置的备用来源，各版配置优先。密钥不要放进 `VITE_` 变量，这类值会进入浏览器代码。

默认地址为兼容原有存储保留在 5173；如需同时开发两版，可将网页版临时改到其他端口：

```bash
npm run dev --workspace @meeting-assistant/web -- --port 5174
```

## 桌面版使用 Codex 分析

线上与浏览器版继续使用 API 通道。Electron 桌面版可在「模型设置 → 文本分析 → 首选渠道」选择 **本地 Codex**：

1. 安装 Codex CLI，并在终端运行 `codex login` 登录。使用 ChatGPT 登录时使用相应账号权益与额度；如果 CLI 使用 API Key 登录，则按该登录方式计费。
2. 运行 `npm run dev` 打开桌面版，选择本地 Codex。模型留空沿用 Codex 的默认配置；程序路径留空自动查找，也可填写可执行文件的绝对路径。
3. 点击「测试 Codex 连接」，测试会完成一次真实的结构化分析请求，再点击「保存配置」。API 配置可独立编辑并点击「测试 API 连接」。语音转写仍需单独配置火山引擎凭证。

API 与 Codex 的配置分别保留，切回 API 后可继续使用原有密钥。旧配置默认迁移到 API 通道。浏览器版不能启动本机程序，因此无法选择 Codex。

本项目的 Codex 通道使用 **Fast 速度**：实时阶段与共识分析、发言建议使用 **Low 推理强度**；连接测试、问答、思维导图、总结、纪要和历史会议记忆整理使用 **Medium**。每次分析分别指定推理强度。设置通过本项目启动的 App Server 进程与分析请求单独传入，不修改全局 Codex 配置；单独使用 Codex 时保留原来的速度和推理设置。Fast 需要所选模型与账号支持，并会更快消耗账号额度。

Codex 在 Electron 主进程中通过 `app-server` 的 stdio 协议运行；它使用自己的登录凭证，不接收项目的文本分析 API Key。阶段与共识合并为一次请求，自动分析约每 8 秒处理最新定稿文本，执行中的分析完成后再处理后续更新。各任务串行运行，会议重启、停止、通道切换和应用退出时会清理进程；所有任务复用场景提示词、JSON Schema 和已有解析器。桌面版默认开启「故障时自动切换」：首选渠道在原有重试耗尽后失败，会使用另一渠道重试相同任务。成功切换后，本场会议的所有分析任务持续使用备用渠道，界面显示实际渠道与切换原因。API 备用必须填写 API Key 和模型，Codex 备用需已安装并登录；开关关闭后仅使用首选。

停止收音仅释放进程并取消未完成分析，之后的总结、纪要仍保留本场会议的备用渠道；新会议、重启应用或保存模型设置后重新使用首选。双方都失败时保留已有结果和更新时间，尚无结果则保持空态；桌面版不再生成模拟分析。连接测试直接测试指定渠道，不触发降级，也不改变会议渠道。设置和会话沿用原有本地存储，临时降级状态不写入会议文件。

本地 Codex 程序不等于离线模型：会议文本仍发送至 Codex 配置的模型服务，需要联网，延迟取决于模型与网络。此通道不启用 shell、MCP、连接器、插件或网页搜索来分析会议文本。App Server 协议可能随 CLI 版本变化，升级后可先重新测试连接。

## 桌面版使用本地 Claude

「模型设置 → 文本分析 → 首选渠道」还可选择 **本地 Claude**，复用本机 Claude Code CLI 的登录，不需要 API Key：

1. 安装 Claude Code CLI 并在终端运行 `claude` 登录。
2. 选择本地 Claude。模型留空使用 Sonnet；程序路径留空时依次搜索 PATH、`~/.local/bin`、`/opt/homebrew/bin`、`/usr/local/bin`、`~/.nvm/versions/node/*/bin`。从 Finder 打开应用时 PATH 不完整，找不到时请填写绝对路径。
3. 点击「测试连接」，会完成一次真实的结构化分析请求并显示模型和登录方式，再保存配置。

分析通过 `@anthropic-ai/claude-agent-sdk` 驱动 CLI：不开放任何工具，不加载用户、项目和本地设置（CLAUDE.md、settings、MCP），工作目录为临时空目录，单次超时 90 秒。环境中的 `ANTHROPIC_API_KEY` 不会传给 CLI。提示词、JSON Schema 和结果解析与其他渠道共用。

为降低延迟，会议期间使用**常驻会话**：每种任务（按 Schema 和推理强度区分）保留一个 CLI 进程，省去每次启动的开销；每轮结束后立即 `/clear`，各任务互相看不到对方的内容。最多同时保留 3 个进程（每个约 230 MB 内存），闲置 5 分钟自动回收；常驻进程异常退出时自动换新进程重试一次；会话重置只取消进行中的请求，空闲进程保留；应用退出或切换通道时全部关闭。连接测试使用一次性进程。

实时分析（每 8 秒一次）还做了输出精简：Claude 通道去掉了界面不显示的 `nextBestAction`，并要求各字段保持简短、共识/分歧/缺口每类最多 3 条。实测输出 token 约减半，耗时由约 11 秒降到约 5 秒。

备用渠道：首选为本地 Claude 或 Codex 时，故障后固定切换到 OpenAI API（需填写 API Key 和模型）；首选为 API 时仍切换到 Codex。Claude 与 Codex、API 的配置分别保留。会议文本仍会发送至 Claude 模型服务，需要联网。网页版没有此选项。

## 常用命令

```bash
npm run dev:desktop     # 桌面版，原 npm run dev 仍可用
npm run dev:web         # 网页版
npm run build:desktop   # 桌面构建，原 build:electron 仍可用
npm run build:web       # 网页与 Functions 类型检查、网页构建
npm run build:realtime  # 独立实时服务类型检查
npm run start:realtime  # 启动实时转写服务
npm run typecheck      # 两版与服务端统一类型检查
npm test               # 功能回归及依赖边界测试
npm run lint           # 代码检查
```

## 项目结构

```text
apps/
  desktop/
    electron/          主进程、IPC、Codex 进程
    renderer/          桌面入口与 AST/LLM 桥接适配器
    vite.config.ts     独立桌面构建
  web/
    auth/              Netlify 登录适配器
    providers/         HTTP 分析与远程转写适配器
    netlify/functions/ 分析代理与连接测试
    realtime/          独立实时转写服务
    vite/              网页本地开发代理
    vite.config.ts     独立网页构建
shared/
  ui/                  共享工作台、页面、状态与运行环境接口
  meeting/             场景、提示词、结果结构、设置、回放与导出
  analysis/            API 分析服务及语音识别协议
```

## 数据与隐私

- 提供登录门，但不做计费、云端会话同步或多人实时协作。
- 保存的会话、回放记录、场景选择和上下文默认留在当前浏览器或桌面应用的本地存储中。
- 模型密钥按用户保存在浏览器本地，不会作为默认云配置下发。
- `.env` 仅用于本地或部署环境变量，切勿提交真实密钥。
- 启用实时能力后，麦克风音频会发送至配置的火山引擎语音服务，分析所需的转写文本会发送至配置的 OpenAI 或兼容服务，选择 Codex 时发送至 Codex 配置的模型服务；请在使用前确认数据合规要求。

## 开发约定

- 保持模块小而类型清晰。
- 新 Provider 先实现接口，再接入状态层。
- 场景相关文案放进 `shared/meeting/scenarios/`，不要在 prompt 或 UI 里再写死群面口径。
- 所有 AI 分析任务必须返回可校验的结构化 JSON。
- 优先完善 Mock Provider 和 Replay 流程，再扩展真实服务能力。
- 不在本项目中加入计费、云同步或多人实时协作。
