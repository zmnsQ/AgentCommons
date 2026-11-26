// @ts-expect-error Bun executes these source-contract tests.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("../styles/shell.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("./WorkspaceShell.tsx", import.meta.url), "utf8");

test("account and advanced controls live in the sidebar footer, not a standalone rail", () => {
  expect(app).not.toContain('<header className="app-head prototype-rail">');
  expect(app).toContain("const accountControls =");
  expect(app).toContain('className="workspace-account-controls"');
  expect(app).toContain("mobileActions={accountControls} navigationFooter={accountControls}");
  expect(app).toContain("ref={settingsButtonRef}");
  expect(app).toContain("openSettings");
  expect(app).toContain("App.workspace.tools");
  expect(shell).toContain("workspace-navigation-footer");
  expect(shell).toContain("workspace-nav-brand");
});

test("Studio 2.0 shell fills viewport cleanly with collapsible sidebar and responsive drawer", () => {
  expect(shellCss).toContain("#root {");
  expect(shellCss).toContain(".app.prototype-native-workspace");
  expect(shellCss).toContain(".workspace-frame");
  expect(shellCss).toContain("grid-template-columns: var(--ac-sidebar-width) minmax(0, 1fr)");
  expect(shellCss).toContain("grid-template-columns: 56px minmax(0, 1fr)");
  expect(shellCss).toContain(".app-side.mobile-groups-drawer");
  expect(shellCss).toContain("max-height: calc(100dvh - 96px)");
});

test("frame derives palette from root theme and footer controls stay outside scroll area", () => {
  expect(shellCss).toContain("background: var(--t-bg)");
  expect(shellCss).toContain("background: var(--ac-surface-1)");
  expect(shellCss).toContain("color: var(--t-text)");
  expect(shellCss).toContain(".workspace-nav-body");
  expect(shellCss).toContain(".workspace-navigation-footer");
  expect(shellCss).toContain(".navigation-collapsed .workspace-navigation-footer");
});
