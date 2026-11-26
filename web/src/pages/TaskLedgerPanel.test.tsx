// @ts-expect-error Bun executes this test, while the web tsconfig intentionally loads only Vite globals.
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { Attachment, TaskRecord } from "@agentparty/shared";
import { LocaleProvider } from "../i18n/locale";

// Channel.tsx 会 import dompurify（经 markdown 链路）——测试环境里存桩掉。
mock.module("dompurify", () => ({
  default: { addHook: () => {}, sanitize: (value: string) => value },
}));

const { TaskLedgerPanel, isTaskLedgerStatusNote } = await import("./Channel");

// #204 P1②：判定哪些 system status 触发任务台账刷新（多客户端一致性）。
describe("isTaskLedgerStatusNote (#204 P1②)", () => {
  test("matches worker-broadcast task status notes", () => {
    expect(isTaskLedgerStatusNote("task #12 in_progress")).toBe(true);
    expect(isTaskLedgerStatusNote("task #3 blocked")).toBe(true);
    expect(isTaskLedgerStatusNote("task #1 done")).toBe(true);
  });
  test("ignores non-task and lookalike notes (no false refetch)", () => {
    expect(isTaskLedgerStatusNote("charter updated to rev 5")).toBe(false);
    expect(isTaskLedgerStatusNote("worker-a working on task #5")).toBe(false); // 必须以 task # 开头
    expect(isTaskLedgerStatusNote("task #x oops")).toBe(false); // 需数字 id
    expect(isTaskLedgerStatusNote("task #12")).toBe(false); // 需 state 段（后随空格）
  });
});

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const values = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    type: "task",
    id: 1,
    channel: "demo",
    title: "wire the task panel",
    desc: null,
    state: "backlog",
    assignee: null,
    created_by: "human-a",
    created_by_kind: "human",
    priority: 0,
    labels: [],
    parent_id: null,
    anchor_seqs: [],
    completion_artifact: null,
    workflow_id: null,
    scope: [],
    blocked_reason: null,
    external_ref: null,
    created_at: 0,
    updated_at: 0,
    completed_at: null,
    ...overrides,
  };
}

type PanelProps = Parameters<typeof TaskLedgerPanel>[0];
type NodeMockFactory = NonNullable<NonNullable<Parameters<typeof create>[1]>["createNodeMock"]>;

function baseProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    tasks: [task()],
    loading: false,
    error: null,
    canWrite: true,
    busyTaskId: null,
    actionError: null,
    creating: false,
    createError: null,
    onRefresh: () => {},
    onSetState: () => {},
    onAssign: () => {},
    onReview: () => {},
    onCreateTask: async () => true,
    ...overrides,
  };
}

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
});

afterEach(async () => {
  if (renderer !== null) await act(async () => renderer?.unmount());
  renderer = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
});

function render(
  locale: "en" | "zh",
  props: PanelProps,
  createNodeMock?: NodeMockFactory,
): ReactTestRenderer {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage({ ap_locale: locale }),
  });
  let r!: ReactTestRenderer;
  void act(() => {
    r = create(
      <LocaleProvider><TaskLedgerPanel {...props} /></LocaleProvider>,
      createNodeMock === undefined ? undefined : { createNodeMock },
    );
  });
  renderer = r;
  return r;
}

function allText(r: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === "object" && "children" in (node as Record<string, unknown>)) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(r.toJSON());
  return out.join(" ");
}

function findByAria(r: ReactTestRenderer, label: string) {
  return r.root.find((n) => n.props["aria-label"] === label);
}

async function openTask(r: ReactTestRenderer, id = 1) {
  await act(async () => {
    r.root.findByProps({ "data-task-id": id }).findByProps({ className: "task-card-open" }).props.onClick();
  });
}

describe("TaskLedgerPanel i18n", () => {
  test("renders Chinese action + column labels when locale is zh", async () => {
    const r = render("zh", baseProps());
    expect(allText(r)).toContain("新建任务");
    await openTask(r);
    const text = allText(r);
    expect(text).toContain("开始处理");
    expect(text).toContain("阻塞"); // Block
    expect(text).toContain("待办"); // backlog state label
    expect(text).not.toContain("Claim");
    expect(text).not.toContain("New task");
  });

  test("renders English labels when locale is en", async () => {
    const r = render("en", baseProps());
    expect(allText(r)).toContain("New task");
    await openTask(r);
    const text = allText(r);
    expect(text).toContain("Start work");
  });
});

