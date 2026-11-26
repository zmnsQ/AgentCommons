// @ts-expect-error Bun test APIs are outside Vite browser types.
import { expect, test } from "bun:test";
// @ts-expect-error Node file APIs are only used by the test runner.
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("./tokens.css");
const shell = read("./shell.css");
const conversation = read("./conversation.css");
const overlays = read("./overlays.css");
const app = read("../App.tsx");
const main = read("../main.tsx");

test("sidebar retains real tool actions and native disclosure without a permanent rail", () => {
  expect(app).not.toContain('className="prototype-rail-nav"');
  expect(app).toContain("workspace-account-controls");
  expect(app).toContain("prototype-rail-popover");
  expect(app).toContain("App.workspace.tools");
  expect(app).toContain('event.key === "Escape"');
  expect(shell).toContain(".workspace-account-controls .prototype-rail-popover");
  expect(shell).toContain("position: fixed");
  expect(shell).toContain("overflow: auto");
});

test("default root is dark and explicit doodle supplies the full shared light palette", () => {
  const dark = tokens.match(/:root,\s*:root\[data-theme="midnight"\]\s*\{([^}]+)\}/)![1]!;
  const light = tokens.match(/:root\[data-theme="doodle"\]\s*\{([^}]+)\}/)![1]!;
  expect(dark).toContain("--ac-surface-0: #0c0d10");
  expect(light).toContain("--ac-surface-0: #ffffff");
  for (const name of [
    "t-bg",
    "t-panel",
    "t-panel2",
    "t-text",
    "t-body",
    "t-muted",
    "t-accent",
    "t-accent-ink",
    "ac-border",
    "ac-backdrop",
  ]) {
    expect(dark).toContain(`--${name}:`);
    expect(light).toContain(`--${name}:`);
  }
});

test("body portals receive public root surface tokens and Studio 2.0 layers load in order", () => {
  expect(overlays).toContain(".conversation-details-panel");
  expect(overlays).toContain(".settings-panel");
  expect(overlays).toContain(".agent-join-card");
  expect(overlays).toContain("background: var(--ac-surface-2)");
  expect(overlays).toContain("color: var(--t-text)");
  expect(conversation).toContain(".msg-menu");
  expect(main.indexOf("styles/shell.css")).toBeGreaterThan(main.indexOf("styles/app.css"));
  expect(main.indexOf("styles/conversation.css")).toBeGreaterThan(main.indexOf("styles/shell.css"));
  expect(main.indexOf("styles/overlays.css")).toBeGreaterThan(main.indexOf("styles/conversation.css"));
});

test("compact full-width drawer and form sizing preserve viewport and touch behavior", () => {
  expect(shell).toContain("(max-height: 760px) and (pointer: coarse)");
  expect(shell).toContain(".app-side.mobile-groups-drawer");
  expect(shell).not.toMatch(/zoom\s*:|scale\(/);
  expect(shell).toContain("font-size: 16px");
});

test("embedded invitation content overrides legacy popover positioning without clipping its form", () => {
  const rule = overlays.match(/\.joinlink-panel--embedded\s*\{([^}]+)\}/)![1]!;
  for (const declaration of [
    "position: static",
    "inset: auto",
    "width: 100%",
    "max-width: none",
    "max-height: none",
    "margin: 0",
    "overflow: visible",
    "box-sizing: border-box",
    "background: var(--ac-surface-1)",
    "box-shadow: none",
  ]) {
    expect(rule).toContain(declaration);
  }
  expect(overlays).toContain(".joinlink-gen-row");
  expect(overlays).toContain(".joinlink-mode");
  const join = read("../components/JoinLink.tsx");
  expect(join).toContain('embedded ? " joinlink-panel--embedded" : ""');
});
