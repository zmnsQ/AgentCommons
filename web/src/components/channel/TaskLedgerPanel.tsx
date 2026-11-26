import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Attachment, TaskAssigneeKind, TaskRecord, TaskState } from "@agentparty/shared";
import type { ChannelIdentity } from "../../lib/api";
import { useCompactViewport } from "../../lib/useCompactViewport";
import { fmtTime } from "../../lib/time";
import { AttachmentList } from "../AttachmentList";
import { StudioIcon } from "../StudioIcon";
import { useT } from "../../i18n/useT";
import "../../i18n/strings/Channel";

const TASK_BOARD_STATES: readonly TaskState[] = ["triage", "backlog", "assigned", "in_progress", "needs_review", "blocked", "done"];

export function taskCompletionSeq(task: TaskRecord): number | null {
  if (task.state !== "needs_review" || task.completion_artifact === null) return null;
  const seq = task.anchor_seqs.at(-1);
  return Number.isInteger(seq) && (seq ?? 0) > 0 ? seq! : null;
}

export interface TaskLedgerView {
  assignee: string;
  state: "active" | "all" | TaskState;
  query: string;
  priority: number | null;
  doneLimit: number;
  expanded: boolean;
  detail: number | null;
}

export function TaskLedgerPanel({
  tasks,
  loading,
  error,
  canWrite,
  busyTaskId,
  actionError,
  creating,
  createError,
  onRefresh,
  onSetState,
  onAssign,
  onReview,
  onCreateTask,
  identities = [],
  onUploadAttachment,
  onOpenMessage,
  onClose,
  selectedTaskId = null,
  onSelectedTaskDismiss,
  viewMemory,
}: {
  tasks: TaskRecord[];
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  onClose?: () => void;
  busyTaskId: number | null;
  actionError: string | null;
  creating: boolean;
  createError: string | null;
  onRefresh: () => void;
  onSetState: (id: number, state: TaskState, blockedReason?: string) => void;
  onAssign: (id: number, name: string, kind: TaskAssigneeKind) => void;
  onReview: (task: TaskRecord, action: "approve" | "reject", reason?: string) => void;
  onCreateTask: (input: {
    title: string;
    desc: string;
    priority: number;
    assignee: { name: string; kind: TaskAssigneeKind } | null;
    attachments?: Attachment[];
  }) => Promise<boolean>;
  // #271(b)：频道身份（presence/identities），给指派输入框做可检索的 datalist 候选。
  identities?: ChannelIdentity[];
  // #369：上传图片/文件到 R2 拿引用（Channel 提供 token/slug）。缺省则不显上传入口（如从消息建任务）。
  onUploadAttachment?: (file: File) => Promise<Attachment>;
  // 任务必须能回到提出它的消息，否则详情页只剩一份与讨论脱节的静态记录。
  onOpenMessage?: (seq: number) => void | Promise<void>;
  // 从 Focus 等外部入口精确跳转任务。仅临时穿透筛选，不重置面板内搜索、筛选或草稿。
  selectedTaskId?: number | null;
  onSelectedTaskDismiss?:()=>void;
  viewMemory?: {current:TaskLedgerView|null};
}) {
  const t = useT(), compact = useCompactViewport();
  const [assignDrafts, setAssignDrafts] = useState<Record<number, string>>({});
  const [assignKinds, setAssignKinds] = useState<Record<number, TaskAssigneeKind>>({});
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [newAssignee, setNewAssignee] = useState("");
  const [newAssigneeKind, setNewAssigneeKind] = useState<TaskAssigneeKind>("agent");
  // #369：新建任务的待发附件（先上传到 R2 拿引用，随 createTask 带上）。
  const [newAtts, setNewAtts] = useState<Attachment[]>([]);
  const [attUploading, setAttUploading] = useState(false);
  const onPickTaskFiles = (files: FileList | null) => {
    if (files === null || files.length === 0 || onUploadAttachment === undefined) return;
    setAttUploading(true);
    Promise.all(Array.from(files).map((f) => onUploadAttachment(f)))
      .then((refs) => setNewAtts((cur) => [...cur, ...refs]))
      .catch(() => {})
      .finally(() => setAttUploading(false));
  };
  const [rejectingTaskId, setRejectingTaskId] = useState<number | null>(null);
  const [rejectDraft, setRejectDraft] = useState("");
  const [blockingTaskId, setBlockingTaskId] = useState<number | null>(null);
  const [blockDraft, setBlockDraft] = useState("");
  // #271(a)：按受理人筛选看板。"all" 全量，"__unassigned__" 只看未指派。
  const [assigneeFilter, setAssigneeFilter] = useState(viewMemory?.current?.assignee??"all");
  // 默认进入「未完成」而不是把历史完成项也塞进首屏；用户先看下一步，再按需翻历史。
  const [stateFilter, setStateFilter] = useState<"active" | "all" | TaskState>(viewMemory?.current?.state??"active");
  const [taskQuery, setTaskQuery] = useState(viewMemory?.current?.query??"");
  const [prioFilter, setPrioFilter] = useState<number | null>(viewMemory?.current?.priority??null);
  // #504：已完成组默认只显 N 条，避免积累后无界渲染（CodeRabbit #517 指出）；点开加载更多。
  const [doneLimit, setDoneLimit] = useState(viewMemory?.current?.doneLimit??6);
  // #271(d)：展开放大——CSS class 切宽度，外层 channel-panel-card 用 :has() 跟随。
  const [expandedView, setExpandedView] = useState(viewMemory?.current?.expanded??false);
  // #271(c)：任务详情作为台账内路由。存 id 不存快照，刷新后始终显示最新记录。
  const [detailTaskId, setDetailTaskId] = useState<number | null>(viewMemory?.current?.detail??null);
  useLayoutEffect(()=>{if(viewMemory)viewMemory.current={assignee:assigneeFilter,state:stateFilter,query:taskQuery,priority:prioFilter,doneLimit,expanded:expandedView,detail:detailTaskId};},[viewMemory,assigneeFilter,stateFilter,taskQuery,prioFilter,doneLimit,expandedView,detailTaskId]);
  const taskTitleRefs = useRef(new Map<number, HTMLButtonElement>());
  const detailBackRef = useRef<HTMLButtonElement | null>(null);
  const detailReturnFocusIdRef = useRef<number | null>(null);
  const taskListScrollRef=useRef<number|null>(null);
  const selectedTask = selectedTaskId === null
    ? null
    : tasks.find((task) => task.id === selectedTaskId) ?? null;
  const resolvedSelectedTaskId = selectedTask?.id ?? null;
  const detailTask = detailTaskId === null ? null : tasks.find((task) => task.id === detailTaskId) ?? null;
  useEffect(() => {
    if (resolvedSelectedTaskId === null) return;
    setDetailTaskId(resolvedSelectedTaskId);
  }, [resolvedSelectedTaskId]);
  useLayoutEffect(() => {
    if (detailTaskId !== null) {
      const back = detailBackRef.current;
      if (typeof back?.focus === "function") back.focus();
      return;
    }
    const returnFocusId = detailReturnFocusIdRef.current;
    if (returnFocusId === null) return;
    detailReturnFocusIdRef.current = null;
    const body=typeof document==='undefined'?null:document.querySelector<HTMLElement>('.channel-panel-body');
    if(body&&taskListScrollRef.current!==null)body.scrollTop=taskListScrollRef.current;
    const trigger = taskTitleRefs.current.get(returnFocusId);
    if (typeof trigger?.focus === "function") trigger.focus();
  }, [detailTaskId]);
  const closeTaskDetail = useCallback(() => {
    detailReturnFocusIdRef.current = detailTaskId;
    setDetailTaskId(null);
    onSelectedTaskDismiss?.();
  }, [detailTaskId,onSelectedTaskDismiss]);
  useEffect(() => {
    if (detailTask === null || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeTaskDetail();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closeTaskDetail, detailTask]);
  const counts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.state] = (acc[task.state] ?? 0) + 1;
    return acc;
  }, {});
  const identityByName = new Map(identities.map((identity) => [identity.name, identity]));
  const identityLabel = (name: string): string => identityByName.get(name)?.display ?? name;
  const assigneeOptions = [...new Set(
    tasks.flatMap((task) => (task.assignee !== null ? [task.assignee.name] : [])),
  )].sort();
  const q = taskQuery.trim().toLowerCase();
  const visibleTasks = tasks.filter((task) => {
    // 外部精确跳转的目标始终可见，但不改写用户已有筛选；清除选择后自然恢复原视图。
    if (task.id === resolvedSelectedTaskId) return true;
    // 受理人
    if (assigneeFilter === "__unassigned__" && task.assignee !== null) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== "__unassigned__" && task.assignee?.name !== assigneeFilter) return false;
    // 状态（active=非 done；具体状态；all）
    if (stateFilter === "active" && task.state === "done") return false;
    if (stateFilter !== "active" && stateFilter !== "all" && task.state !== stateFilter) return false;
    // 优先级
    if (prioFilter !== null && task.priority !== prioFilter) return false;
    // 关键词要覆盖用户实际会记住的上下文，而不只是标题/标签。
    if (q !== "" && !(
      task.title.toLowerCase().includes(q) ||
      `#${task.id}`.includes(q) ||
      task.labels.join(" ").toLowerCase().includes(q) ||
      (task.desc ?? "").toLowerCase().includes(q) ||
      (task.assignee?.name ?? "").toLowerCase().includes(q) ||
      identityLabel(task.assignee?.name ?? "").toLowerCase().includes(q) ||
      task.created_by.toLowerCase().includes(q) ||
      identityLabel(task.created_by).toLowerCase().includes(q) ||
      (task.blocked_reason ?? "").toLowerCase().includes(q) ||
      task.scope.join(" ").toLowerCase().includes(q)
    )) return false;
    return true;
  });
  const tasksByState = new Map<TaskState, TaskRecord[]>(TASK_BOARD_STATES.map((state) => [state, []]));
  for (const task of visibleTasks) tasksByState.get(task.state)?.push(task);
  const activeCount = tasks.filter((task) => task.state !== "done").length;
  const taskFiltered = stateFilter !== "active" || prioFilter !== null || q !== "" || assigneeFilter !== "all";
  const unassignedActiveCount = tasks.filter((task) => task.state !== "done" && task.assignee === null).length;
  // 每一种真实状态都可直接筛选；旧版漏掉 backlog/assigned，任务只能靠「全部」翻找。
  const stateChipDefs: Array<{ key: "active" | "all" | TaskState; label: string; count: number }> = [
    { key: "active", label: t("Channel.tasks.chip.active"), count: activeCount },
    { key: "triage", label: t("Channel.tasks.state.triage"), count: counts.triage ?? 0 },
    { key: "backlog", label: t("Channel.tasks.state.backlog"), count: counts.backlog ?? 0 },
    { key: "assigned", label: t("Channel.tasks.state.assigned"), count: counts.assigned ?? 0 },
    { key: "in_progress", label: t("Channel.tasks.state.in_progress"), count: counts.in_progress ?? 0 },
    { key: "needs_review", label: t("Channel.tasks.state.needs_review"), count: counts.needs_review ?? 0 },
    { key: "blocked", label: t("Channel.tasks.state.blocked"), count: counts.blocked ?? 0 },
    { key: "done", label: t("Channel.tasks.state.done"), count: counts.done ?? 0 },
    { key: "all", label: t("Channel.tasks.chip.all"), count: tasks.length },
  ];
  const disabled = loading || !canWrite;
  const stateLabel = (state: TaskState) => t(`Channel.tasks.state.${state}`);
  const submitNewTask = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (title === "" || creating || attUploading) return;
    const assigneeName = newAssignee.trim();
    void onCreateTask({
      title,
      desc: newDesc.trim(),
      priority: newPriority,
      assignee: assigneeName === "" ? null : { name: assigneeName, kind: newAssigneeKind },
      attachments: newAtts,
    }).then((ok) => {
      if (!ok) return;
      setNewTitle("");
      setNewDesc("");
      setNewPriority(0);
      setNewAssignee("");
      setNewAssigneeKind("agent");
      setNewAtts([]);
      setComposerOpen(false);
    });
  };
  const renderTaskControls = (task: TaskRecord) => {
    const taskBusy = busyTaskId === task.id;
    const assignDraft = assignDrafts[task.id] ?? task.assignee?.name ?? "";
    const assignKind = assignKinds[task.id] ?? task.assignee?.kind ?? "agent";
    const reviewSeq = taskCompletionSeq(task);
    return (
      <div className="task-detail-controls">
        <section className="task-detail-control-group">
          <h3>{t("Channel.tasks.detail.nextAction")}</h3>
          <div className="task-card-actions">
            {task.state === "done" ? (
              <button className="task-action-btn task-action-btn--primary" type="button" disabled={disabled || taskBusy} onClick={() => onSetState(task.id, "in_progress")}>
                {t("Channel.tasks.action.reopen")}
              </button>
            ) : task.state === "blocked" ? (
              <button className="task-action-btn task-action-btn--primary" type="button" disabled={disabled || taskBusy} onClick={() => onSetState(task.id, "in_progress")}>
                {t("Channel.tasks.action.resume")}
              </button>
            ) : task.state !== "in_progress" && (
              <button className="task-action-btn task-action-btn--primary" type="button" disabled={disabled || taskBusy} onClick={() => onSetState(task.id, "in_progress")}>
                {t("Channel.tasks.action.start")}
              </button>
            )}
            {task.state !== "done" && task.state !== "blocked" && (
              <button
                className="task-action-btn"
                type="button"
                disabled={disabled || taskBusy}
                aria-expanded={blockingTaskId === task.id}
                onClick={() => {
                  setBlockingTaskId(task.id);
                  setBlockDraft("");
                }}
              >
                {t("Channel.tasks.action.block")}
              </button>
            )}
            {task.state !== "done" && (
              <button className="task-action-btn" type="button" disabled={disabled || taskBusy} onClick={() => onSetState(task.id, "done")}>
                {t("Channel.tasks.action.done")}
              </button>
            )}
            {reviewSeq !== null && (
              <>
                <button className="task-action-btn task-action-btn--review" type="button" disabled={disabled || taskBusy} onClick={() => onReview(task, "approve")}>
                  {t("Channel.tasks.action.approve")}
                </button>
                <button className="task-action-btn" type="button" disabled={disabled || taskBusy} aria-expanded={rejectingTaskId === task.id} onClick={() => { setRejectingTaskId(task.id); setRejectDraft(""); }}>
                  {t("Channel.tasks.action.reject")}
                </button>
              </>
            )}
          </div>
          {blockingTaskId === task.id && (
            <form
              className="task-new-form task-block-form"
              onSubmit={(event) => {
                event.preventDefault();
                const reason = blockDraft.trim();
                if (reason === "") return;
                onSetState(task.id, "blocked", reason);
                setBlockingTaskId(null);
                setBlockDraft("");
              }}
            >
              <textarea
                className="task-new-desc"
                aria-label={t("Channel.tasks.blockReasonAria", { id: task.id })}
                placeholder={t("Channel.tasks.blockReasonPlaceholder")}
                rows={3}
                autoFocus
                disabled={taskBusy}
                value={blockDraft}
                onChange={(event) => setBlockDraft(event.currentTarget.value)}
              />
              <div className="task-new-actions">
                <button className="task-action-btn task-action-btn--primary" type="submit" disabled={taskBusy || blockDraft.trim() === ""}>
                  {t("Channel.tasks.action.confirmBlock")}
                </button>
                <button className="task-action-btn" type="button" disabled={taskBusy} onClick={() => { setBlockingTaskId(null); setBlockDraft(""); }}>
                  {t("Channel.reject.cancel")}
                </button>
              </div>
            </form>
          )}
          {rejectingTaskId === task.id && (
            <div className="task-new-form task-reject-form">
              <textarea
                className="task-new-desc task-reject-reason"
                aria-label={t("Channel.tasks.rejectReasonAria", { id: task.id })}
                placeholder={t("Channel.tasks.rejectPrompt")}
                rows={3}
                autoFocus
                disabled={taskBusy}
                value={rejectDraft}
                onChange={(event) => setRejectDraft(event.currentTarget.value)}
              />
              <div className="task-new-actions">
                <button
                  className="task-action-btn task-reject-confirm"
                  type="button"
                  disabled={taskBusy || rejectDraft.trim() === ""}
                  onClick={() => {
                    onReview(task, "reject", rejectDraft.trim());
                    setRejectingTaskId(null);
                    setRejectDraft("");
                  }}
                >
                  {t("Channel.reject.confirm")}
                </button>
                <button className="task-action-btn task-reject-cancel" type="button" disabled={taskBusy} onClick={() => { setRejectingTaskId(null); setRejectDraft(""); }}>
                  {t("Channel.reject.cancel")}
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="task-detail-control-group">
          <h3>{t("Channel.tasks.detail.assignment")}</h3>
          <form
            className="task-assign-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAssign(task.id, assignDraft, assignKind);
            }}
          >
            <input
              aria-label={t("Channel.tasks.assignAria", { id: task.id })}
              disabled={disabled || taskBusy}
              value={assignDraft}
              placeholder={t("Channel.tasks.assignPlaceholder")}
              list="task-assignee-targets"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setAssignDrafts((current) => ({ ...current, [task.id]: event.currentTarget.value }))}
            />
            <select
              aria-label={t("Channel.tasks.kindAria", { id: task.id })}
              disabled={disabled || taskBusy}
              value={assignKind}
              onChange={(event) => setAssignKinds((current) => ({ ...current, [task.id]: event.currentTarget.value as TaskAssigneeKind }))}
            >
              <option value="agent">{t("Channel.tasks.kind.agent")}</option>
              <option value="human">{t("Channel.tasks.kind.human")}</option>
              <option value="squad">{t("Channel.tasks.kind.squad")}</option>
            </select>
            <button className="task-action-btn" type="submit" disabled={disabled || taskBusy || assignDraft.trim() === ""}>
              {t("Channel.tasks.action.assign")}
            </button>
          </form>
          {task.assignee !== null && (
            <p className="task-detail-current-assignee">
              {t("Channel.tasks.detail.currentAssignee", { name: identityLabel(task.assignee.name) })}
            </p>
          )}
        </section>
      </div>
    );
  };
  const renderTask = (task: TaskRecord) => {
    const taskBusy = busyTaskId === task.id;
    const assignee = task.assignee === null
      ? t("Channel.tasks.unassigned")
      : identityLabel(task.assignee.name);
    return (
      <li
        key={task.id}
        data-task-id={task.id}
        className={`task-card task-card--${task.state}` + (dragTaskId === task.id ? " is-dragging" : "")}
        draggable={!disabled && !taskBusy}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(task.id));
          setDragTaskId(task.id);
        }}
        onDragEnd={() => setDragTaskId(null)}
      >
        <button
          type="button"
          className="task-card-open"
          ref={(node) => {
            if (node === null) taskTitleRefs.current.delete(task.id);
            else taskTitleRefs.current.set(task.id, node);
          }}
          aria-label={t("Channel.tasks.detailOpenAria", { id: task.id })}
          onClick={() => {taskListScrollRef.current=typeof document==='undefined'?null:document.querySelector<HTMLElement>('.channel-panel-body')?.scrollTop??null;setDetailTaskId(task.id);}}
        >
          <span className="task-card-leading">
            <span className="t-mono task-id">#{task.id}</span>
            <span className={`t-mono task-prio task-prio--p${task.priority}`}>P{task.priority}</span>
          </span>
          <span className="task-card-copy">
            <strong>{task.title}</strong>
            <span className="task-card-context">
              <span>{t("Channel.tasks.ownerLabel", { name: assignee })}</span>
              <span>{t("Channel.tasks.updatedLabel", { time: fmtTime(task.updated_at) })}</span>
              {task.anchor_seqs.length > 0 && (
                <span>{t("Channel.tasks.sourceCount", { count: task.anchor_seqs.length })}</span>
              )}
            </span>
          </span>
          {task.labels.length > 0 && (
            <span className="task-card-labels">
              {task.labels.map((label) => <span key={label} className="t-mono task-label">{label}</span>)}
            </span>
          )}
          <span className="task-card-enter">{t("Channel.tasks.view")}</span>
        </button>
      </li>
    );
  };
  return (
    <section
      className={"task-ledger-panel" + (expandedView ? " task-ledger-panel--expanded" : "")}
      aria-label={t("Channel.tasks.panelAria")}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || detailTask === null) return;
        event.preventDefault();
        event.stopPropagation();
        closeTaskDetail();
      }}
    >
      <datalist id="task-assignee-targets">
        {identities.map((identity) => (
          <option key={identity.name} value={identity.name}>{identity.display}</option>
        ))}
      </datalist>
      {detailTask === null ? (
        <>
          <header className="task-blog-head">
            <div className="task-blog-title">
              <h2 className="task-blog-name">{t("Channel.tasks.title")}</h2>
              <span className="task-blog-prompt">
                {t("Channel.tasks.overviewSummary", {
                  open: activeCount,
                  unassigned: unassignedActiveCount,
                  review: counts.needs_review ?? 0,
                  blocked: counts.blocked ?? 0,
                })}
              </span>
            </div>
            <div className="task-blog-head-actions">
              {canWrite && (
                <button
                  className="d-btn task-new-btn task-blog-new"
                  type="button"
                  aria-label={t("Channel.tasks.new")}
                  aria-expanded={composerOpen}
                  disabled={loading}
                  onClick={() => setComposerOpen((open) => !open)}
                >
                  {t("Channel.tasks.new")}
                </button>
              )}
              <button className="d-btn" type="button" aria-label={t("Channel.tasks.refresh")} disabled={loading} onClick={onRefresh}>
                {loading ? t("Channel.tasks.refreshing") : t("Channel.tasks.refresh")}
              </button>
              <button
                className="d-btn task-expand-btn"
                type="button"
                aria-label={t("Channel.tasks.expandAria")}
                aria-pressed={expandedView}
                onClick={() => setExpandedView((open) => !open)}
              >
                {expandedView ? t("Channel.tasks.collapse") : t("Channel.tasks.expand")}
              </button>
              {onClose !== undefined && (
                <button type="button" className="d-btn task-blog-close" onClick={onClose}>
                  {t("Channel.tools.close")}
                </button>
              )}
            </div>
          </header>
          <div className="task-blog-filter">
            <div className="task-blog-filter-row" role="group" aria-label={t("Channel.tasks.stateFilterAria")}>
              {stateChipDefs.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={"task-blog-chip" + (stateFilter === chip.key ? " task-blog-chip--on" : "") + (chip.count === 0 ? " task-blog-chip--dim" : "")}
                  aria-pressed={stateFilter === chip.key}
                  onClick={() => setStateFilter(chip.key)}
                >
                  {chip.label} <b>{chip.count}</b>
                </button>
              ))}
            </div>
            <details className="task-filter-details" open={!compact || undefined}><summary>{t("Channel.tasks.searchAndFilter")}{taskFiltered && <span className="task-filter-active"> · {t("Channel.tools.active")}</span>}</summary>
            <div className="task-blog-filter-row">
              <input
                className="task-blog-search"
                aria-label={t("Channel.tasks.searchAria")}
                placeholder={t("Channel.tasks.searchPlaceholder")}
                value={taskQuery}
                onChange={(event) => setTaskQuery(event.currentTarget.value)}
              />
              {assigneeOptions.length > 0 && (
                <select
                  className="task-filter-select"
                  aria-label={t("Channel.tasks.filterAria")}
                  value={assigneeFilter}
                  onChange={(event) => setAssigneeFilter(event.currentTarget.value)}
                >
                  <option value="all">{t("Channel.tasks.filterAll")}</option>
                  <option value="__unassigned__">{t("Channel.tasks.filterUnassigned")}</option>
                  {assigneeOptions.map((name) => (
                    <option key={name} value={name}>{identityLabel(name)}</option>
                  ))}
                </select>
              )}
              <div className="task-priority-filter" role="group" aria-label={t("Channel.tasks.priorityFilterAria")}>
                {[0, 1, 2, 3].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={"task-blog-chip task-blog-prio" + (prioFilter === p ? " task-blog-chip--on" : "")}
                    aria-pressed={prioFilter === p}
                    onClick={() => setPrioFilter(prioFilter === p ? null : p)}
                  >
                    P{p}
                  </button>
                ))}
              </div>
              {taskFiltered && (
                <button
                  type="button"
                  className="task-blog-chip task-blog-clear"
                  onClick={() => { setStateFilter("active"); setPrioFilter(null); setTaskQuery(""); setAssigneeFilter("all"); }}
                >
                  {t("Channel.tasks.clearFilters")}
                </button>
              )}
            </div>
            </details>
          </div>
          {composerOpen && canWrite && (
            <form className="task-new-form" onSubmit={submitNewTask}>
              <div className="task-new-heading">
                <strong>{t("Channel.tasks.newHeading")}</strong>
                <span>{t("Channel.tasks.newHint")}</span>
              </div>
              <input
                className="task-new-title"
                aria-label={t("Channel.tasks.newTitleAria")}
                placeholder={t("Channel.tasks.newTitlePlaceholder")}
                value={newTitle}
                disabled={creating}
                autoFocus
                onChange={(event) => setNewTitle(event.currentTarget.value)}
              />
              <textarea
                className="task-new-desc"
                aria-label={t("Channel.tasks.newDescAria")}
                placeholder={t("Channel.tasks.newDescPlaceholder")}
                value={newDesc}
                disabled={creating}
                rows={3}
                onChange={(event) => setNewDesc(event.currentTarget.value)}
              />
              <div className="task-new-options">
                <label>
                  <span>{t("Channel.tasks.newAssignee")}</span>
                  <select
                    aria-label={t("Channel.tasks.newAssigneeAria")}
                    value={newAssignee}
                    disabled={creating}
                    onChange={(event) => {
                      const name = event.currentTarget.value;
                      setNewAssignee(name);
                      const kind = identityByName.get(name)?.kind;
                      if (kind === "agent" || kind === "human") setNewAssigneeKind(kind);
                    }}
                  >
                    <option value="">{t("Channel.tasks.filterUnassigned")}</option>
                    {identities.map((identity) => (
                      <option key={identity.name} value={identity.name}>{identity.display}</option>
                    ))}
                  </select>
                </label>
                {newAssignee !== "" && (
                  <label>
                    <span>{t("Channel.tasks.newAssigneeKind")}</span>
                    <select
                      aria-label={t("Channel.tasks.newAssigneeKindAria")}
                      value={newAssigneeKind}
                      disabled={creating}
                      onChange={(event) => setNewAssigneeKind(event.currentTarget.value as TaskAssigneeKind)}
                    >
                      <option value="agent">{t("Channel.tasks.kind.agent")}</option>
                      <option value="human">{t("Channel.tasks.kind.human")}</option>
                      <option value="squad">{t("Channel.tasks.kind.squad")}</option>
                    </select>
                  </label>
                )}
                <label>
                  <span>{t("Channel.tasks.newPriority")}</span>
                  <select
                    aria-label={t("Channel.tasks.newPriorityAria")}
                    value={newPriority}
                    disabled={creating}
                    onChange={(event) => setNewPriority(Number(event.currentTarget.value))}
                  >
                    {[0, 1, 2, 3].map((priority) => (
                      <option key={priority} value={priority}>{t("Channel.tasks.priorityOption", { priority })}</option>
                    ))}
                  </select>
                </label>
              </div>
              {onUploadAttachment !== undefined && (
                <div className="task-new-attach">
                  <label className="task-attach-btn">
                    <input
                      type="file"
                      multiple
                      disabled={creating || attUploading}
                      onChange={(event) => { onPickTaskFiles(event.currentTarget.files); event.currentTarget.value = ""; }}
                    />
                    {attUploading ? t("Channel.tasks.attachUploading") : t("Channel.tasks.attach")}
                  </label>
                  {newAtts.length > 0 && (
                    <ul className="task-new-atts">
                      {newAtts.map((att) => (
                        <li key={att.key} className="task-new-att t-mono">
                          <span className="task-new-att-name">{att.filename}</span>
                          <button
                            type="button"
                            className="task-new-att-remove"
                            aria-label={t("Channel.tasks.attachRemoveAria", { filename: att.filename })}
                            onClick={() => setNewAtts((cur) => cur.filter((a) => a.key !== att.key))}
                          >
                            <StudioIcon name="close" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {createError !== null && <p className="banner banner--red">{createError}</p>}
              <div className="task-new-actions">
                <button className="task-action-btn task-action-btn--primary" type="submit" disabled={creating || attUploading || newTitle.trim() === ""}>
                  {creating ? t("Channel.tasks.newSubmitting") : t("Channel.tasks.newSubmit")}
                </button>
                <button
                  className="task-action-btn"
                  type="button"
                  disabled={creating}
                  onClick={() => {
                    setComposerOpen(false);
                    setNewTitle("");
                    setNewDesc("");
                    setNewPriority(0);
                    setNewAssignee("");
                    setNewAssigneeKind("agent");
                    setNewAtts([]);
                  }}
                >
                  {t("Channel.tasks.newCancel")}
                </button>
              </div>
            </form>
          )}
          {error !== null && <p className="banner banner--red">{error}</p>}
          {actionError !== null && <p className="banner banner--red">{actionError}</p>}
          {tasks.length === 0 && error === null ? (
        <p className="charter-empty">{t("Channel.tasks.empty")}</p>
      ) : (
        <div className="task-board" role="list" aria-label={t("Channel.tasks.boardAria")}>
          {TASK_BOARD_STATES.map((state) => {
            const columnTasks = tasksByState.get(state) ?? [];
            const limitedColumnTasks = state === "done" ? columnTasks.slice(0, doneLimit) : columnTasks;
            const selectedColumnTask = selectedTask?.state === state ? selectedTask : null;
            const renderedColumnTasks = selectedColumnTask !== null && !limitedColumnTasks.some((task) => task.id === selectedColumnTask.id)
              ? [...limitedColumnTasks, selectedColumnTask]
              : limitedColumnTasks;
            const remainingTaskCount = columnTasks.length - renderedColumnTasks.length;
            return (
              <section
                key={state}
                className={"task-column" + (dragTaskId !== null ? " task-column--drop" : "")}
                aria-label={t("Channel.tasks.columnAria", { state: stateLabel(state) })}
                onDragOver={(event) => {
                  if (dragTaskId !== null && !disabled) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const rawId = event.dataTransfer.getData("text/plain");
                  const id = Number.parseInt(rawId, 10);
                  setDragTaskId(null);
                  if (!Number.isInteger(id) || disabled) return;
                  const task = tasks.find((item) => item.id === id);
                  if (task === undefined || task.state === state) return;
                  onSetState(id, state);
                }}
              >
                <header className="task-column-head">
                  <span className={`t-mono task-state task-state--${state}`}>{stateLabel(state)}</span>
                  <span className="t-mono task-column-count">{columnTasks.length}</span>
                </header>
                {columnTasks.length === 0 ? (
                  <p className="t-mono task-column-empty">{t("Channel.tasks.columnEmpty")}</p>
                ) : (
                  <>
                    <ol className="task-list">
                      {renderedColumnTasks.map(renderTask)}
                    </ol>
                    {state === "done" && remainingTaskCount > 0 && (
                      <button
                        type="button"
                        className="task-blog-more"
                        onClick={() => setDoneLimit((n) => n + 20)}
                      >
                        ▾ {t("Channel.tasks.showMore", { count: remainingTaskCount })}
                      </button>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
          )}
        </>
      ) : (
        <section
          className="task-detail-card task-detail-route"
          aria-label={t("Channel.tasks.detailAria", { id: detailTask.id })}
        >
          <header className="task-detail-head">
            <button
              ref={detailBackRef}
              className="d-btn task-detail-close"
              type="button"
              onClick={closeTaskDetail}
            >
              {t("Channel.tasks.detailBack")}
            </button>
            <span className="t-mono task-id">#{detailTask.id}</span>
            <span className={`t-mono task-state task-state--${detailTask.state}`}>{stateLabel(detailTask.state)}</span>
          </header>
          <div className="task-detail-layout">
            <main className="task-detail-main">
              <h2 className="task-detail-title">{detailTask.title}</h2>
              {detailTask.blocked_reason !== null && (
                <section className="task-detail-blocker" role="status">
                  <strong>{t("Channel.tasks.detail.blockedReason")}</strong>
                  <p>{detailTask.blocked_reason}</p>
                </section>
              )}
              <section className="task-detail-section">
                <h3>{t("Channel.tasks.detail.description")}</h3>
                {detailTask.desc !== null && detailTask.desc !== "" ? (
                  <p className="task-detail-desc">{detailTask.desc}</p>
                ) : (
                  <p className="charter-empty">{t("Channel.tasks.detailNoDesc")}</p>
                )}
              </section>
              {detailTask.attachments !== undefined && detailTask.attachments.length > 0 && (
                <section className="task-detail-section">
                  <h3>{t("Channel.tasks.detail.attachments")}</h3>
                  <AttachmentList attachments={detailTask.attachments} />
                </section>
              )}
              {detailTask.solution !== undefined && (
                <section className="task-solution task-solution--detail">
                  <strong>{t("Channel.tasks.solution")}</strong>
                  <AttachmentList attachments={[detailTask.solution]} />
                </section>
              )}
              {detailTask.anchor_seqs.length > 0 && (
                <section className="task-detail-section">
                  <h3>{t("Channel.tasks.detail.sourceMessages")}</h3>
                  <p className="task-detail-section-hint">{t("Channel.tasks.detail.sourceHint")}</p>
                  <div className="task-source-links">
                    {detailTask.anchor_seqs.map((seq) => (
                      <button
                        key={seq}
                        type="button"
                        className="task-source-link"
                        disabled={onOpenMessage === undefined}
                        onClick={() => void onOpenMessage?.(seq)}
                      >
                        {t("Channel.tasks.detail.openMessage", { seq })}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </main>
            <aside className="task-detail-sidebar">
              <section className="task-detail-facts">
                <h3>{t("Channel.tasks.detail.overview")}</h3>
                <dl className="task-detail-meta">
                  <dt>{t("Channel.tasks.detail.priority")}</dt>
                  <dd className="t-mono">P{detailTask.priority}</dd>
                  <dt>{t("Channel.tasks.detail.assignee")}</dt>
                  <dd>{detailTask.assignee !== null ? identityLabel(detailTask.assignee.name) : t("Channel.tasks.unassigned")}</dd>
                  <dt>{t("Channel.tasks.detail.createdBy")}</dt>
                  <dd>{identityLabel(detailTask.created_by)}</dd>
                  {detailTask.labels.length > 0 && (
                    <>
                      <dt>{t("Channel.tasks.detail.labels")}</dt>
                      <dd className="t-mono">{detailTask.labels.join(", ")}</dd>
                    </>
                  )}
                  {detailTask.parent_id !== null && (
                    <>
                      <dt>{t("Channel.tasks.detail.parent")}</dt>
                      <dd className="t-mono">#{detailTask.parent_id}</dd>
                    </>
                  )}
                  {detailTask.external_ref !== null && (
                    <>
                      <dt>{t("Channel.tasks.detail.externalRef")}</dt>
                      <dd className="t-mono">{detailTask.external_ref}</dd>
                    </>
                  )}
                  <dt>{t("Channel.tasks.detail.created")}</dt>
                  <dd>{fmtTime(detailTask.created_at)}</dd>
                  <dt>{t("Channel.tasks.detail.updated")}</dt>
                  <dd>{fmtTime(detailTask.updated_at)}</dd>
                  {detailTask.completed_at !== null && (
                    <>
                      <dt>{t("Channel.tasks.detail.completed")}</dt>
                      <dd>{fmtTime(detailTask.completed_at)}</dd>
                    </>
                  )}
                </dl>
              </section>
              {actionError !== null && <p className="banner banner--red">{actionError}</p>}
              {renderTaskControls(detailTask)}
            </aside>
          </div>
        </section>
      )}
    </section>
  );
}