describe("TaskLedgerPanel new-task entry", () => {
  test("opening the composer and submitting fires onCreateTask exactly once with the typed values", async () => {
    const calls: Array<Parameters<PanelProps["onCreateTask"]>[0]> = [];
    const onCreateTask = mock(async (input: Parameters<PanelProps["onCreateTask"]>[0]) => {
      calls.push(input);
      return true;
    });
    const r = render("en", baseProps({ onCreateTask }));

    // open composer
    await act(async () => {
      findByAria(r, "New task").props.onClick();
    });
    // type a title
    await act(async () => {
      findByAria(r, "New task title").props.onChange({ currentTarget: { value: "ship it" } });
    });
    // submit the form
    await act(async () => {
      await r.root.find((n) => n.props.className === "task-new-form").props.onSubmit({ preventDefault() {} });
    });

    expect(onCreateTask).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([{ title: "ship it", desc: "", priority: 0, assignee: null, attachments: [] }]);
  });

  test("creates with the selected owner type and priority", async () => {
    const calls: Array<Parameters<PanelProps["onCreateTask"]>[0]> = [];
    const onCreateTask = mock(async (input: Parameters<PanelProps["onCreateTask"]>[0]) => {
      calls.push(input);
      return true;
    });
    const r = render("en", baseProps({
      identities: [{ name: "worker-a", display: "Luis · angel", kind: "agent" }],
      onCreateTask,
    }));

    await act(async () => findByAria(r, "New task").props.onClick());
    await act(async () => {
      findByAria(r, "New task title").props.onChange({ currentTarget: { value: "ship owner controls" } });
      findByAria(r, "New task owner").props.onChange({ currentTarget: { value: "worker-a" } });
      findByAria(r, "New task priority").props.onChange({ currentTarget: { value: "2" } });
    });
    await act(async () => {
      await r.root.find((n) => n.props.className === "task-new-form").props.onSubmit({ preventDefault() {} });
    });

    expect(calls).toEqual([{
      title: "ship owner controls",
      desc: "",
      priority: 2,
      assignee: { name: "worker-a", kind: "agent" },
      attachments: [],
    }]);
  });

  test("submitting with an empty title never calls onCreateTask", async () => {
    const onCreateTask = mock(async () => true);
    const r = render("en", baseProps({ onCreateTask }));

    await act(async () => {
      findByAria(r, "New task").props.onClick();
    });
    await act(async () => {
      await r.root.find((n) => n.props.className === "task-new-form").props.onSubmit({ preventDefault() {} });
    });

    expect(onCreateTask).toHaveBeenCalledTimes(0);
  });

  test("Enter cannot submit while an attachment upload is still in flight", async () => {
    const onCreateTask = mock(async () => true);
    let finishUpload: ((attachment: Attachment) => void) | undefined;
    const onUploadAttachment = mock(() => new Promise<Attachment>((resolve) => {
      finishUpload = resolve;
    }));
    const r = render("en", baseProps({ onCreateTask, onUploadAttachment }));

    await act(async () => findByAria(r, "New task").props.onClick());
    await act(async () => {
      findByAria(r, "New task title").props.onChange({ currentTarget: { value: "wait for upload" } });
      r.root.find((node) => node.type === "input" && node.props.type === "file").props.onChange({
        currentTarget: {
          files: [{ name: "proof.txt" }],
          value: "proof.txt",
        },
      });
    });
    await act(async () => {
      r.root.find((node) => node.props.className === "task-new-form").props.onSubmit({ preventDefault() {} });
    });

    expect(onCreateTask).toHaveBeenCalledTimes(0);

    await act(async () => {
      finishUpload?.({
        key: "proof",
        filename: "proof.txt",
        content_type: "text/plain",
        size: 5,
        url: "/attachments/proof",
      });
      await Promise.resolve();
    });
    expect(findByAria(r, "Remove proof.txt")).toBeDefined();
  });
});

