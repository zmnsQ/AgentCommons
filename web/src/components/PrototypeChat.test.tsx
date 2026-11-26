// @ts-expect-error Bun test APIs are not browser types.
import { afterEach, expect, test } from "bun:test";
// @ts-expect-error Node file API is used only by the Bun test runner.
import { readFileSync } from "node:fs";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Composer } from "./Composer";
import { LocaleProvider } from "../i18n/locale";

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

test("desktop composer shows inline tools cleanly and preserves draft & accessible send button", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  try {
    act(() => {
      renderer = create(
        <LocaleProvider>
          <Composer draft="Keep my draft" setDraft={() => {}} onSend={() => {}} ready candidates={[]} mentionStatuses={[]} />
        </LocaleProvider>,
      );
    });
    const root = renderer!.root;
    expect(root.findByProps({ "data-prototype-composer": "true" })).toBeTruthy();
    expect(root.findByProps({ className: "composer-secondary-actions" }).props.hidden).toBe(false);
    expect(root.findByType("textarea").props.value).toBe("Keep my draft");
    expect(root.findByType("textarea").props.rows).toBe(1);
    expect(root.findByProps({ className: "d-btn d-btn--primary composer-send" }).props["aria-label"]).toBeTruthy();
  } finally {
    act(() => renderer?.unmount());
    renderer = null;
    if (original) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", original);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

test("Studio 2.0 conversation styles retain responsive sizing, safe-area padding, and token-driven surfaces", () => {
  const css = readFileSync(new URL("../styles/conversation.css", import.meta.url), "utf8");
  expect(css).toContain("var(--ac-surface-2)");
  expect(css).toContain("var(--ac-reading-width)");
  expect(css).toContain("env(safe-area-inset-bottom)");
  expect(css).toContain(".composer-secondary-actions[hidden]");
  expect(css).toContain(".mention-item.is-active");
  expect(css).not.toContain("zoom:");
});
