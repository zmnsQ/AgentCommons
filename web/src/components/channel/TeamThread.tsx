import type { MsgFrame, PresenceEntry, PublicDirectedDelivery, ReadCursor, Sender } from "@agentparty/shared";
import type { ChannelRoleInfo } from "../../lib/api";
import type { IdentityDisplayMap } from "../../lib/identityDisplay";
import type { MentionReceipt } from "../../lib/wakeReceipt";
import type { TeamMessageThread } from "../../lib/teams";
import { fmtTime } from "../../lib/time";
import { MessageCard } from "../MessageCard";
import { useT } from "../../i18n/useT";
import "../../i18n/strings/Channel";

const EMPTY_RECENT_MESSAGES: MsgFrame[] = [];

export function TeamThread({
  thread,
  self,
  identityDisplay,
  receiptsBySeq,
  deliveriesBySeq,
  readCursors,
  participants,
  canModerate,
  editingSeq,
  editDraft,
  editSaving,
  actionError,
  busySeq,
  messageBySeq,
  recentMessagesByAgent,
  presence,
  agentRoles,
  onReply,
  onEdit,
  onRetract,
  canCreateTask,
  onCreateTask,
  onOpenAgentDetail,
  canOpenAgentDetail,
  onOpenLiveSession,
  hasLiveSession,
  onEditDraftChange,
  onEditCancel,
  onEditSave,
}: {
  thread: TeamMessageThread;
  self: string | null;
  identityDisplay: IdentityDisplayMap;
  receiptsBySeq: Map<number, MentionReceipt[]>;
  deliveriesBySeq: Map<number, PublicDirectedDelivery[]>;
  readCursors: Record<string, ReadCursor>;
  participants: Sender[];
  canModerate: boolean;
  editingSeq: number | null;
  editDraft: string;
  editSaving: boolean;
  actionError: { seq: number; message: string } | null;
  busySeq: number | null;
  // seq → 消息，用于把 reply_to 解析成完整的被引用消息（同一份 Map 从 ChannelPage 传下来，不在这里重建）
  messageBySeq: Map<number, MsgFrame>;
  recentMessagesByAgent: Map<string, MsgFrame[]>;
  // #274：name → presence 条目，MessageCard 悬停发送者名/@提及展示实时状态
  presence: Record<string, PresenceEntry>;
  agentRoles: Record<string, ChannelRoleInfo>;
  onReply: (seq: number) => void;
  onEdit: (seq: number) => void;
  onRetract: (seq: number) => void;
  canCreateTask: boolean;
  onCreateTask: (seq: number) => void;
  onOpenAgentDetail?: (name: string) => void;
  canOpenAgentDetail?: (name: string) => boolean;
  onOpenLiveSession?: (name: string) => void;
  hasLiveSession?: (name: string) => boolean;
  onEditDraftChange: (value: string) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
}) {
  const t = useT();
  const parentLabel =
    thread.parentAgents.length === 1
      ? t("Channel.teamThread.parent", { name: thread.parentAgents[0]! })
      : t("Channel.teamThread.parents", { count: thread.parentAgents.length });
  const memberLabel = thread.members.length === 1
    ? thread.members[0]!
    : t("Channel.teamThread.members", { count: thread.members.length });
  const title = t("Channel.teamThread.title", {
    team: thread.teamId,
    root: thread.rootAgent,
    parent: parentLabel,
    members: thread.members.join(", "),
    first: thread.firstSeq,
    last: thread.lastSeq,
  });
  return (
    <details className="team-thread" title={title}>
      <summary className="team-thread-summary">
        <span className="team-thread-dot" aria-hidden="true" />
        <span className="team-thread-name">{thread.teamId}</span>
        <span className="t-mono team-thread-meta">{memberLabel}</span>
        <span className="t-mono team-thread-meta">
          #{thread.firstSeq}..#{thread.lastSeq}
        </span>
        <span className="team-thread-fill" />
        <time className="t-mono">{fmtTime(thread.lastTs)}</time>
      </summary>
      <div className="team-thread-messages">
        {thread.messages.map((message) => (
          <MessageCard
            key={message.seq}
            msg={message}
            self={self}
            identityDisplay={identityDisplay}
            receipts={receiptsBySeq.get(message.seq)}
            deliveries={deliveriesBySeq.get(message.seq)}
            readCursors={readCursors}
            participants={participants}
            canModerate={canModerate}
            presence={presence}
            agentRoles={agentRoles}
            recentMessages={recentMessagesByAgent.get(message.sender.name) ?? EMPTY_RECENT_MESSAGES}
            recentMessagesByAgent={recentMessagesByAgent}
            quotedMessage={message.reply_to !== null ? messageBySeq.get(message.reply_to) ?? null : null}
            onReply={onReply}
            onEdit={onEdit}
            onRetract={onRetract}
            canCreateTask={canCreateTask}
            onCreateTask={onCreateTask}
            onOpenAgentDetail={onOpenAgentDetail}
            canOpenAgentDetail={canOpenAgentDetail}
            onOpenLiveSession={onOpenLiveSession}
            hasLiveSession={hasLiveSession}
            editing={editingSeq === message.seq}
            editDraft={editingSeq === message.seq ? editDraft : message.body}
            editSaving={editSaving && editingSeq === message.seq}
            actionError={actionError?.seq === message.seq ? actionError.message : null}
            busy={busySeq === message.seq}
            onEditDraftChange={onEditDraftChange}
            onEditCancel={onEditCancel}
            onEditSave={onEditSave}
          />
        ))}
      </div>
    </details>
  );
}