describe("TaskLedgerPanel inline rejection (#357)", () => {
  test("reject opens a textarea and submits the trimmed reason", async () => {
    const reviews: Array<{ id: number; action: string; reason?: string }> = [];
    const reviewable = task({ state: "needs_review", completion_artifact: {}, anchor_seqs: [42] });
    const r = render("en", baseProps({
      tasks: [reviewable],
      onReview: (item, action, reason) => { reviews.push({ id: item.id, action, reason }); },
    }));

    await openTask(r);
    await act(async () => {
      r.root.find((n) => n.type === "button" && n.children.includes("Reject")).props.onClick();
    });
    const reason = findByAria(r, "Reject reason for task 1");
    await act(async () => reason.props.onChange({ currentTarget: { value: "  add test evidence  " } }));
    await act(async () => r.root.find((n) => n.props.className === "task-action-btn task-reject-confirm").props.onClick());

    expect(reviews).toEqual([{ id: 1, action: "reject", reason: "add test evidence" }]);
  });

  test("cancel closes the rejection editor without reviewing", async () => {
    const onReview = mock(() => undefined);
    const reviewable = task({ state: "needs_review", completion_artifact: {}, anchor_seqs: [42] });
    const r = render("en", baseProps({ tasks: [reviewable], onReview }));
    await openTask(r);
    await act(async () => r.root.find((n) => n.type === "button" && n.children.includes("Reject")).props.onClick());
    await act(async () => r.root.find((n) => n.props.className === "task-action-btn task-reject-cancel").props.onClick());
    expect(r.root.findAll((n) => n.props.className === "task-new-form task-reject-form")).toHaveLength(0);
    expect(onReview).toHaveBeenCalledTimes(0);
  });
});

describe("TaskLedgerPanel detail actions", () => {
  test("blocking a task requires and forwards a trimmed reason", async () => {
    const stateChanges: Array<[number, string, string | undefined]> = [];
    const r = render("en", baseProps({
      onSetState: (id, state, reason) => { stateChanges.push([id, state, reason]); },
    }));

    await openTask(r);
    await act(async () => {
      r.root.find((n) => n.type === "button" && n.children.includes("Block")).props.onClick();
    });
    const reason = findByAria(r, "Blocked reason for task 1");
    await act(async () => reason.props.onChange({ currentTarget: { value: "  waiting for credentials  " } }));
    await act(async () => {
      r.root.find((n) => n.props.className === "task-new-form task-block-form")
        .props.onSubmit({ preventDefault() {} });
    });

    expect(stateChanges).toEqual([[1, "blocked", "waiting for credentials"]]);
  });

  test("source messages navigate back to the original discussion", async () => {
    const opened: number[] = [];
    const r = render("en", baseProps({
      tasks: [task({ anchor_seqs: [42, 43] })],
      onOpenMessage: (seq) => { opened.push(seq); },
    }));

    await openTask(r);
    await act(async () => {
      r.root.find((n) => n.type === "button" && n.children.includes("Open message #42")).props.onClick();
    });
    expect(opened).toEqual([42]);
  });
});

describe("TaskLedgerPanel assignee filter (#271)", () => {
  const filterTasks = () => [
    task({ id: 1, title: "alpha-task", assignee: { name: "worker-a", kind: "agent" } }),
    task({ id: 2, title: "bravo-task", assignee: { name: "worker-b", kind: "agent" }, state: "in_progress" }),
    task({ id: 3, title: "charlie-task" }),
  ];

  test("dropdown lists each assignee once and filters the board", async () => {
    const r = render("en", baseProps({ tasks: filterTasks() }));
    const select = findByAria(r, "Filter by assignee");
    const values = select.findAllByType("option").map((o) => o.props.value);
    expect(values).toEqual(["all", "__unassigned__", "worker-a", "worker-b"]);

    await act(async () => {
      select.props.onChange({ currentTarget: { value: "worker-a" } });
    });
    let text = allText(r);
    expect(text).toContain("alpha-task");
    expect(text).not.toContain("bravo-task");
    expect(text).not.toContain("charlie-task");

    await act(async () => {
      findByAria(r, "Filter by assignee").props.onChange({ currentTarget: { value: "__unassigned__" } });
    });
    text = allText(r);
    expect(text).toContain("charlie-task");
    expect(text).not.toContain("alpha-task");
  });

  test("dropdown stays hidden while no task has an assignee", () => {
    const r = render("en", baseProps());
    expect(r.root.findAll((n) => n.props["aria-label"] === "Filter by assignee")).toHaveLength(0);
  });

  test("uses readable owner labels instead of raw agent routing names", () => {
    const r = render("en", baseProps({
      tasks: [task({ assignee: { name: "worker-a", kind: "agent" } })],
      identities: [{ name: "worker-a", display: "Luis · angel", kind: "agent" }],
    }));

    expect(allText(r)).toContain("Owner: Luis · angel");
    expect(allText(r)).not.toContain("Owner: worker-a");
  });
});

