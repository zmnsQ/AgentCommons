// @ts-expect-error Bun test APIs are not part of the browser tsconfig.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../i18n/locale";
import { TaskActivityTimeline, type TaskActivityTimelineProps } from "./TaskActivityTimeline";

const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let locale = "en";
const created = Date.UTC(2026, 10, 6, 2);
const updated = created + 60_000;
const completed = created + 120_000;
beforeEach(() => {
  locale = "en";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => locale } });
});
afterEach(() => {
  if (storage) Object.defineProperty(globalThis, "localStorage", storage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});
const render = (task: TaskActivityTimelineProps["task"]) => renderToStaticMarkup(<LocaleProvider><TaskActivityTimeline task={task} /></LocaleProvider>);
const events = (html: string) => [...html.matchAll(/data-event="(.*?)"/g)].map(match => match[1]);
const times = (html: string) => [...html.matchAll(/dateTime="(.*?)"/g)].map(match => match[1]);

describe("TaskActivityTimeline", () => {
  test("renders only the three supplied record timestamps with machine-readable dates", () => {
    const html = render({ created_at: created, updated_at: updated, completed_at: completed });
    expect(events(html)).toEqual(["created", "updated", "completed"]);
    expect(times(html)).toEqual([created, updated, completed].map(time => new Date(time).toISOString()));
    expect(html).toContain("Last updated");
    expect(html).not.toContain("Assigned");
    expect(html).not.toContain("Started");
    expect(html).not.toContain("%");
  });

  test("does not fabricate completion or intermediate events for an open task", () => {
    const html = render({ created_at: created, updated_at: updated, completed_at: null });
    expect(events(html)).toEqual(["created", "updated"]);
    expect(html).not.toContain("Completed");
  });

  test("coincident updates do not duplicate a creation or completion record", () => {
    expect(events(render({ created_at: created, updated_at: created, completed_at: null }))).toEqual(["created"]);
    expect(events(render({ created_at: created, updated_at: completed, completed_at: completed }))).toEqual(["created", "completed"]);
  });

  test("an update after completion stays chronological rather than becoming a synthetic state path", () => {
    const html = render({ created_at: created, updated_at: completed + 60_000, completed_at: completed });
    expect(events(html)).toEqual(["created", "completed", "updated"]);
    expect(times(html)).toEqual([created, completed, completed + 60_000].map(time => new Date(time).toISOString()));
  });

  test("omits invalid timestamps instead of generating dates or current-time placeholders", () => {
    expect(events(render({ created_at: created, updated_at: NaN, completed_at: Infinity }))).toEqual(["created"]);
    expect(render({ created_at: -1, updated_at: NaN, completed_at: null })).toBe("");
  });

  test("renders Chinese labels for the same timestamps", () => {
    locale = "zh";
    const html = render({ created_at: created, updated_at: updated, completed_at: completed });
    expect(html).toContain("任务记录");
    expect(html).toContain("创建");
    expect(html).toContain("最近更新");
    expect(html).toContain("完成");
    expect(html).not.toContain("TaskVisuals.");
    expect(times(html)).toEqual([created, updated, completed].map(time => new Date(time).toISOString()));
  });
});
