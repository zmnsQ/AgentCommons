// @ts-expect-error Bun test APIs are not part of the browser tsconfig.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskRecord, TaskSummary } from "@agentparty/shared";
import { LocaleProvider } from "../i18n/locale";
import { TaskVisualSummary, type TaskVisualSummaryProps } from "./TaskVisualSummary";

const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let locale = "en";
beforeEach(() => {
  locale = "en";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => locale } });
});
afterEach(() => {
  if (storage) Object.defineProperty(globalThis, "localStorage", storage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});
const render = (props: TaskVisualSummaryProps) => renderToStaticMarkup(<LocaleProvider><TaskVisualSummary {...props} /></LocaleProvider>);
const tasks = (...states: TaskRecord["state"][]) => states.map(state => ({ state }));

describe("TaskVisualSummary", () => {
  test("counts every real task state while keeping pending, review and blocked distinct", () => {
    const html = render({ tasks: tasks("triage", "backlog", "assigned", "in_progress", "in_progress", "needs_review", "blocked", "done", "done") });
    expect(html).toContain('aria-label="2 of 9 tasks completed"');
    expect(html).toContain('aria-label="Pending 3 · In progress 2 · Needs review 1 · Blocked 1 · Completed 2"');
    expect((html.match(/<li /g) ?? []).length).toBe(4);
    expect((html.match(/class="task-visual-segment /g) ?? []).length).toBe(5);
    expect(html).not.toContain("progressbar");
    expect(html).not.toContain("%");
  });

  test("uses server totals instead of treating a loaded subset as the whole group", () => {
    const summary: TaskSummary = { type: "task_summary", channel: "demo", total: 100, open: 30, triage: 2, backlog: 3, assigned: 5, in_progress: 10, needs_review: 5, blocked: 5, done: 70, mine: 0 };
    const html = render({ tasks: tasks("done"), summary });
    expect(html).toContain('aria-label="70 of 100 tasks completed"');
    expect(html).toContain("Pending 10 · In progress 10 · Needs review 5 · Blocked 5 · Completed 70");
    expect(html).toContain('data-state="done" style="flex-grow:70"');
  });

  test("initial loading does not claim an empty group, while a refresh retains known counts", () => {
    const initial = render({ tasks: [], loading: true });
    expect(initial).toContain('aria-busy="true"');
    expect(initial).toContain("Loading task status");
    expect(initial).not.toContain("No tasks yet");
    expect(initial).not.toContain("0 of 0");
    expect(initial).not.toContain("<li");
    const refresh = render({ tasks: tasks("done", "blocked"), loading: true });
    expect(refresh).toContain('aria-label="1 of 2 tasks completed"');
    expect(refresh).toContain("Blocked 1");
  });

  test("zero tasks produce an empty track and a clear empty state", () => {
    const html = render({ tasks: [] });
    expect(html).toContain("No tasks yet");
    expect(html).toContain('aria-label="0 of 0 tasks completed"');
    expect(html).not.toContain('class="task-visual-segment ');
    expect(html).not.toContain("NaN");
  });

  test("renders Chinese status names and count semantics", () => {
    locale = "zh";
    const html = render({ tasks: tasks("assigned", "needs_review", "done") });
    expect(html).toContain("任务分布");
    expect(html).toContain('aria-label="共 3 项任务，已完成 1 项"');
    expect(html).toContain("待处理 1 · 进行中 0 · 待验收 1 · 受阻 0 · 已完成 1");
    expect(html).not.toContain("TaskVisuals.");
  });
});