describe("TaskLedgerPanel default scope", () => {
  test("starts with unfinished work and reveals completed tasks only when requested", async () => {
    const r = render("en", baseProps({
      tasks: [
        task({ id: 1, title: "open-task" }),
        task({ id: 2, title: "completed-task", state: "done" }),
      ],
    }));

    expect(allText(r)).toContain("open-task");
    expect(allText(r)).not.toContain("completed-task");
    expect(r.root.findAll((node) => node.props.className === "task-blog-chip task-blog-clear")).toHaveLength(0);
    const stateFilters = findByAria(r, "Filter tasks by state");
    await act(async () => {
      stateFilters.findAllByType("button").at(-1)!.props.onClick();
    });
    expect(allText(r)).toContain("completed-task");
    const clearFilters = r.root.find((node) => node.props.className === "task-blog-chip task-blog-clear");
    await act(async () => clearFilters.props.onClick());
    expect(allText(r)).not.toContain("completed-task");
    expect(r.root.findAll((node) => node.props.className === "task-blog-chip task-blog-clear")).toHaveLength(0);
  });
});

// #271(b)：指派输入框接 datalist，候选来自频道身份。
describe("TaskLedgerPanel typed assignee picker", () => {
  test("lists readable channel identities with their locked types", async () => {
    const r=render("en",baseProps({identities:[{name:"worker-a",kind:"agent",display:"Alice's agent"},{name:"alice",kind:"human",display:"Alice"}]}));await openTask(r);
    const picker=findByAria(r,"Assign task 1");
    expect(picker.type).toBe("select");
    expect(picker.findAllByType("option").map(option=>option.props.value)).toEqual(["","worker-a","alice","__custom__"]);
  });
  test("supports an explicit custom target when no identities are loaded", async () => {
    const r=render("en",baseProps());await openTask(r);
    await act(async()=>findByAria(r,"Assign task 1").props.onChange({currentTarget:{value:"__custom__"}}));
    expect(findByAria(r,"Member or team name")).toBeDefined();
  });
});

describe("TaskLedgerPanel expanded view (#271)", () => {
  test("toggle flips the --expanded class and aria-pressed", async () => {
    const r = render("en", baseProps());
    const section = r.root.find((n) => n.props["aria-label"] === "channel tasks");
    expect(section.props.className).toBe("task-ledger-panel");

    const toggle = findByAria(r, "Toggle task panel width");
    expect(toggle.props["aria-pressed"]).toBe(false);
    await act(async () => { toggle.props.onClick(); });

    expect(r.root.find((n) => n.props["aria-label"] === "channel tasks").props.className)
      .toBe("task-ledger-panel task-ledger-panel--expanded");
    // 博客风把展开钮改成图标（⇱/⇲），可见状态由 aria-pressed 表达（文案断言已上移到 aria）。
    expect(findByAria(r, "Toggle task panel width").props["aria-pressed"]).toBe(true);

    await act(async () => { findByAria(r, "Toggle task panel width").props.onClick(); });
    expect(r.root.find((n) => n.props["aria-label"] === "channel tasks").props.className)
      .toBe("task-ledger-panel");
  });
});

