import { useId } from "react";
import type { TaskRecord } from "@agentparty/shared";
import { useLocale } from "../i18n/locale";
import { useT } from "../i18n/useT";
import "../i18n/strings/TaskVisuals";
import "./TaskActivityTimeline.css";

export interface TaskActivityTimelineProps {
  task: Pick<TaskRecord, "created_at" | "updated_at" | "completed_at">;
}

type RecordKind = "created" | "updated" | "completed";
const validTime = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0 && !Number.isNaN(new Date(value).getTime());

export function TaskActivityTimeline({ task }: TaskActivityTimelineProps) {
  const t = useT();
  const { locale } = useLocale();
  const titleId = useId();
  // These are record timestamps, not an inferred history of state transitions.
  const records: Array<{ kind: RecordKind; time: number }> = [];
  if (validTime(task.created_at)) records.push({ kind: "created", time: task.created_at });
  if (validTime(task.updated_at) && task.updated_at !== task.created_at && task.updated_at !== task.completed_at) {
    records.push({ kind: "updated", time: task.updated_at });
  }
  if (validTime(task.completed_at)) records.push({ kind: "completed", time: task.completed_at });
  records.sort((left, right) => left.time - right.time);
  if (records.length === 0) return null;

  const format = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return <section className="task-activity-timeline" aria-labelledby={titleId}>
    <h3 id={titleId}>{t("TaskVisuals.timeline")}</h3>
    <ol>
      {records.map(({ kind, time }, index) => <li className={`task-activity-event task-activity-event--${kind}`} key={kind} data-event={kind} style={{ animationDelay: `${index * 20}ms` }}>
        <span className="task-activity-node" aria-hidden="true" />
        <span className="task-activity-label">{t(`TaskVisuals.event.${kind}`)}</span>
        <time dateTime={new Date(time).toISOString()}>{format.format(time)}</time>
      </li>)}
    </ol>
  </section>;
}
