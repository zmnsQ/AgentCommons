// @ts-expect-error Bun executes this test outside Vite globals.
import { expect, test } from "bun:test";
import { DesktopSettingsStrings } from "../i18n/strings/DesktopSettings";
import { DesktopPairingStrings } from "../i18n/strings/DesktopPairing";
import { PairStrings } from "../i18n/strings/Pair";
import { LocalAgentsOverviewStrings } from "../i18n/strings/LocalAgentsOverview";
import { InviteLandingStrings } from "../i18n/strings/InviteLanding";

test("desktop guidance separates setup, execution and connection in both locales", () => {
  for (const locale of ["en", "zh"] as const) {
    for (const step of [1, 2, 3]) expect(DesktopSettingsStrings[locale][`DesktopSettings.agent.setup${step}`]).toBeTruthy();
    expect(DesktopSettingsStrings[locale]["DesktopSettings.agent.empty"]).not.toContain("party init");
  }
  expect(DesktopSettingsStrings.en["DesktopSettings.agent.setup3"]).toContain("Check its connection in Overview, then test a reply in the group");
  expect(DesktopSettingsStrings.zh["DesktopSettings.agent.persistMode"]).not.toContain("不断线");
  expect(DesktopSettingsStrings.en["DesktopSettings.agent.empty"]).toContain("Codex or Claude Code");
  expect(DesktopSettingsStrings.en["DesktopSettings.agent.empty"]).toContain("Manage resident sessions");
  expect(DesktopSettingsStrings.zh["DesktopSettings.agent.empty"]).toContain("其他接入方式");
  expect(DesktopSettingsStrings.en["DesktopSettings.agent.setup2"]).toContain("Check the working directory before allowing code execution");
  expect(DesktopSettingsStrings.zh["DesktopSettings.agent.setup2"]).toContain("允许执行代码前先核对工作目录");
  expect(DesktopSettingsStrings.zh["DesktopSettings.agent.setup1"]).toContain("管理常驻会话");
  expect(LocalAgentsOverviewStrings.en["LocalAgents.empty"]).toContain("records");
  expect(LocalAgentsOverviewStrings.zh["LocalAgents.empty"]).toContain("记录");
});

test("desktop approval and human invitations name the account action and next destination", () => {
  expect(DesktopPairingStrings.en["DesktopPairing.subtitle"]).toContain("Approve this desktop app");
  expect(DesktopPairingStrings.zh["DesktopPairing.subtitle"]).toContain("批准此桌面端登录");
  expect(PairStrings.en["Pair.status.approved"]).toContain("Return to the desktop app");
  expect(PairStrings.zh["Pair.status.approved"]).toContain("请返回桌面端");
  expect(InviteLandingStrings.en["InviteLanding.signInHint"]).toContain("join this group with your account");
  expect(InviteLandingStrings.zh["InviteLanding.signInHint"]).toContain("以你的账号加入本群");
});