// #271(c)：点击任务卡标题进入台账内详情路由（完整 title/desc/meta）。
describe("TaskLedgerPanel task detail (#271)", () => {
  test("uses one in-panel route, focuses Back, and Escape restores the task trigger", async () => {
    const detailed = task({
      id: 7,
      title: "detail-task",
      desc: "long description body",
      assignee: { name: "worker-a", kind: "agent" },
      labels: ["infra"],
      solution: {
        key: "demo/11111111-1111-1111-1111-111111111111/solution.html",
        filename: "solution.html",
        content_type: "text/html",
        size: 123,
        url: "/api/channels/demo/attachments/11111111-1111-1111-1111-111111111111/solution.html",
      },
    });
    let focused = "";
    const titleNode = { isConnected: true, focus: () => { focused = "title"; } };
    const backNode = { isConnected: true, focus: () => { focused = "back"; } };
    const fakeWindow = new EventTarget();
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
    const r = render("en", baseProps({ tasks: [detailed] }), (element) => {
      const props = element.props as Record<string, unknown>;
      if (props.className === "task-card-open") return titleNode;
      if (props.className === "d-btn task-detail-close") return backNode;
      return {};
    });
    expect(r.root.findAll((n) => n.props["aria-label"] === "task 7 details")).toHaveLength(0);

    await openTask(r, 7);
    findByAria(r, "task 7 details");
    expect(focused).toBe("back");
    expect(r.root.findAll((n) => n.props.role === "dialog")).toHaveLength(0);
    expect(r.root.findAll((n) => n.props["aria-modal"] === true)).toHaveLength(0);
    expect(r.root.findAll((n) => n.props.className === "task-board")).toHaveLength(0);
    const text = allText(r);
    expect(text).toContain("long description body");
    expect(text).toContain("created by"); // meta 标签只出现在详情里
    expect(text).toContain("human-a");
    expect(text).toContain("worker-a");
    expect(text).not.toContain("@worker-a");
    expect(text).toContain("Solution");
    expect(text).toContain("solution.html");

    let outerCloseCalls = 0;
    fakeWindow.addEventListener("keydown", (rawEvent) => {
      const event = rawEvent as Event & { key: string };
      if (event.key === "Escape" && !event.defaultPrevented) outerCloseCalls += 1;
    });
    const escape = new Event("keydown", { cancelable: true }) as Event & { key: string };
    escape.key = "Escape";
    await act(async () => {
      fakeWindow.dispatchEvent(escape);
    });
    expect(escape.defaultPrevented).toBe(true);
    expect(outerCloseCalls).toBe(0);
    expect(focused).toBe("title");
    expect(r.root.findAll((n) => n.props["aria-label"] === "task 7 details")).toHaveLength(0);
    expect(r.root.findAll((n) => n.props.className === "task-board")).toHaveLength(1);
  });

  test("detail route shows a placeholder when the task has no desc", async () => {
    const r = render("en", baseProps({ tasks: [task({ id: 9, desc: null })] }));
    expect(r.root.findAll((n) => typeof n.props.className === "string" && n.props.className.startsWith("task-solution"))).toHaveLength(0);
    await act(async () => { findByAria(r, "Open task 9 details").props.onClick(); });
    expect(allText(r)).toContain("No details");
    expect(r.root.find((n) => n.props.className === "d-btn task-detail-close").children.join("")).toContain("Back to tasks");
    expect(r.root.findAll((n) => typeof n.props.className === "string" && n.props.className.startsWith("task-solution"))).toHaveLength(0);
  });
});

