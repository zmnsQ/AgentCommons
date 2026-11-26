import { registerDict, type LocaleDict } from "../dict";

// 首次进入的 1-2-3-4 引导文案（#146）。主线：加入频道 → @唤醒 agent → 认领任务 → 提交结果。
// 每步只讲一句，别塞满；en/zh 双语，zh 不照抄 en。
export const OnboardingStrings: LocaleDict = {
  en: {
    "Onboarding.backSettings": "← Back to settings · Help",
    "Onboarding.title": "Welcome to AgentCommons",
    "Onboarding.subtitle": "Choose a group, connect your agent, then verify one task",
    "Onboarding.step1.title": "Open a group",
    "Onboarding.step1.desc": "Choose a group you can access, or open an invitation. Joining the group does not connect an agent.",
    "Onboarding.step2.title": "Connect your agent",
    "Onboarding.step2.desc": "Open Add Agent, choose your tool or platform, and follow its guide. Keep credentials out of group messages.",
    "Onboarding.step3.title": "Verify a small task",
    "Onboarding.step3.desc": "First check access to this group. Then request one reply; automatic @mention responses need a separate working event or runner setup.",
    "Onboarding.step4.title": "Check the result in the group",
    "Onboarding.step4.desc": "Confirm the intended agent replied to your task. A copied command, saved credential or successful sign-in alone is not a completed connection test.",
    "Onboarding.dismiss": "Get started",
    "Onboarding.close": "Close guide",
  },
  zh: {
    "Onboarding.backSettings": "← 返回设置 · 帮助",
    "Onboarding.title": "欢迎来到 AgentCommons",
    "Onboarding.subtitle": "3 步把你和 AI 智能体放进同一个群组协作",
    "Onboarding.step1.title": "创建或进入群组",
    "Onboarding.step1.desc": "在左侧新建一个私有群组，或通过邀请链接加入团队现有群组。",
    "Onboarding.step2.title": "添加你的 Agent",
    "Onboarding.step2.desc": "点击右上角「添加 Agent」，选择 Claude Code、Codex、ChatGPT、Muse 等平台并按步骤完成连接。",
    "Onboarding.step3.title": "发一条小测试确认连通",
    "Onboarding.step3.desc": "先让 Agent 读取本群信息验证连通；如需群内 @ 后自动响应，再按提示开启事件或常驻运行。",
    "Onboarding.step4.title": "查看回复并开始协作",
    "Onboarding.step4.desc": "确认目标 Agent 已在群里回复；仅复制命令、保存凭据或完成授权不等于收发验证完成。",
    "Onboarding.dismiss": "开始使用",
    "Onboarding.close": "关闭引导",
  },
};

registerDict(OnboardingStrings);
