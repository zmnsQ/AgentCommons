// @ts-expect-error Bun executes this test, while the web tsconfig intentionally loads only Vite globals.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { LocaleProvider } from "../i18n/locale";
import { ChannelStrings } from "../i18n/strings/Channel";
import { GuardSettingsPanel, type GuardSettingsPanelProps } from "./Channel";

// issue #182:「这里输入不了」+「一键设置无限模式」。
// 这里守两件事：
//  (1) 循环守卫启用时占位符是数值区间提示（1-10000），不再是误导人的「无限」——
//      「无限」占位符曾让人以为清空=无限，保存却报「必须是 1-10000」，即「输入不了」。
//  (2) 有一个一键按钮，点一下就把守卫置为无限/关闭（enabled=false）并落库。

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

let renderer: ReactTestRenderer | null = null;

const noop = () => {};

function baseProps(overrides: Partial<GuardSettingsPanelProps> = {}): GuardSettingsPanelProps {
  return {
    canModerate: true,
    loopEnabled: true,
    loopLimit: "",
    workflowEnabled: true,
    workflowLimit: "30",
    saving: null,
    error: null,
    onLoopEnabled: noop,
    onLoopLimit: noop,
    onWorkflowEnabled: noop,
    onWorkflowLimit: noop,
    onSaveLoop: noop,
    onSaveWorkflow: noop,
    onLoopUnlimited: noop,
    onWorkflowUnlimited: noop,
    ...overrides,
  };
}

function render(locale: "en" | "zh", props: GuardSettingsPanelProps) {
  localStorage.setItem("ap_locale", locale);
  act(() => {
    renderer = create(
      <LocaleProvider>
        <GuardSettingsPanel {...props} />
      </LocaleProvider>,
    );
  });
  return renderer!.root;
}

function inputs() {
  return renderer!.root.findAll((n) => n.props.className === "guard-limit-input");
}

function unlimitedButtons() {
  return renderer!.root.findAll((n) => n.type === "button" && n.props.className?.includes("guard-unlimited-btn"));
}

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
});

afterEach(() => {
  if (renderer) {
    act(() => renderer!.unmount());
    renderer = null;
  }
});

describe("GuardSettingsPanel input affordance (#182)", () => {
  test("loop input placeholder is a numeric range hint when enabled, not '无限'", () => {
    render("zh", baseProps({ loopEnabled: true }));
    const loop = inputs()[0]!;
    expect(loop.props.placeholder).toBe(ChannelStrings.zh["Channel.settings.loopRange"]);
    expect(loop.props.placeholder).not.toBe(ChannelStrings.zh["Channel.settings.unlimited"]);
  });

  test("loop input placeholder falls back to '无限' when the guard is off", () => {
    render("zh", baseProps({ loopEnabled: false }));
    const loop = inputs()[0]!;
    expect(loop.props.placeholder).toBe(ChannelStrings.zh["Channel.settings.unlimited"]);
  });

  test("workflow input placeholder is a numeric range hint when enabled", () => {
    render("zh", baseProps({ workflowEnabled: true }));
    const workflow = inputs()[1]!;
    expect(workflow.props.placeholder).toBe(ChannelStrings.zh["Channel.settings.workflowRange"]);
  });
});

describe("GuardSettingsPanel explicit save", () => {
  test("disabling edits a draft rather than silently persisting, with a saved-state badge", () => {
    let next: boolean | null = null; let saved = 0;
    const props = baseProps({ saved: {loopEnabled: true, loopLimit: "10", workflowEnabled: true, workflowLimit: "30"}, loopEnabled: false, loopLimit: "10", onLoopEnabled: value => {next = value;}, onSaveLoop: () => {saved++;} });
    const root = render("en", props);
    expect(unlimitedButtons()).toHaveLength(0);
    expect(root.findByProps({className: "guard-settings-state"}).children[0]).toBe(ChannelStrings.en["Channel.settings.enabled"]);
    expect(root.findByProps({role: "status"}).children.join("")).toContain("Unsaved");
    act(() => root.findAllByProps({type:"checkbox"})[0]!.props.onChange({currentTarget:{checked:false}}));
    expect(next).toBe(false); expect(saved).toBe(0);
    act(() => root.findAllByType("button")[0]!.props.onClick()); expect(saved).toBe(1);
  });
  test("unchanged saved sections have no pending indication and cannot save", () => {
    const root = render("en", baseProps({loopLimit:"10", saved:{loopEnabled:true,loopLimit:"10",workflowEnabled:true,workflowLimit:"30"}}));
    expect(root.findAllByProps({role:"status"})).toHaveLength(0);
    expect(root.findAllByType("button").every(button => button.props.disabled)).toBe(true);
  });
  test("non-moderators and in-flight saves cannot change settings", () => {
    for (const props of [baseProps({canModerate:false}),baseProps({saving:"loop"})]) {
      const root = render("en",props);
      expect(root.findAllByType("input").every(input => input.props.disabled)).toBe(true);
      expect(root.findAllByType("button").every(button => button.props.disabled)).toBe(true);
      act(()=>renderer!.unmount());renderer=null;
    }
  });
});

describe("GuardSettingsPanel i18n (#182)", () => {
  const KEYS = [
    "Channel.settings.loopRange",
    "Channel.settings.workflowRange",
    "Channel.settings.setUnlimited",
    "Channel.settings.turnOff",
  ];

  test("every new key exists in both en and zh", () => {
    for (const key of KEYS) {
      expect(ChannelStrings.en[key], `en missing ${key}`).toBeTruthy();
      expect(ChannelStrings.zh[key], `zh missing ${key}`).toBeTruthy();
    }
  });

  test("action-label copy is real Chinese, not the English string", () => {
    for (const key of ["Channel.settings.setUnlimited", "Channel.settings.turnOff"]) {
      expect(ChannelStrings.zh[key], `zh copied en for ${key}`).not.toBe(ChannelStrings.en[key]);
    }
  });
});