describe("TaskLedgerPanel external task selection", () => {
  test("opens the selected task detail and preserves existing filters when returning", async () => {
    const first = task({ id: 1, title: "alpha-task", assignee: { name: "worker-a", kind: "agent" } });
    const selected = task({ id: 2, title: "bravo-task", state: "in_progress", assignee: { name: "worker-b", kind: "agent" } });
    let backFocusCount = 0;
    const initialProps = baseProps({ tasks: [first, selected] });
    const r = render("en", initialProps, (element) => {
      const props = element.props as Record<string, unknown>;
      if (props.className === "d-btn task-detail-close") {
        return { focus: () => { backFocusCount += 1; } };
      }
      return {};
    });

    const search = findByAria(r, "Search tasks");
    await act(async () => search.props.onChange({ currentTarget: { value: "alpha" } }));
    expect(allText(r)).toContain("alpha-task");
    expect(allText(r)).not.toContain("bravo-task");

    await act(async () => {
      r.update(
        <LocaleProvider>
          <TaskLedgerPanel {...initialProps} selectedTaskId={2} />
        </LocaleProvider>,
      );
    });

    findByAria(r, "task 2 details");
    expect(allText(r)).toContain("bravo-task");
    expect(r.root.findAll((node) => node.props.className === "task-board")).toHaveLength(0);
    expect(backFocusCount).toBe(1);

    await act(async () => {
      r.root.find((node) => node.props.className === "d-btn task-detail-close").props.onClick();
    });
    expect(findByAria(r, "Search tasks").props.value).toBe("alpha");
    expect(allText(r)).toContain("alpha-task");
  });

  test("opens a selected completed task beyond the collapsed done limit", async () => {
    const completed = Array.from({ length: 8 }, (_, index) => task({
      id: index + 1,
      title: `completed-${index + 1}`,
      state: "done",
    }));
    const r = render("en", baseProps({ tasks: completed, selectedTaskId: 8 }), (element) => {
      const props = element.props as Record<string, unknown>;
      return props.className === "d-btn task-detail-close" ? { focus: () => {} } : {};
    });
    await act(async () => {});

    findByAria(r, "task 8 details");
    expect(allText(r)).toContain("completed-8");
    expect(r.root.findAll((node) => node.props.className === "task-board")).toHaveLength(0);
  });
});

test('non-sensitive task filters survive panel unmount and remount',()=>{
 const viewMemory:NonNullable<PanelProps['viewMemory']>={current:null};
 const r=render('en',baseProps({viewMemory}));
 const search=r.root.findAll(n=>n.type==='input'&&n.props.value==='').find(n=>n.props.onChange&&n.props.placeholder);
 expect(search).toBeDefined();
 act(()=>search!.props.onChange({currentTarget:{value:'retained query'}}));
 expect(viewMemory.current?.query).toBe('retained query');
 act(()=>r.unmount());renderer=null;
 const next=render('en',baseProps({viewMemory}));
 expect(next.root.findAll(n=>n.type==='input'&&n.props.value==='retained query')).toHaveLength(1);
 expect(Object.keys(viewMemory.current!)).not.toContain('credential');
});

test('leaving an externally selected task clears its request so the same task can open again',()=>{
 let selected:number|null=1;
 const props=baseProps();
 const draw=()=> <LocaleProvider><TaskLedgerPanel {...props} selectedTaskId={selected} onSelectedTaskDismiss={()=>{selected=null;renderer!.update(draw());}}/></LocaleProvider>;
 const r=render('en', {...props,selectedTaskId:selected});
 act(()=>r.update(draw()));
 const back=r.root.find(n=>n.type==='button'&&n.props.className==='d-btn task-detail-close');
 act(()=>back.props.onClick());expect(selected).toBeNull();
 expect(r.root.findAll(n=>n.props.className==='task-detail-card task-detail-route')).toHaveLength(0);
 act(()=>{selected=1;r.update(draw());});
 expect(r.root.findAll(n=>n.props.className==='task-detail-card task-detail-route')).toHaveLength(1);
});

