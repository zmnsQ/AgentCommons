import { registerDict, type LocaleDict } from "../dict";

export const TaskVisualsStrings: LocaleDict = {
  en: {
    "TaskVisuals.summary": "Task distribution",
    "TaskVisuals.completedCount": "{done} of {total} tasks completed",
    "TaskVisuals.state.pending": "Pending",
    "TaskVisuals.state.in_progress": "In progress",
    "TaskVisuals.state.needs_review": "Needs review",
    "TaskVisuals.state.blocked": "Blocked",
    "TaskVisuals.state.done": "Completed",
    "TaskVisuals.empty": "No tasks yet",
    "TaskVisuals.loading": "Loading task status…",
    "TaskVisuals.timeline": "Task record",
    "TaskVisuals.event.created": "Created",
    "TaskVisuals.event.updated": "Last updated",
    "TaskVisuals.event.completed": "Completed",
    "TaskVisuals.processingMessage": "Processing message #{seq}",
  },
  zh: {
    "TaskVisuals.summary": "任务分布",
    "TaskVisuals.completedCount": "共 {total} 项任务，已完成 {done} 项",
    "TaskVisuals.state.pending": "待处理",
    "TaskVisuals.state.in_progress": "进行中",
    "TaskVisuals.state.needs_review": "待验收",
    "TaskVisuals.state.blocked": "受阻",
    "TaskVisuals.state.done": "已完成",
    "TaskVisuals.empty": "暂无任务",
    "TaskVisuals.loading": "正在加载任务状态…",
    "TaskVisuals.timeline": "任务记录",
    "TaskVisuals.event.created": "创建",
    "TaskVisuals.event.updated": "最近更新",
    "TaskVisuals.event.completed": "完成",
    "TaskVisuals.processingMessage": "处理消息 #{seq}",
  },
};

registerDict(TaskVisualsStrings);
