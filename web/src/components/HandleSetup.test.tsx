// @ts-expect-error Bun runs this test without Vite globals.
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { LocaleProvider } from "../i18n/locale";
// @ts-expect-error Query suffix isolates the actual API from mocks.
const api = await import("../lib/api.ts?handle-actual");
const writes: string[] = [];
let fail = false;
mock.module("../lib/api", () => ({ ...api,
  setNickname: async (value: string) => { writes.push(value); if (fail) throw Error("offline"); return { nickname: value }; },
  setHandle: async (value: string) => { writes.push(value); return { handle: value }; },
}));
const { HandleSetup } = await import("./HandleSetup");
let renderer: ReactTestRenderer | null = null;
beforeEach(() => {
  writes.length = 0; fail = false;
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
});
afterEach(async () => { await act(async () => renderer?.unmount()); renderer = null; });
async function render(current: string | null = null, onClose = () => {}) {
  await act(async () => { renderer = create(<LocaleProvider><HandleSetup mode="nickname" current={current} onSaved={() => {}} onClose={onClose}/></LocaleProvider>); });
  return renderer!.root;
}
function key(extra: object = {}) { return { key: "Enter", preventDefault() {}, stopPropagation() {}, ...extra }; }
test("IME confirmation and composition Escape do not save or close", async () => {
  let closed = 0; const root = await render(null, () => closed++);
  const input = root.findByType("input");
  await act(async () => input.props.onChange({ target: { value: "中文" } }));
  await act(async () => input.props.onKeyDown(key({ nativeEvent: { isComposing: true } })));
  await act(async () => input.props.onKeyDown(key({ keyCode: 229 })));
  await act(async () => input.props.onCompositionStart());
  await act(async () => input.props.onKeyDown(key({ key: "Escape" })));
  expect(writes).toEqual([]); expect(closed).toBe(0);
  await act(async () => input.props.onCompositionEnd());
  await act(async () => input.props.onKeyDown(key()));
  expect(writes).toEqual(["中文"]);
  expect(root.findByProps({ role: "status" }).children.join("")).toBe("Saved");
});
test("unchanged value cannot be saved again and successful save becomes the baseline", async () => {
  const root = await render("name"); const input = root.findByType("input");
  const save = () => root.findByProps({ className: "d-btn d-btn--primary" });
  expect(save().props.disabled).toBe(true);
  await act(async () => input.props.onKeyDown(key())); expect(writes).toEqual([]);
  await act(async () => input.props.onChange({ target: { value: "next" } }));
  await act(async () => save().props.onClick());
  expect(save().props.disabled).toBe(true);
});
test("failed save preserves input and allows retry", async () => {
  const root = await render(); const input = root.findByType("input"); fail = true;
  await act(async () => input.props.onChange({ target: { value: "重试" } }));
  await act(async () => input.props.onKeyDown(key()));
  expect(input.props.value).toBe("重试"); expect(root.findAllByProps({ role: "status" })).toHaveLength(0);
  fail = false; await act(async () => input.props.onKeyDown(key())); expect(writes).toHaveLength(2);
});
