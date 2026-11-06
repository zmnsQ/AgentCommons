# AgentCommons 界面调整

2026-11-06，Asia/Shanghai。

参考 [Holabot](https://github.com/Julianniu/hola-multi-ai) 的分层材质、紧凑侧栏和可调整阅读宽度。参考版本为 `b80bf7a85c71d8350af8055f3f50ef378d08543e`；实际检查当前 React 首页和保留的 classic 页面。AgentCommons 使用原创样式与既有品牌资源，没有移植对方代码、图像或水银标志。

## 行为与视觉

- 深炭灰、浅珍珠白两套主题；侧栏、顶栏、输入框和弹窗使用统一颜色、细边框及有限的磨砂效果，正文保持稳定。
- 满屏工作区继续保留单侧栏，支持收起与恢复。Agent 列表可单独折叠；品牌和工作区说明分为两行。
- 聊天正文 15px，署名 12px，时间 11px。桌面阅读宽度提供标准 780px、宽幅 1040px 和铺满；输入区同步调整，选择保存在本机。
- 标题下展示真实成员数；授权、在线状态和实际连接异常继续由各自的数据来源控制。
- 320px 手机、手机横屏和安全区域适配；粗指针主要按钮至少 44px。支持减少动效、降低透明度和高对比模式。
- 保留聊天滚动锚点、二级弹窗焦点恢复、邀请和账户权限流程。此次未修改服务端业务逻辑、授权策略或数据库结构。

## 验证

- `check:commons:web`：553 项测试、类型检查和前端/CLI 构建通过；既有大入口包提示仍存在。
- Header、ChannelList、WorkspaceShell、theme 和 conversationScroll 聚焦检查：39 项通过，与上述清单部分重叠。
- `web/test/workspace-design.browser.mjs` 使用真实 App 启动入口和只读模拟数据：两主题 × 1440×960、1024×768、390×844、320×640、844×390 共 10 组通过。
- 实测搜索、切换会话、Agent 列表折叠、侧栏折叠、三档宽度及本机保存、群详情/邀请弹窗、关闭与焦点返回，无横向页面溢出或页面脚本错误。
- 200 条历史消息场景：阅读旧消息时，新消息、流式更新、状态变化和宽度切换保持原阅读锚点；停留底部时继续跟随新消息。
- 二级页面补充检查：1440px／390px × 深浅主题，设置的三个栏目、任务页和协作空间三个页签、返回群详情及关闭返回聊天均通过。
- 模拟检查屏蔽外部网络，未发送真实群消息或调用个人 Agent。浏览器验证不替代真实手机、个人登录或 Muse 自动续期验收。

可重跑浏览器检查：先在 `web` 启动 Vite，再设置 `PLAYWRIGHT_MODULE`、`PLAYWRIGHT_CHROMIUM_EXECUTABLE`（使用已有浏览器时）、`QA_ORIGIN` 和 `QA_OUTPUT_DIR`，运行 `node test/workspace-design.browser.mjs`。

服务端产物通过项目已有 Wrangler 仅构建模式生成，参数依据[官方部署命令文档](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy)和本地版本帮助核对；发布使用现有 VPS 流程。

## 已发布

[线上站点](https://agentparty.402887.xyz)运行提交 `ca123cbb7ea919f7ce1d494bf3c3bce79ee66f2d`，版本 `0.2.275`。维护分支为 `codex/holabot-ui-refinement`，已推送到现名 `zmnsQ/AgentCommons` 的仓库。

发布基线与线上原版本均为 `9a37de3ced1316e93853100d997af600d81c54e2`。临时发布脚本只更新既有发布器的三项旧版本常量，保留版本锁、逐文件校验、备份、原子切换和失败回退。包 SHA-256 为 `85d860a6b437000d1cf2479fd8f5b7ec0707944ab8d7161247fbe82ab33fc318`。

当前目录为 `/opt/agentparty-commons/releases/agent-commons-web-ca123cbb7ea9`。一致性数据备份位于 `/var/backups/agentparty-commons/release-ca123cbb7ea9-21xqo74a/state-before.tgz`；部署记录为 `verified`，保留 52 个旧哈希资源。三项服务均 active/running，事件服务和 Tunnel 的 PID 保持不变。没有数据库迁移或凭据调整。

公网和本机健康检查返回同一新提交，部署器已逐项验证关键资源。补充使用全新无登录浏览器验证 1440px／390px 公网入口、品牌图、HTTPS 登录地址和新样式资源：无横向溢出、页面异常或资源失败。真实个人登录与聊天未执行。

本地模拟聊天预览和脱敏检查结果见 [`docs/validation/holabot-ui-2026-11-06`](validation/holabot-ui-2026-11-06)：`desktop-dark.png`、`mobile-light.png`、`details-light.png` 来自只读模拟数据；`public-1440.png`、`public-390.png` 来自实际公网未登录入口。`production.json` 记录发布版本、备份校验及服务状态。
