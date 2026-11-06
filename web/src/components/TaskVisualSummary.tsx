import { useId } from "react";
import type { TaskRecord, TaskState, TaskSummary } from "@agentparty/shared";
import { useT } from "../i18n/useT";
import "../i18n/strings/TaskVisuals";
import "./TaskVisualSummary.css";

type SummaryCounts = Pick<TaskSummary, "total" | TaskState>;
export interface TaskVisualSummaryProps {
  tasks: readonly Pick<TaskRecord, "state">[];
  /** Server totals take precedence over the loaded list when available. */
  summary?: SummaryCounts | null;
  loading?: boolean;
}

const OPEN_GROUPS = ["pending", "in_progress", "needs_review", "blocked"] as const;
const GROUPS = [...OPEN_GROUPS, "done"] as const;

export function TaskVisualSummary({ tasks, summary, loading = false }: TaskVisualSummaryProps) {
  const t = useT();
  const titleId = useId();
  const counts: SummaryCounts = summary ?? tasks.reduce<SummaryCounts>((result, task) => {
    result[task.state]++;
    return result;
  }, { total: tasks.length, triage: 0, backlog: 0, assigned: 0, in_progress: 0, needs_review: 0, blocked: 0, done: 0 });
  const grouped = {
    pending: counts.triage + counts.backlog + counts.assigned,
    in_progress: counts.in_progress,
    needs_review: counts.needs_review,
    blocked: counts.blocked,
    done: counts.done,
  };
  const initialLoading = loading && summary == null && tasks.length === 0;
  const distributionLabel = GROUPS.map(state => `${t(`TaskVisuals.state.${state}`)} ${grouped[state]}`).join(" · ");

  return <section className="task-visual-summary" aria-labelledby={titleId} aria-busy={loading}>
    <header className="task-visual-summary-head">
      <h3 id={titleId}>{t("TaskVisuals.summary")}</h3>
      {!initialLoading && <span className="task-visual-completed" aria-label={t("TaskVisuals.completedCount", { done: counts.done, total: counts.total })}>
        <span>{t("TaskVisuals.state.done")}</span>
        <strong>{counts.done}</strong><span className="task-visual-total">/ {counts.total}</span>
      </span>}
    </header>
    <div className="task-visual-distribution" role="img" aria-label={initialLoading ? t("TaskVisuals.loading") : distributionLabel}>
      {!initialLoading && GROUPS.filter(state => grouped[state] > 0).map(state => <span
        key={state}
        className={`task-visual-segment task-visual-segment--${state}`}
        data-state={state}
        style={{ flexGrow: grouped[state] }}
        aria-hidden="true"
      />)}
    </div>
    {initialLoading ? <p className="task-visual-empty" role="status">{t("TaskVisuals.loading")}</p> : <>
      <ul className="task-visual-counts">
        {OPEN_GROUPS.map(state => <li className={`task-visual-count task-visual-count--${state}`} key={state} data-state={state}>
          <span className="task-visual-dot" aria-hidden="true" />
          <span>{t(`TaskVisuals.state.${state}`)}</span>
          <strong>{grouped[state]}</strong>
        </li>)}
      </ul>
      {counts.total === 0 && <p className="task-visual-empty">{t("TaskVisuals.empty")}</p>}
    </>}
  </section>;
}