describe("task drafts survive asynchronous work", () => {
  const attachment = (name: string): Attachment => ({key:name,filename:name,content_type:"text/plain",size:1,url:`/attachments/${name}`});
  test("cancel invalidates pending uploads before the next draft opens", async () => {
    let finish!: (value: Attachment) => void;
    const r = render("en", baseProps({onUploadAttachment:()=>new Promise(resolve=>{finish=resolve;})}));
    await act(async()=>findByAria(r,"New task").props.onClick());
    await act(async()=>r.root.findByProps({type:"file"}).props.onChange({currentTarget:{files:[{name:"old.txt"}],value:""}}));
    await act(async()=>r.root.findAllByType("button").find(button=>button.children.includes("Cancel"))!.props.onClick());
    await act(async()=>findByAria(r,"New task").props.onClick());
    await act(async()=>finish(attachment("old.txt")));
    expect(r.root.findAllByProps({className:"task-new-att-name"})).toHaveLength(0);
  });
  test("partial failures retain successful files and retry only failed files", async () => {
    const attempts: string[] = []; let fail = true;
    const r = render("en",baseProps({onUploadAttachment:async file=>{attempts.push(file.name);if(file.name==='bad.txt'&&fail)throw Error('offline');return attachment(file.name);}}));
    await act(async()=>findByAria(r,"New task").props.onClick());
    await act(async()=>r.root.findByProps({type:"file"}).props.onChange({currentTarget:{files:[{name:"ok.txt"},{name:"bad.txt"}],value:""}}));
    expect(r.root.findAllByProps({className:"task-new-att-name"}).map(node=>node.children.join(''))).toEqual(['ok.txt']);
    expect(allText(r)).toContain('bad.txt'); fail=false;
    await act(async()=>r.root.findByProps({'aria-label':'Retry bad.txt'}).props.onClick());
    expect(attempts).toEqual(['ok.txt','bad.txt','bad.txt']);
    expect(r.root.findAllByProps({className:"task-new-att-name"})).toHaveLength(2);
  });
  test("a failed block request retains its reason and retry clears only on success", async () => {
    let success = false;
    const r = render("en",baseProps({onSetState:async()=>success}));await openTask(r);
    await act(async()=>r.root.findAllByType('button').find(button=>button.children.includes('Block'))!.props.onClick());
    const form=()=>r.root.findByProps({className:'task-new-form task-block-form'});
    await act(async()=>form().findByType('textarea').props.onChange({currentTarget:{value:'waiting for credentials'}}));
    await act(async()=>form().props.onSubmit({preventDefault(){}}));
    expect(form().findByType('textarea').props.value).toBe('waiting for credentials');
    success=true;await act(async()=>form().props.onSubmit({preventDefault(){}}));
    expect(r.root.findAllByProps({className:'task-new-form task-block-form'})).toHaveLength(0);
  });
  test("a rejected review promise retains the draft and offers retry", async () => {
    const r=render('en',baseProps({tasks:[task({state:'needs_review',completion_artifact:{},anchor_seqs:[42]})],onReview:async()=>{throw Error('offline');}}));await openTask(r);
    expect(r.root.findAllByType('button').some(button=>button.children.includes('Done'))).toBe(false);
    await act(async()=>r.root.findAllByType('button').find(button=>button.children.includes('Reject'))!.props.onClick());
    await act(async()=>findByAria(r,'Reject reason for task 1').props.onChange({currentTarget:{value:'missing evidence'}}));
    await act(async()=>r.root.findByProps({className:'task-action-btn task-reject-confirm'}).props.onClick());
    expect(findByAria(r,'Reject reason for task 1').props.value).toBe('missing evidence');expect(allText(r)).toContain('preserved');
  });
  test("selecting a human for assignment infers human without an editable kind control", async () => {
    const assigned: unknown[]=[]; const r=render('en',baseProps({identities:[{name:'alice',kind:'human',display:'Alice'}],onAssign:(...args)=>{assigned.push(args);}}));await openTask(r);
    const form=r.root.findByProps({className:'task-assign-form'});
    await act(async()=>form.findByType('select').props.onChange({currentTarget:{value:'alice'}}));
    await act(async()=>form.props.onSubmit({preventDefault(){}}));expect(assigned).toEqual([[1,'alice','human']]);expect(form.findAllByType('select')).toHaveLength(1);
  });
  test("dropping into blocked asks for a reason instead of changing state immediately", async () => {
    let changes=0;const r=render('en',baseProps({onSetState:()=>{changes++;}}));
    const column=r.root.findAll(node=>node.props.className==='task-column').find(node=>String(node.props['aria-label']).includes('Blocked'))!;
    await act(async()=>column.props.onDrop({preventDefault(){},dataTransfer:{getData:()=> '1'}}));
    expect(changes).toBe(0);expect(r.root.findAllByProps({className:'task-new-form task-block-form'})).toHaveLength(1);
  });
});
