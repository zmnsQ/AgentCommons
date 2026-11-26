import { ChannelPanelModal } from "../components/channel/ChannelPanelModal";
import { CharterBanner } from "../components/channel/CharterBanner";
import { AgentFilterPanel, ChannelSearchPanel } from "../components/channel/ChannelSearchPanel";
import { CompletionPanel } from "../components/channel/CompletionPanel";
import { GuardSettingsPanel } from "../components/channel/GuardSettingsPanel";
import { TaskLedgerPanel, taskCompletionSeq, type TaskLedgerView } from "../components/channel/TaskLedgerPanel";
import { TeamThread } from "../components/channel/TeamThread";

export { ChannelPanelModal, ChannelSearchPanel, CompletionPanel, GuardSettingsPanel, TaskLedgerPanel };
export type { ChannelSearchPanelProps } from "../components/channel/ChannelSearchPanel";
export type { GuardSettingsPanelProps } from "../components/channel/GuardSettingsPanel";
export type { TaskLedgerView } from "../components/channel/TaskLedgerPanel";

import {ownedGrokSubmissionSafety,type GrokSubmissionOwnerMemory} from "../lib/grokSubmissionSafety";
import {apiBase} from "../lib/base";
import {settleCurrentRequest} from "../lib/latestRequest";
import {workspaceActionReady} from "../lib/workspaceActionReadiness";
import {restorePanelScrollWhenReady,type PanelScrollRequest} from "../lib/panelScrollRestore";
import type {CollaborationView} from "../components/CollaborationHub";
import {pushPanelOrigin,popPanelOrigin} from "../lib/channelPanelNavigation";
import { StudioIcon } from "../components/StudioIcon";
import {ChannelWelcome} from "../components/ChannelWelcome";
import "../i18n/strings/Studio";
// 频道页：presence 条 + 实时消息流 + 内联错误条幅 + 插话框。
// App 用 key={slug} 挂载本组件，切频道即整体重建（socket/状态零残留）。
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { TeamBoard, type TeamRoleDraft } from "../components/team/TeamBoard";
import type { TeamSquadDraft } from "../components/team/TeamSquads";
import { TeamShell } from "../components/team/TeamShell";
import { buildTeamBoard } from "../lib/teamBoard";
import { guessJoinPackHarness } from "../lib/joinPack";
import type { CSSProperties } from "react";
import { buildHostBoard, type Attachment, type ChannelSquad, type MsgFrame, type ParticipantRemovedFrame, type PublicDirectedDelivery, type SearchHit, type Sender, type TaskAssigneeKind, type TaskRecord, type TaskState, type TaskSummary, type WakeDelivery } from "@agentparty/shared";
import { AgentDetailPanel } from "../components/AgentDetailModal";
import { LiveSessionModal, hasLiveSession } from "../components/LiveSessionView";
import { draftWithMention } from "../components/LocalOcsSessions";
import { teamMemberOnlineNames } from "../lib/onlineNames";
import { AgentJoin, type JoinGuideSession } from "../components/AgentJoin";
import type {CloudAgentChoice} from "../components/AgentConnectionPicker";
import { AgentTokens } from "../components/AgentTokens";
import { VisibilityToggle } from "../components/VisibilityToggle";
import { JoinLink } from "../components/JoinLink";
import { JoinRequestBanner } from "../components/JoinRequestBanner";
import { OutdatedAgentsNotice } from "../components/OutdatedAgentsNotice";
import { Composer, type UploadItem } from "../components/Composer";
import { MessageCard } from "../components/MessageCard";
import { MentionHeaderNotice, type MentionToastItem } from "../components/MentionToast";
import { PresenceBar } from "../components/PresenceBar";
import { ChannelFocusBar } from "../components/ChannelFocusBar";
import { ChannelFocusPanel } from "../components/ChannelFocusPanel";
import { CatchupPanel } from "../components/CatchupPanel";
import {
  buildHostCandidate,
  HostBoardPanel,
  type HostCandidate,
} from "../components/HostBoardPanel";
import { ChannelAdminView, type ChannelAdminMember, type ChannelAdminViewMemory } from "../components/ChannelAdminView";
import { computeChannelFocus } from "../lib/channelFocus";
import {
  focusMessageNavigationTarget,
  planLoadedMessageNavigation,
  resolveMessageNavigationTarget,
} from "../lib/channelNavigation";
import { useAuthoritativePendingDecisions } from "../lib/pendingDecisions";
import {
  addChannelMember,
  archiveChannel,
  AuthError,
  type ChannelCharter,
  type ChannelIdentity,
  type ChannelRoleInfo,
  type ChannelJoinRequestState,
  ConflictError,
  createTask,
  deleteChannelRole,
  ForbiddenError,
  fetchChannelCharter,
  fetchChannelIdentities,
  fetchChannelRoles,
  fetchSquads,
  createSquad,
  updateSquad,
  deleteSquad,
  fetchMessages,
  fetchMessagesWithRetry,
  fetchTaskSummary,
  fetchTasks,
  fetchWakeDeliveries,
  kickParticipant,
  pauseAgent,
  resumeAgent,
  resetGuard,
  respondDecision,
  reviseMessage,
  reviewCompletion,
  searchMessages,
  setChannelCharter,
  setLoopGuard,
  setWorkflowGuard,
  setChannelRole,
  TooLargeError,
  updateTask,
  uploadAttachment,
  ValidationError,
  type Visibility,
} from "../lib/api";
import type { AuthProviderConfig } from "../lib/oidc";
import {
  buildIdentityDisplay,
  resolveIdentityPresentation,
} from "../lib/identityDisplay";
import { mentionCandidates, parseDraftMentions, type DraftMentionStatus } from "../lib/mentions";
import { buildReceipts } from "../lib/wakeReceipt";
import { completionMessages } from "../lib/completions";
import { catchupKey, shouldShowCatchup, summarizeCatchup } from "../lib/digest";
import { formatAgentRoleSummary } from "../lib/divisionSummary";
import {
  clearDeliveredMentionNotifications,
  isDesktopRuntime,
  mentionNotificationId,
  sendMentionNotification,
  setDesktopBadge,
} from "../lib/desktopRuntime";
import {
  agentFilterSearch,
  filterByAgent,
  parseAgentFilter,
  seqFromQuery,
  setKind,
  toggleAgent,
  type AgentFilter,
  type AgentFilterKind,
  type AgentFilterMode,
} from "../lib/filters";
import { isOwnMention, nextMentionBadgeCountOnce, shouldMarkSeen, shouldNotify, shouldToast } from "../lib/notify";
import { historyFallbackRecovered } from "../lib/historyRecovery";
import {
  beginCharterRead,
  canApplyCharterRead,
  canApplyCharterWrite,
  commitCharterWrite,
} from "../lib/charterRequestGeneration";
import { useCharterRequestGeneration } from "../lib/useCharterRequestGeneration";
import { isNearBottom } from "../lib/scrollPin";
import {stabilizeConversation,observeConversationGeometry,captureReadingAnchor,reconcileThreadIdentities,type ThreadRenderIdentity,type ReadingAnchor} from "../lib/conversationScroll";
import { summarizeReplyPreview } from "../lib/replyPreview";
import { fmtTime } from "../lib/time";
import { groupTeamMessages, summarizeTeams, type TeamMessageThread } from "../lib/teams";
import { resolveTeamMemberView } from "../lib/teamMember";
import type { RoleDraft } from "../lib/channelRoles";
import { ChannelSocket } from "../lib/ws";
import { channelReducer, initialChannelState } from "../state";
import { useT } from "../i18n/useT";
import {ConversationHeader} from "../components/ConversationHeader";
import {ConversationDetails,ConversationTools} from "../components/ConversationDetails";
import "../i18n/strings/CollaborationHub";
const CollaborationHub = lazy(() => import("../components/CollaborationHub"));
import "../i18n/strings/Channel";
import "../i18n/strings/Composer";
import "../i18n/strings/WakeReceipt";

const EMPTY_RECENT_MESSAGES: MsgFrame[] = [];
const SCREEN_READER_ONLY_STYLE: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

interface Props {
  identityRevision?: number;
  title?: string;
  workspaceAction?:{id:number;panel:"search"|"files"|"charter"|"team"|"connect";agent?:string};
  onAgentRoster?(slug:string,agents:readonly {name:string;display?:string;role?:string;connector_type?:string}[]):void;
  slug: string;
  token: string;
  mode: "normal" | "party";
  visibility: Visibility; // 顶栏访问徽章 + 可见性切换初值（spec §4；#381 加 public_watch）
  loopGuardEnabled: boolean;
  loopGuardLimit: number | null;
  workflowGuardEnabled: boolean;
  workflowGuardLimit: number;
  shareMode: boolean;
  // 有可写人类账号会话（me.role==="human" 且非分享链接）才允许铸 agent（spec §10）
  canMintAgent: boolean;
  canResetGuard: boolean;
  canModerate: boolean; // owner/admin 才 true：决定是否渲染可见性切换等管理控件（issue #38）
  agentNamePrefix: string; // 生成 agent 名的前缀来源（email/name 前缀，退回 slug）
  accountKey: string | null;
  inviterName: string; // 当前邀请人的频道身份名，接入包报到时 @ 他
  selfHandle: string | null; // 当前人类账号的 @handle（Task C2 被@通知用；agent/未设置 handle 时为 null）
  notifyOptin: boolean; // 全局 header 中的铃铛状态；频道 ws 只消费，不在工具条重复渲染
  joinRequestStatus: ChannelJoinRequestState | "submitting" | "login_required" | "error";
  joinRequestReason: string | null;
  joinRequestError: string | null;
  joinAuthProviders: AuthProviderConfig[];
  larkDirectoryEnabled: boolean;
  onRequestJoin(note: string): Promise<void>;
  onBeginJoinLogin(provider: AuthProviderConfig): void;
  onRefreshJoinRequest(): Promise<void>;
  onEnterApprovedChannel(): Promise<void>;
  onAuthFailed(message: string): void;
}

// IM 式加载：初始/上翻每页条数，与 DOM 消息窗口上限（贴底时超出即丢最老页，上翻可拉回）
const PAGE_SIZE = 50;
const MESSAGE_CAP = 300;
// 触顶阈值：滚动到离顶部这么近就预取上一页
const TOP_LOAD_PX = 80;

function positiveInt(value: string, fallback: number, max: number): number | null {
  if (value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

function nonNegativeInt(value: string): number | null {
  if (value.trim() === "") return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function readSeenSeq(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeSeenSeq(key: string, seq: number) {
  try {
    localStorage.setItem(key, String(seq));
  } catch {
    // Storage can be unavailable in private contexts; the digest still renders for this session.
  }
}

function charterSeenKey(slug: string): string {
  return `ap_charter_seen:${slug}`;
}

function readSeenCharterRev(slug: string): number {
  try {
    const n = Number(localStorage.getItem(charterSeenKey(slug)) ?? "0");
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeSeenCharterRev(slug: string, rev: number) {
  try {
    localStorage.setItem(charterSeenKey(slug), String(rev));
  } catch {
    // localStorage may be unavailable; the banner still works for this session.
  }
}

type ChannelPanel = "charter" | "team" | "focus" | "tasks" | "search" | "admin" | "collaboration";
type MemberDetailSource = Extract<ChannelPanel, "team" | "admin">;

interface MemberDetailRoute {
  name: string;
  source: MemberDetailSource;
}

interface RemovedChannelMemberSnapshot {
  name: string;
  display: string;
  kind: "agent" | "human";
  account: string;
  detail: string | null;
}

type AdminSurface = "agentJoin" | "agentTokens";

function compactTaskTitle(text: string, fallback: string): string {
  const raw = text.replace(/\s+/g, " ").trim();
  const label = raw === "" ? fallback : raw;
  return label.length > 120 ? `${label.slice(0, 117)}...` : label;
}

// #204 P1②：worker 更新 task 时广播的 system status note 形如 `task #12 in_progress`。
// 任一客户端收到就刷新任务台账，否则 board 的 open_claims/conflicts/blockers 会长期陈旧
// （本地 setTasks 只覆盖本客户端发起的更新）。抽成纯函数便于回归。
export function isTaskLedgerStatusNote(note: string): boolean {
  return /^task #\d+ /.test(note);
}

export function ChannelPage({
  identityRevision = 0,
  title,
  workspaceAction,
  onAgentRoster,
  slug,
  token,
  mode,
  visibility,
  loopGuardEnabled,
  loopGuardLimit,
  workflowGuardEnabled,
  workflowGuardLimit,
  shareMode,
  canMintAgent,
  canResetGuard,
  canModerate,
  agentNamePrefix,
  accountKey,
  inviterName,
  selfHandle,
  notifyOptin,
  joinRequestStatus,
  joinRequestReason,
  joinRequestError,
  joinAuthProviders,
  larkDirectoryEnabled,
  onRequestJoin,
  onBeginJoinLogin,
  onRefreshJoinRequest,
  onEnterApprovedChannel,
  onAuthFailed,
}: Props) {
  const t = useT();
  const [state, dispatch] = useReducer(channelReducer, initialChannelState);
  const [channelIdentities, setChannelIdentities] = useState<ChannelIdentity[]>([]);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [detailsRosterOpen,setDetailsRosterOpen]=useState(false);
  const [workspaceFiles,setWorkspaceFiles]=useState(false);
  const lastWorkspaceAction=useRef(0);
  const [draft, setDraft] = useState("");
  // 附件（#176）：已上传待随下一条消息发出的引用（attachments）+ 在途/失败的每文件上传态（uploads）。
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  // 失败重试要拿回原始 File；uploads 里只存元数据，File 本体放这个 ref（不进 render）。
  const uploadFilesRef = useRef<Map<string, File>>(new Map());
  const [search, setSearch] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchSince, setSearchSince] = useState("");
  const [searchLimit, setSearchLimit] = useState("100");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [guardResetting, setGuardResetting] = useState(false);
  const [guardResetError, setGuardResetError] = useState<string | null>(null);
  const [removingName, setRemovingName] = useState<string | null>(null);
  const [restoringName, setRestoringName] = useState<string | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);
  // 踢出与「恢复成员」共用过 kickError；名单只该显示踢出的失败原因（CodeRabbit）。
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removedChannelMemberSnapshots, setRemovedChannelMemberSnapshots] = useState<
    Record<string, RemovedChannelMemberSnapshot>
  >({});
  const channelAdminMemberRowsRef = useRef(new Map<string, ChannelAdminMember>());
  const [pausingName, setPausingName] = useState<string | null>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [charter, setCharter] = useState<ChannelCharter | null>(null);
  const [wakeDeliveries, setWakeDeliveries] = useState<WakeDelivery[]>([]); // @ 唤醒台账（webhook 侧硬证据）
  // 成员详情保留显式来源：Team 返回 roster，Admin 返回 Members。
  // 两条路由共用外层 dialog，但各自由原面板负责恢复页签与焦点。
  const [memberDetailRoute, setMemberDetailRoute] = useState<MemberDetailRoute | null>(null);
  const [charterEditing, setCharterEditing] = useState(false);
  const charterEditingRef = useRef(false);
  const charterEditBaseRevRef = useRef<number | null>(null);
  const updateCharterEditing = useCallback((editing: boolean) => {
    charterEditingRef.current = editing;
    setCharterEditing(editing);
  }, []);
  const [charterDraft, setCharterDraft] = useState("");
  const {
    generationRef: charterRequestGenerationRef,
    saving: charterSaving,
    beginWrite: beginCharterWriteRequest,
    finishWrite: finishCharterWriteRequest,
  } = useCharterRequestGeneration(slug);
  const [charterError, setCharterError] = useState<string | null>(null);
  const [channelRoles, setChannelRoles] = useState<ChannelRoleInfo[]>([]);
  // 跨 WS/REST 链路共享的成员删除墓碑：participant_removed 可能先于/晚于
  // identities / roles 请求，旧响应不得把已经权威删除的成员重新塞回 roster。
  const removedChannelMembersRef = useRef(new Map<string, number>());
  const channelIdentitiesRequestRef = useRef(0);
  const unknownMemberIdentityRefreshRef = useRef(new Set<string>());
  const channelRolesRequestRef = useRef(0);
  const [channelSquads, setChannelSquads] = useState<ChannelSquad[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const taskLedgerRequestRef = useRef(0);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const taskViewMemory=useRef<TaskLedgerView|null>(null);
  const collaborationViewMemory=useRef<CollaborationView|null>(null);
  const submissionServer=apiBase();
  // Retain the last known owner's guard during async identity refresh. Unknown
  // identity cannot dispatch or borrow that guard; a new known account replaces it.
  const submissionMemory=useRef<GrokSubmissionOwnerMemory["current"]>(null);
  const submissionSafety=ownedGrokSubmissionSafety(submissionMemory,accountKey,submissionServer,slug);
  const [taskActionBusyId, setTaskActionBusyId] = useState<number | null>(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);
  const [taskCreating, setTaskCreating] = useState(false);
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [hostAssignError, setHostAssignError] = useState<string | null>(null);
  const [seenCharterRev, setSeenCharterRev] = useState(() => readSeenCharterRev(slug));
  const channelAdminViewMemory = useRef<ChannelAdminViewMemory | null>(null);
  const [activePanel, setActivePanel] = useState<ChannelPanel | null>(null);
  const [cloudConnectTarget,setCloudConnectTarget]=useState<CloudAgentChoice|null>(null);
  const [activeAdminSurface, setActiveAdminSurface] = useState<AdminSurface | null>(null);
  const [agentManagerTarget, setAgentManagerTarget] = useState<string | null>(null);
  type PanelLocation={key:string;details:boolean;panel:ChannelPanel|null;admin:AdminSurface|null;member:MemberDetailRoute|null;task:number|null;files:boolean;provider:CloudAgentChoice|null;manager:string|null;scroll:number};
  const [panelOrigins,setPanelOrigins]=useState<PanelLocation[]>([]);
  const panelOriginsRef=useRef(panelOrigins);panelOriginsRef.current=panelOrigins;
  const restorePanelScrollRef=useRef<PanelScrollRequest|null>(null);
  const stopPanelScrollRestoreRef=useRef<(()=>void)|null>(null);
  const panelLocationRef=useRef<PanelLocation|null>(null);
  panelLocationRef.current=activePanel||activeAdminSurface||detailsOpen?{key:activePanel??activeAdminSurface??"details",details:detailsOpen,panel:activePanel,admin:activeAdminSurface,member:memberDetailRoute,task:selectedTaskId,files:workspaceFiles,provider:cloudConnectTarget,manager:agentManagerTarget,scroll:0}:null;
  const rememberPanelOrigin=useCallback((target:string)=>{
    const current=panelLocationRef.current;
    // An explicit navigation invalidates an older restoration even within the
    // same panel (for example connections -> files while content is loading).
    stopPanelScrollRestoreRef.current?.();restorePanelScrollRef.current=null;
    const body=typeof document==='undefined'?null:document.querySelector<HTMLElement>(current?.details?'.conversation-details-content':current?.admin==='agentTokens'?'.agentmanager-dialog .settings-content':current?.admin==='agentJoin'?'.agent-join-card':'.channel-panel-body');
    setPanelOrigins(previous=>pushPanelOrigin(previous,current?{...current,scroll:body?.scrollTop??0}:null,target));
  },[]);
  useLayoutEffect(()=>{
    const request=restorePanelScrollRef.current;
    if(request===null)return;
    stopPanelScrollRestoreRef.current=restorePanelScrollWhenReady({
      request,root:document,currentKey:()=>panelLocationRef.current?.key??null,
      onDone:()=>{if(restorePanelScrollRef.current===request)restorePanelScrollRef.current=null;},
    });
    return ()=>{stopPanelScrollRestoreRef.current?.();stopPanelScrollRestoreRef.current=null;};
  },[activePanel,activeAdminSurface,memberDetailRoute,detailsOpen]);

  useEffect(()=>{if(activePanel!==null||activeAdminSurface!==null)setDetailsOpen(false);},[activePanel,activeAdminSurface]);
  // #1009：「接入凭证」面板点「接入引导 / 重新接上」交过来的一次引导会话——转给 AgentJoin 打开四步 stepper。
  const [joinGuideSession, setJoinGuideSession] = useState<JoinGuideSession | null>(null);
  const [localLoopGuardEnabled, setLocalLoopGuardEnabled] = useState(loopGuardEnabled);
  const [localLoopGuardLimit, setLocalLoopGuardLimit] = useState(loopGuardLimit === null ? "" : String(loopGuardLimit));
  const [localWorkflowGuardEnabled, setLocalWorkflowGuardEnabled] = useState(workflowGuardEnabled);
  const [localWorkflowGuardLimit, setLocalWorkflowGuardLimit] = useState(String(workflowGuardLimit));
  const [guardSaving, setGuardSaving] = useState<"loop" | "workflow" | null>(null);
  const [guardConfigError, setGuardConfigError] = useState<string | null>(null);
  // 可见性可在会话内切换（issue #38 web；#381 三档），本地 state 让顶栏徽章即时反映，无需重载
  const [localVisibility, setLocalVisibility] = useState(visibility);
  // 顶栏徽章：public 与 public_watch 都对外可读（挂徽章），仅 public_watch 显「WATCH」区分观看档
  const localPublic = localVisibility !== "private";
  const localWatch = localVisibility === "public_watch";
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [seenSeq, setSeenSeq] = useState<number | null>(null);
  const [teamNow, setTeamNow] = useState(() => Date.now());
  const [completionOnly, setCompletionOnly] = useState(false);
  const [agentFilter, setAgentFilter] = useState<AgentFilter>(() => parseAgentFilter(window.location.search));
  const [messageViewRestore, setMessageViewRestore] = useState<{
    completionOnly: boolean;
    agentFilter: AgentFilter;
  } | null>(null);
  const messageNavigationRequestRef = useRef(0);
  const messageNavigationCompletionRef = useRef<{
    request: number;
    resolve: (located: boolean) => void;
  } | null>(null);
  const skipPanelFocusRestoreRef = useRef(false);
  const [pendingMessageJump, setPendingMessageJump] = useState<{
    seq: number;
    sender: string;
    request: number;
  } | null>(null);
  const [messageNavigationError, setMessageNavigationError] = useState<string | null>(null);
  const [messageNavigationAnnouncement, setMessageNavigationAnnouncement] = useState("");
  useEffect(() => {
    if (activePanel !== null) skipPanelFocusRestoreRef.current = false;
  }, [activePanel]);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editingSeq, setEditingSeq] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [messageActionError, setMessageActionError] = useState<{ seq: number; message: string } | null>(null);

  useEffect(() => {
    if (historyError !== null && historyFallbackRecovered(state.status)) setHistoryError(null);
  }, [historyError, state.status]);
  const [messageActionBusySeq, setMessageActionBusySeq] = useState<number | null>(null);
  // 频道决策协议（#284）：人类/moderator 在频道内对某条 decision_request 拍板
  const [decisionBusySeq, setDecisionBusySeq] = useState<number | null>(null);
  // 被@浏览器通知（Task C2）：opt-in 由 App header 的铃铛持有；频道只供 ws 入帧点判定。
  // optin/selfHandle/t 都放 ref：onFrame 挂在 socket 连接的 effect 里，
  // 若把它们放进依赖数组，切铃铛/切语言会连累整个 ws 重连——用 ref 让判定读到最新值又不触发重连。
  const optinRef = useRef(notifyOptin);
  optinRef.current = notifyOptin;
  const selfHandleRef = useRef(selfHandle);
  selfHandleRef.current = selfHandle;
  const selfNameRef = useRef(state.self);
  selfNameRef.current = state.self;
  const tRef = useRef(t);
  tRef.current = t;
  const notifiedSeqRef = useRef<Set<number>>(new Set()); // seq 去重：防同一帧被重复处理时重复弹通知
  const desktopMentionBadgeRef = useRef(0);
  const badgeSeenSeqRef = useRef<Set<number>>(new Set()); // per channel mount; retain on read/reset and reconnect
  const toastedSeqRef = useRef<Set<number>>(new Set()); // seq 去重：页内 toast 同一帧只弹一次
  const [toasts, setToasts] = useState<MentionToastItem[]>([]);
  const dismissToast = useCallback((seq: number) => {
    setToasts((cur) => cur.filter((tt) => tt.seq !== seq));
  }, []);
  const settleMessageNavigation = useCallback((request: number, located: boolean) => {
    const completion = messageNavigationCompletionRef.current;
    if (completion?.request !== request) return;
    messageNavigationCompletionRef.current = null;
    completion.resolve(located);
  }, []);
  const cancelPendingMessageNavigation = useCallback(() => {
    const completion = messageNavigationCompletionRef.current;
    messageNavigationCompletionRef.current = null;
    completion?.resolve(false);
    setPendingMessageJump(null);
  }, []);
  useEffect(() => () => {
    const completion = messageNavigationCompletionRef.current;
    messageNavigationCompletionRef.current = null;
    completion?.resolve(false);
  }, []);
  const sockRef = useRef<ChannelSocket | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  // 每条已写出 ws 的待发消息一个条目，按客户端自增 id 标识；服务端每回一个终局帧（sent 或 error）
  // 就按 id 精确摘掉队头一条。用 id 而非无脑 shift：即便同一次归约被 React 触发两次也幂等（issue #633）。
  const pendingSendsRef = useRef<Array<{ id: number; draft: string; replyTo: number | null }>>([]);
  const pendingSendIdRef = useRef(0);
  const stickBottom = useRef(true);
  const readingAnchorRef = useRef<ReadingAnchor | null>(null);
  const threadIdentitiesRef = useRef<ThreadRenderIdentity[]>([]);
  const authFailedRef = useRef(onAuthFailed);
  authFailedRef.current = onAuthFailed;
  const {
    lastSuccessfulData: pendingDecisionData,
    loading: pendingDecisionsLoading,
    error: pendingDecisionsError,
    refresh: refreshPendingDecisions,
    observeFrame: observePendingDecisionFrame,
  } = useAuthoritativePendingDecisions({
    token,
    slug,
    onAuthError: () => authFailedRef.current(tRef.current("Channel.error.tokenRevoked")),
  });

  useEffect(() => {
    setLocalLoopGuardEnabled(loopGuardEnabled);
    setLocalLoopGuardLimit(loopGuardLimit === null ? "" : String(loopGuardLimit));
    setLocalWorkflowGuardEnabled(workflowGuardEnabled);
    setLocalWorkflowGuardLimit(String(workflowGuardLimit));
    setGuardConfigError(null);
    setGuardSaving(null);
  }, [loopGuardEnabled, loopGuardLimit, slug, workflowGuardEnabled, workflowGuardLimit]);
  // IM 式加载：初始只拉最新一页、ws 从页尾游标接力；触顶上翻加载更早页
  const [bootstrapped, setBootstrapped] = useState(false); // 初始页已就绪，ws 才连
  const hasMoreRef = useRef(true); // 还有更早的历史可上翻
  const loadingOlderRef = useRef(false); // 上翻请求进行中（去抖）
  const [olderStatus, setOlderStatus] = useState<"idle" | "loading" | "error" | "end">("idle");
  // ws hello 的起始游标。初始 seed = 初始页最后一条 seq，之后随每条 live/补拉帧单调前进（#861）——
  // socket 重建（token 静默续期）时必须带着已见水位重连，绝不退回 0 让服务端全量重放。
  const initialCursorRef = useRef(0);
  // #861：初始页加载失败期间，本连接收到的帧一律不提醒（窗口为空 ⇒ 下界防御失效，
  // 服务端会把全部历史 @ 当 live 帧重放）。初始页成功后复位。
  const replayUntrustedRef = useRef(false);
  const initialHistoryRequestRef = useRef(0);
  const olderHistoryRequestRef = useRef(0);
  useEffect(() => () => { olderHistoryRequestRef.current += 1; loadingOlderRef.current = false; }, [token, slug]);
  const pendingAnchorRef = useRef<{ height: number; top: number } | null>(null); // prepend 前的滚动锚
  const oldestSeqRef = useRef(0);
  oldestSeqRef.current = state.messages.length > 0 ? state.messages[0]!.seq : 0;
  const removedMemberNames = useMemo(
    () => new Set(Object.keys(state.removedParticipants)),
    [state.removedParticipants],
  );
  useEffect(() => {
    // Snapshot rows are session-local recovery affordances. Once a later
    // authoritative roster releases a tombstone, discard the old row rather
    // than turning historical identity data into durable membership.
    setRemovedChannelMemberSnapshots((current) => {
      let changed = false;
      const next = { ...current };
      for (const name of Object.keys(next)) {
        if (removedMemberNames.has(name)) continue;
        delete next[name];
        changed = true;
      }
      return changed ? next : current;
    });
  }, [removedMemberNames]);
  // Current roster authority deliberately excludes message history. Otherwise a
  // freshly reloaded page would recreate a permanently removed member from an
  // old sender snapshot even though identities / roles / participants all
  // agree that the identity is gone.
  const authoritativeMemberNames = useMemo(() => {
    const names = new Set<string>([
      ...state.participants.map((participant) => participant.name),
      ...Object.keys(state.presence),
      ...channelIdentities.map((identity) => identity.name),
      ...channelRoles.map((role) => role.name),
    ]);
    for (const name of removedMemberNames) names.delete(name);
    names.delete("system");
    return names;
  }, [
    channelIdentities,
    channelRoles,
    removedMemberNames,
    state.participants,
    state.presence,
  ]);
  const authoritativeMemberNamesRef = useRef(authoritativeMemberNames);
  authoritativeMemberNamesRef.current = authoritativeMemberNames;
  // 发送、编辑和草稿状态条必须使用同一份最终补全候选。否则中文紧邻正文
  // （例如“请@小明看一下”）会在预览中解析正确，提交时却把正文后缀吞进目标名。
  const mentionOptions = useMemo(
    () => mentionCandidates(
      state.participants,
      state.presence,
      state.self,
      teamNow,
      channelIdentities,
      channelRoles,
      channelSquads,
      Object.values(state.mentionSenders),
      removedMemberNames,
      authoritativeMemberNames,
    ),
    [
      channelIdentities,
      channelRoles,
      channelSquads,
      authoritativeMemberNames,
      removedMemberNames,
      state.mentionSenders,
      state.participants,
      state.presence,
      state.self,
      teamNow,
    ],
  );
  const mentionNames = useMemo(() => mentionOptions.map((candidate) => candidate.name), [mentionOptions]);

  const applyParticipantRemoval = useCallback((removal: ParticipantRemovedFrame) => {
    const member = channelAdminMemberRowsRef.current.get(removal.name);
    if (member?.account != null && member.account !== "") {
      setRemovedChannelMemberSnapshots((current) => {
        if (current[removal.name] !== undefined) return current;
        return {
          ...current,
          [removal.name]: {
            name: member.name,
            display: member.display,
            kind: member.kind,
            account: member.account!,
            detail: member.detail ?? null,
          },
        };
      });
    }
    const previous = removedChannelMembersRef.current.get(removal.name) ?? 0;
    removedChannelMembersRef.current.set(removal.name, Math.max(previous, removal.removed_at));
    channelIdentitiesRequestRef.current += 1;
    channelRolesRequestRef.current += 1;
    dispatch({ type: "frame", frame: removal });
    setChannelIdentities((current) => {
      const next = current.filter((identity) => identity.name !== removal.name);
      return next.length === current.length ? current : next;
    });
    setChannelRoles((current) => {
      const next = current.filter((role) => role.name !== removal.name);
      return next.length === current.length ? current : next;
    });
    setMemberDetailRoute((current) => current?.name === removal.name ? null : current);
  }, []);

  const loadCharter = useCallback((preserveError = false) => {
    const request = beginCharterRead(charterRequestGenerationRef.current);
    return fetchChannelCharter(token, slug)
      .then((body) => {
        if (!canApplyCharterRead(charterRequestGenerationRef.current, request)) return;
        setCharter(body);
        if (!charterEditingRef.current) setCharterDraft(body.charter ?? "");
        if (!preserveError) setCharterError(null);
      })
      .catch((err: unknown) => {
        if (!canApplyCharterRead(charterRequestGenerationRef.current, request)) return;
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (!(err instanceof ForbiddenError)) setCharterError(tRef.current("Channel.charter.error.loadFailed"));
      });
  }, [slug, token]);

  const loadIdentities = useCallback(() => {
    const requestId = ++channelIdentitiesRequestRef.current;
    return fetchChannelIdentities(token, slug)
      .then((identities) => {
        if (requestId !== channelIdentitiesRequestRef.current) return;
        setChannelIdentities(
          identities.filter((identity) => !removedChannelMembersRef.current.has(identity.name)),
        );
      })
      .catch((err: unknown) => {
        if (requestId !== channelIdentitiesRequestRef.current) return;
        // A transient refresh failure must not erase the last verified names.
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
      });
  }, [slug, token]);

  useEffect(() => {
    void loadIdentities();
    const refresh = () => { if (document.visibilityState !== "hidden") void loadIdentities(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval?.(refresh, 60_000);
    return () => {
      if (timer !== undefined) window.clearInterval?.(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [identityRevision, loadIdentities]);

  const nicknameSaved = useCallback((name: string, nickname: string) => {
    // The server accepted this mutation. Update all projections now, then read
    // back authority without changing identity, routing or member visibility.
    channelIdentitiesRequestRef.current += 1;
    setChannelIdentities(current => current.map(identity => identity.name === name
      ? { ...identity, display: nickname, handle: nickname, nickname } : identity));
    void loadIdentities();
  }, [loadIdentities]);

  const loadRoles = useCallback(() => {
    const requestId = ++channelRolesRequestRef.current;
    return fetchChannelRoles(token, slug)
      .then((roles) => {
        if (requestId !== channelRolesRequestRef.current) return;
        const currentRoles = roles.filter((role) => !removedChannelMembersRef.current.has(role.name));
        setChannelRoles(currentRoles);
        setRoleError(null);
      })
      .catch((err: unknown) => {
        if (requestId !== channelRolesRequestRef.current) return;
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (!(err instanceof ForbiddenError)) setRoleError(tRef.current("Channel.roles.loadFailed"));
      });
  }, [slug, token]);

  const applyAuthoritativeParticipantRemoval = useCallback((removal: ParticipantRemovedFrame) => {
    // A generic removal can create an account tombstone, so the named frame
    // is not a complete list of affected identities. Apply its immediate
    // target cleanup, then replace identities/roles from server authority so
    // same-owner siblings cannot remain as Team/@ ghosts.
    applyParticipantRemoval(removal);
    void loadIdentities();
    void loadRoles();
  }, [applyParticipantRemoval, loadIdentities, loadRoles]);

  const restoreParticipantProjection = useCallback((name: string) => {
    // restored:true is the REST authority that the server no longer has a
    // current removal tombstone. No other response may release these local
    // guards: an absent removal frame alone can also mean a malformed/stale
    // response and must remain fail-closed.
    removedChannelMembersRef.current.delete(name);
    dispatch({ type: "participant_restored", name });
    setRemovedChannelMemberSnapshots((current) => {
      if (current[name] === undefined) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    void loadIdentities();
    void loadRoles();
  }, [loadIdentities, loadRoles]);

  const loadSquads = useCallback(() => {
    return fetchSquads(token, slug)
      .then((squads) => {
        setChannelSquads(squads);
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (!(err instanceof ForbiddenError)) setChannelSquads([]);
      });
  }, [slug, token]);

  const loadTaskLedger = useCallback(() => {
    const requestId = ++taskLedgerRequestRef.current;
    setTasksLoading(true);
    return Promise.all([fetchTasks(token, slug), fetchTaskSummary(token, slug)])
      .then(([items, summary]) => {
        if (requestId !== taskLedgerRequestRef.current) return;
        setTasks(items);
        setTaskSummary(summary);
        setTasksError(null);
        setTaskActionError(null);
      })
      .catch((err: unknown) => {
        if (requestId !== taskLedgerRequestRef.current) return;
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setTasksError(tRef.current("Channel.tasks.error.notVisible"));
        else setTasksError(tRef.current("Channel.tasks.error.loadFailed"));
      })
      .finally(() => {
        if (requestId === taskLedgerRequestRef.current) setTasksLoading(false);
      });
  }, [slug, token]);

  const loadTaskSummary = useCallback(() => {
    return fetchTaskSummary(token, slug)
      .then(setTaskSummary)
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
      });
  }, [slug, token]);

  const applyTaskUpdate = useCallback((id: number, body: Parameters<typeof updateTask>[3]) => {
    if (taskActionBusyId !== null) return;
    setTaskActionBusyId(id);
    setTaskActionError(null);
    updateTask(token, slug, id, body)
      .then((task) => {
        taskLedgerRequestRef.current += 1;
        setTasksLoading(false);
        setTasks((current) => current.map((item) => item.id === task.id ? task : item));
        void loadTaskSummary();
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setTaskActionError(t("Channel.tasks.error.updateForbidden"));
        else if (err instanceof ValidationError) setTaskActionError(t("Channel.tasks.error.updateRejected"));
        else setTaskActionError(t("Channel.tasks.error.updateFailed"));
      })
      .finally(() => setTaskActionBusyId(null));
  }, [loadTaskSummary, slug, taskActionBusyId, token, t]);

  const setTaskState = useCallback((id: number, state: TaskState, blockedReason?: string) => {
    const reason = blockedReason?.trim();
    applyTaskUpdate(id, {
      state,
      ...(state === "blocked" && reason !== undefined ? { blocked_reason: reason || null } : {}),
    });
  }, [applyTaskUpdate]);

  const assignTask = useCallback((id: number, rawName: string, kind: TaskAssigneeKind) => {
    const name = rawName.trim().replace(/^@/, "");
    if (name === "") {
      setTaskActionError(t("Channel.tasks.error.assigneeRequired"));
      return;
    }
    applyTaskUpdate(id, { state: "assigned", assignee: { name, kind } });
  }, [applyTaskUpdate, t]);

  // 面板内「新建任务」：复用后端既有 POST /api/channels/:slug/tasks（与 createTaskFromMessage 同一端点，
  // 不新造接口）。返回 boolean 让 composer 知道成功后才清空并收起。
  const createTaskDraft = useCallback((input: {
    title: string;
    desc: string;
    priority: number;
    assignee: { name: string; kind: TaskAssigneeKind } | null;
    attachments?: Attachment[];
  }): Promise<boolean> => {
    if (taskCreating) return Promise.resolve(false);
    setTaskCreating(true);
    setTaskCreateError(null);
    return createTask(token, slug, {
      title: input.title,
      ...(input.desc === "" ? {} : { desc: input.desc }),
      priority: input.priority,
      assignee: input.assignee,
      ...(input.attachments && input.attachments.length > 0 ? { attachments: input.attachments } : {}),
    })
      .then((task) => {
        taskLedgerRequestRef.current += 1;
        setTasksLoading(false);
        setTasks((current) => current.some((item) => item.id === task.id) ? current : [task, ...current]);
        void loadTaskSummary();
        setTasksError(null);
        return true;
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setTaskCreateError(t("Channel.tasks.error.createForbidden"));
        else if (err instanceof ValidationError) setTaskCreateError(t("Channel.tasks.error.createRejected"));
        else setTaskCreateError(t("Channel.tasks.error.createFailed"));
        return false;
      })
      .finally(() => setTaskCreating(false));
  }, [loadTaskSummary, slug, taskCreating, token, t]);

  const reviewTask = useCallback((task: TaskRecord, action: "approve" | "reject", reason?: string) => {
    if (taskActionBusyId !== null) return;
    const seq = taskCompletionSeq(task);
    if (seq === null) {
      setTaskActionError(t("Channel.tasks.error.noReviewable"));
      return;
    }
    const rejectReason = reason?.trim();
    if (action === "reject" && !rejectReason) return;
    setTaskActionBusyId(task.id);
    setTaskActionError(null);
    reviewCompletion(
      token,
      slug,
      seq,
      action === "approve" ? { action: "approve" } : { action: "reject", reason: rejectReason! },
    )
      .then(() => loadTaskLedger())
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setTaskActionError(t("Channel.tasks.error.reviewForbidden"));
        else if (err instanceof ValidationError) setTaskActionError(t("Channel.tasks.error.reviewRejected"));
        else setTaskActionError(t("Channel.tasks.error.reviewFailed"));
      })
      .finally(() => setTaskActionBusyId(null));
  }, [loadTaskLedger, slug, taskActionBusyId, token, t]);

  // 人类对某条 decision_request 点选项/审批（#284）；reject reason 由消息卡内联编辑器收集。
  const respondToDecision = useCallback(
    (seq: number, choice: { action: "approve" } | { action: "reject"; reason?: string } | { option: number }) => {
      if (decisionBusySeq !== null) return;
      let body: { action: "approve" | "reject"; reason?: string } | { option: number };
      if ("action" in choice && choice.action === "reject") {
        body = choice.reason ? { action: "reject", reason: choice.reason } : { action: "reject" };
      } else {
        body = choice;
      }
      setDecisionBusySeq(seq);
      respondDecision(token, slug, seq, body)
        .then(() => refreshPendingDecisions())
        .catch((err: unknown) => {
          if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
          else if (err instanceof ForbiddenError) setMessageActionError({ seq, message: t("Channel.decision.error.forbidden") });
          else if (err instanceof ValidationError) setMessageActionError({ seq, message: t("Channel.decision.error.rejected") });
          else setMessageActionError({ seq, message: t("Channel.decision.error.failed") });
        })
        .finally(() => setDecisionBusySeq(null));
    },
    [decisionBusySeq, refreshPendingDecisions, slug, token, t],
  );

  // #204：host board 的 conflicts 与 resolve-conflict / review-blockers 建议都从任务台账派生。
  // HostBoardPanel 已归入 Focus；若这里只拉 summary，Focus 会一直显示「无冲突」直到用户碰巧
  // 点开任务面板——空的 board 与「确实没有冲突」在界面上无法区分。故挂载时拉完整台账
  // （loadTaskLedger 同时取 tasks 与 summary，替代原先单拉 summary 的调用）。
  useEffect(() => {
    void loadTaskLedger();
  }, [loadTaskLedger]);

  const createTaskFromMessage = useCallback((seq: number) => {
    if (messageActionBusySeq !== null) return;
    const message = state.messages.find((item) => item.seq === seq);
    if (message === undefined || message.kind !== "message" || message.retracted) return;
    setMessageActionBusySeq(seq);
    setMessageActionError(null);
    createTask(token, slug, {
      title: compactTaskTitle(
        message.body,
        t("Channel.tasks.fromMessageTitle", { sender: message.sender.name, seq: message.seq }),
      ),
      anchor_seqs: [message.seq],
    })
      .then((task) => {
        taskLedgerRequestRef.current += 1;
        setTasksLoading(false);
        setTasks((current) => current.some((item) => item.id === task.id) ? current : [task, ...current]);
        void loadTaskSummary();
        setTasksError(null);
        setActiveAdminSurface(null);
        setSelectedTaskId(task.id);
        setActivePanel("tasks");
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setMessageActionError({ seq, message: t("Channel.tasks.error.createForbidden") });
        else if (err instanceof ValidationError) setMessageActionError({ seq, message: t("Channel.tasks.error.createRejected") });
        else setMessageActionError({ seq, message: t("Channel.tasks.error.createFailed") });
      })
      .finally(() => setMessageActionBusySeq(null));
  }, [loadTaskSummary, messageActionBusySeq, slug, state.messages, token, t]);

  const restoreRemovedParticipant = useCallback((member: ChannelAdminMember) => {
    if (
      removingName !== null
      || restoringName !== null
      || member.removed !== true
      || member.account == null
      || member.account === ""
    ) {
      return;
    }
    setRestoringName(member.name);
    setKickError(null);
    addChannelMember(token, slug, member.account, member.name)
      .then(() => {
        // PUT success is the authority that membership and the targeted
        // tombstone were restored. Do not fabricate a participant locally;
        // release guards and let the full identities/roles snapshots converge.
        restoreParticipantProjection(member.name);
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setKickError(t("ChannelAdmin.members.restoreForbidden"));
        else setKickError(t("ChannelAdmin.members.restoreFailed"));
      })
      .finally(() => setRestoringName(null));
  }, [removingName, restoreParticipantProjection, restoringName, slug, token, t]);

  const removeParticipant = useCallback((name: string, alsoNames: readonly string[] = []) => {
    if (removingName !== null || restoringName !== null) return;
    // #1070：名单一行 = 一个人。踢一个人要连他名下其它会话一起移除，否则「跨账号/多会话的同一个人」
    // 只被踢掉代表身份，其余会话仍留在频道里。附属会话的失败**不能吞**——吞了就等于谎报「全部移除」。
    const extra = alsoNames.filter((other) => other !== name);
    const ok = window.confirm(
      extra.length === 0
        ? t("Channel.kick.confirm", { name })
        : t("Channel.kick.confirmSessions", { name, count: extra.length + 1 }),
    );
    if (!ok) return;
    setRemovingName(name);
    setKickError(null);
    setRemoveError(null);
    void (async () => {
      const leftovers: string[] = [];
      let authFailed = false;
      // A broadcast failure is not a removal failure: the server keeps the
      // tombstone active and returns it so the requester can project it
      // locally. restored:true is the only response allowed to release a
      // tombstone after an authoritative same-name rejoin.
      // 附属会话的回包同样要投影——丢掉它，广播失败时页面会继续显示已删除的会话（Codex stop-review 第三轮）。
      const applyRemovalResult = (target: string, result: Awaited<ReturnType<typeof kickParticipant>>) => {
        if (result?.restored === true) {
          restoreParticipantProjection(target);
        } else if (result?.removal !== null && result?.removal !== undefined) {
          applyAuthoritativeParticipantRemoval(result.removal);
        }
      };
      try {
        for (const other of extra) {
          try {
            applyRemovalResult(other, await kickParticipant(token, slug, other, "remove"));
          } catch (err: unknown) {
            if (err instanceof AuthError) {
              authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
              authFailed = true;
              break;
            }
            leftovers.push(other);
          }
        }
        if (authFailed) return;
        try {
          applyRemovalResult(name, await kickParticipant(token, slug, name, "remove"));
        } catch (err: unknown) {
          if (err instanceof AuthError) {
            authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
            return;
          }
          const message = err instanceof ForbiddenError ? t("Channel.kick.forbidden") : t("Channel.kick.failed");
          setKickError(message);
          setRemoveError(message);
          return;
        }
        // 主会话成功但附属会话有失败：明说哪几个还在，别让人以为已经踢干净。
        if (leftovers.length > 0) {
          const message = t("Channel.kick.partial", { names: leftovers.join("、"), count: leftovers.length });
          setKickError(message);
          setRemoveError(message);
        }
      } finally {
        setRemovingName(null);
      }
    })();
  }, [
    applyAuthoritativeParticipantRemoval,
    removingName,
    restoreParticipantProjection,
    restoringName,
    slug,
    token,
    t,
  ]);

  // 人为暂停某 agent 的接待（#180）：被 @ 也不唤醒（webhook 不投、serve/watch 自我抑制），消息仍进历史。
  const pauseAgentReception = useCallback((name: string, resumeAt: number | null) => {
    if (pausingName !== null) return;
    setPausingName(name);
    setPauseError(null);
    pauseAgent(token, slug, name, resumeAt ?? undefined)
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setPauseError(t("Channel.pause.forbidden"));
        else setPauseError(t("Channel.pause.failed"));
      })
      .finally(() => setPausingName(null));
  }, [pausingName, slug, token, t]);

  const resumeAgentReception = useCallback((name: string) => {
    if (pausingName !== null) return;
    setPausingName(name);
    setPauseError(null);
    resumeAgent(token, slug, name)
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setPauseError(t("Channel.pause.forbidden"));
        else setPauseError(t("Channel.pause.failed"));
      })
      .finally(() => setPausingName(null));
  }, [pausingName, slug, token, t]);

  const archiveCurrentChannel = useCallback(() => {
    if (archiving || state.archived) return;
    const ok = window.confirm(t("Channel.archive.confirm", { slug }));
    if (!ok) return;
    setArchiving(true);
    setArchiveError(null);
    archiveChannel(token, slug)
      .then(() => {
        dispatch({ type: "fatal", reason: "archived" });
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setArchiveError(t("Channel.archive.forbidden"));
        else setArchiveError(t("Channel.archive.failed"));
      })
      .finally(() => setArchiving(false));
  }, [archiving, slug, state.archived, token, t]);

  useEffect(() => {
    setSeenCharterRev(readSeenCharterRev(slug));
    void loadCharter();
    void loadIdentities();
    void loadRoles();
    void loadSquads();
  }, [loadCharter, loadIdentities, loadRoles, loadSquads, slug]);

  // IM 式初始加载：先用 rest 拉最新一页（打开即到底部），把 ws 起始游标 seed 到页尾，
  // ws 只补拉/直播页尾之后的新消息——不再全量重放整个频道历史。
  // 归档频道同样被这条覆盖（ws 会被 1008 踢掉，历史靠这页 + 上翻）。
  const loadInitialPage = useCallback(() => {
    const request = ++initialHistoryRequestRef.current;
    olderHistoryRequestRef.current += 1; // invalidate old pages, including old-token failures
    loadingOlderRef.current = false;
    pendingAnchorRef.current = null;
    hasMoreRef.current = true;
    // #861：**绝不**在这里把游标清 0。token 静默续期（App.tsx setToken）会让本 effect 与
    // ws effect 在同一次 commit 里重跑，ws effect 读到清 0 的 ref 就会以 since=0 建 socket，
    // 服务端把整段历史当 live 帧重放，10 天前的老 @ 当场弹通知。游标只单调前进。
    setOlderStatus("idle");
    setHistoryError(null);
    fetchMessagesWithRetry(token, slug, { before: Number.MAX_SAFE_INTEGER, limit: PAGE_SIZE })
      .then((msgs) => {
        if (request !== initialHistoryRequestRef.current) return;
        setHistoryError(null);
        for (const m of msgs) dispatch({ type: "frame", frame: m }); // 按 seq 去重，与 ws 交叠无害
        hasMoreRef.current = msgs.length >= PAGE_SIZE;
        if (!hasMoreRef.current) setOlderStatus("end");
        // 单调前进：live 帧已把游标推得比这页页尾更远时（重建 socket 场景）不许回退。
        const pageTail = msgs.length > 0 ? msgs[msgs.length - 1]!.seq : 0;
        initialCursorRef.current = Math.max(initialCursorRef.current, pageTail);
        replayUntrustedRef.current = false; // 历史已可信，恢复提醒
        setBootstrapped(true);
      })
      .catch((err: unknown) => {
        if (request !== initialHistoryRequestRef.current) return;
        if (err instanceof AuthError) {
          authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
          return;
        }
        if (err instanceof ForbiddenError) {
          dispatch({ type: "fatal", reason: "forbidden" });
          return;
        }
        // 初始页失败：退回 ws 全量重放（since=0 —— 只在游标本就是 0 时成立），页面仍可用。
        // #861：此时 state.messages 为空 ⇒ 下界防御（floor > 0）整体失效，服务端会把频道里
        // 所有历史 @ 当 live 帧重放。显式标记「本次降级期间的帧一律不提醒」，直到某次初始页
        // 加载成功、历史重新可信为止。游标同样不清 0（已加载过就保住已见水位）。
        setHistoryError(tRef.current("Channel.history.loadFailed"));
        replayUntrustedRef.current = true;
        hasMoreRef.current = false;
        setOlderStatus("end");
        setBootstrapped(true);
      });
  }, [slug, token]);

  useEffect(() => {
    void loadInitialPage();
    return () => {
      initialHistoryRequestRef.current += 1;
    };
  }, [loadInitialPage]);

  useEffect(() => {
    if (!bootstrapped) return;
    const sock = new ChannelSocket(
      slug,
      token,
      {
        onFrame: (frame) => {
          if (frame.type === "participant_removed") {
            applyAuthoritativeParticipantRemoval(frame);
            return;
          }
          // participant_removed 是 live 事件、不会历史重放。断线期间错过它时，
          // welcome 的权威 roster + 最新 identities / roles REST 一起完成收敛。
          // 若权威 welcome 明确包含同名成员，说明这是删除后的合法重入：解除
          // session tombstone 后重拉两个 roster；旧在途响应由请求号挡住。
          if (frame.type === "welcome") {
            for (const participant of frame.participants) {
              removedChannelMembersRef.current.delete(participant.name);
            }
            void loadIdentities();
            void loadRoles();
          }
          if (frame.type === "participants") {
            let restoredMember = false;
            for (const participant of frame.participants) {
              restoredMember = removedChannelMembersRef.current.delete(participant.name) || restoredMember;
            }
            if (restoredMember) {
              void loadIdentities();
              void loadRoles();
            }
          }
          if (
            (frame.type === "msg" || frame.type === "status")
            && frame.sender.name !== "system"
            && !authoritativeMemberNamesRef.current.has(frame.sender.name)
            && !removedChannelMembersRef.current.has(frame.sender.name)
            && !unknownMemberIdentityRefreshRef.current.has(frame.sender.name)
          ) {
            // identities is the durable membership authority, but it was
            // fetched at mount. A newly joined webhook/REST sender may speak
            // without first appearing in participants/presence, so refresh
            // once before allowing its historical snapshot into @/Team.
            unknownMemberIdentityRefreshRef.current.add(frame.sender.name);
            void loadIdentities().finally(() => {
              unknownMemberIdentityRefreshRef.current.delete(frame.sender.name);
            });
          }
          observePendingDecisionFrame(frame);
          // decision ledger 不推进 charter_rev；重连必须无条件拉 bundle，避免断线期间的刷新
          // status 已落在 since cursor 之前而永久保留旧 active_decisions。requestRef 防旧请求反盖。
          if (frame.type === "welcome") {
            void loadCharter();
          }
          if (
            (frame.type === "msg" || frame.type === "status") &&
            frame.kind === "status" &&
            frame.sender.name === "system" &&
            (frame.note ?? frame.body).startsWith("charter updated to rev ")
          ) {
            void loadCharter();
          }
          if (
            (frame.type === "msg" || frame.type === "status") &&
            frame.kind === "status" &&
            frame.sender.name === "system" &&
            (frame.note ?? frame.body).startsWith("decision ledger updated: ")
          ) {
            void loadCharter();
          }
          // #204 P1②：任一客户端更新 task 会广播一条 `task #N <state>` system status。
          // 收到就刷新台账，否则 board 的 open_claims/conflicts/blockers 会长期陈旧——本地
          // setTasks 只覆盖本客户端发起的更新，看不到别人改的（门禁 P1）。
          if (
            (frame.type === "msg" || frame.type === "status") &&
            frame.kind === "status" &&
            isTaskLedgerStatusNote(frame.note ?? frame.body)
          ) {
            void loadTaskLedger();
          }
          // 窗口下界防御（review P1 双保险）：低于已加载窗口的旧消息/旧修订不进窗口——
          // 插进去会把上翻分页的 before 起点拽到远古 seq，中段历史被永久跳过。
          // 上翻时 REST 本来就返回当前正文，丢掉这些帧无信息损失。
          // #861：游标随每条消息帧单调前进，socket 重建时才能带着已见水位重连（hello.since）。
          if ((frame.type === "msg" || frame.type === "status") && frame.seq > initialCursorRef.current) {
            initialCursorRef.current = frame.seq;
          }
          const floor = oldestSeqRef.current;
          if (floor > 0) {
            if ((frame.type === "msg" || frame.type === "status") && frame.seq < floor) return;
            if (frame.type === "message_update" && frame.message.seq < floor) return;
          }
          // 被@浏览器通知（Task C2）：每条 ws 入帧只处理一次，天然按 seq 去重；notifiedSeqRef 兜底
          // 防万一同一帧被重复送进这个回调（例如未来重连语义变化）时重复弹窗。
          if (
            frame.type === "msg" &&
            !notifiedSeqRef.current.has(frame.seq) &&
            !replayUntrustedRef.current &&
            shouldNotify(frame, selfHandleRef.current, document.hidden, optinRef.current, selfNameRef.current)
          ) {
            notifiedSeqRef.current.add(frame.seq);
            const title = tRef.current("Channel.notify.title", { channel: slug });
            // #861：带上消息**自身**的时间。弹窗从来只打频道名+正文，用户无从发现
            // 「通知时间 ≠ @ 时间」——这次让它一眼可见。
            const body = `${fmtTime(frame.ts)} · ${summarizeReplyPreview(frame.body)}`;
            if (isDesktopRuntime()) {
              void sendMentionNotification({ title, body, slug, seq: frame.seq });
            } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const notification = new Notification(title, { body });
              notification.onclick = () => {
                window.focus();
                window.location.hash = `#msg-${frame.seq}`;
                notification.close();
              };
            }
          }
          if (frame.type === "msg" && !replayUntrustedRef.current) {
            const nextBadge = nextMentionBadgeCountOnce(
              badgeSeenSeqRef.current,
              desktopMentionBadgeRef.current,
              frame,
              selfHandleRef.current,
              document.hidden,
              selfNameRef.current,
            );
            if (nextBadge !== desktopMentionBadgeRef.current) {
              desktopMentionBadgeRef.current = nextBadge;
              void setDesktopBadge(nextBadge);
            }
          }
          // 被@页内 toast（聚焦态）：与上面的系统通知按 document.hidden 互斥，各自 seq 去重
          if (
            frame.type === "msg" &&
            !toastedSeqRef.current.has(frame.seq) &&
            !replayUntrustedRef.current &&
            shouldToast(frame, selfHandleRef.current, document.hidden, optinRef.current, selfNameRef.current)
          ) {
            toastedSeqRef.current.add(frame.seq);
            setToasts((cur) =>
              [
                ...cur,
                {
                  seq: frame.seq,
                  sender: frame.sender, // 存原始 sender，渲染时用 resolveSenderLabel 解析，与消息卡显示保持一致
                  body: summarizeReplyPreview(frame.body),
                  fullBody: frame.body, // #280：完整正文，供 toast 悬停看全文
                  ts: frame.ts, // #861：消息自身时间，提醒里直接打出来
                },
              ].slice(-3),
            );
          }
          dispatch({ type: "frame", frame });
        },
        onStatus: (status) => dispatch({ type: "status", status }),
        onFatal: (reason) => {
          if (reason === "revoked") authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
          else dispatch({ type: "fatal", reason });
        },
      },
      { queryToken: shareMode, initialCursor: initialCursorRef.current },
    );
    sockRef.current = sock;
    sock.connect();
    return () => {
      sock.dispose();
      sockRef.current = null;
    };
  }, [
    slug,
    token,
    shareMode,
    bootstrapped,
    applyAuthoritativeParticipantRemoval,
    loadCharter,
    loadIdentities,
    loadRoles,
    loadTaskLedger,
    observePendingDecisionFrame,
  ]);

  useEffect(() => {
    const onPopState = () => setAgentFilter(parseAgentFilter(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTeamNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("agent");
    url.searchParams.delete("agentMode");
    url.searchParams.delete("agentKind");
    const filterSearch = agentFilterSearch(agentFilter);
    if (filterSearch !== "") {
      const params = new URLSearchParams(filterSearch);
      for (const [key, value] of params) url.searchParams.set(key, value);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [agentFilter]);

  // 新消息贴底滚动；用户上翻回看时不打扰
  const lastSeq = state.messages.length > 0 ? state.messages[state.messages.length - 1]!.seq : 0;
  const seenKey = state.self === null ? null : catchupKey(slug, state.self);
  // 已读游标（Phase 2）：贴底看到最新消息时回一个 seen，声明「我读到 lastSeq」。分享只读链接不上报
  // （避免匿名 UUID 混进已读名单）。sentSeenRef 去重，发送失败（断线）不推进、下次贴底重试。
  const sentSeenRef = useRef(0);
  const lastSeqRef = useRef(lastSeq);
  lastSeqRef.current = lastSeq;
  const sendSeen = useCallback(
    (seq: number) => {
      if (shareMode || seq <= sentSeenRef.current) return;
      const ok = sockRef.current?.send({ type: "seen", seq }) ?? false;
      if (ok) sentSeenRef.current = seq;
    },
    [shareMode],
  );

  useEffect(() => {
    if (shouldMarkSeen(document.hidden, stickBottom.current)) sendSeen(lastSeq);
    // 贴底时收窄消息窗口：DOM 不挂几千条；被丢弃的最老页上翻会重新拉回
    if (stickBottom.current && state.messages.length > MESSAGE_CAP + PAGE_SIZE) {
      dispatch({ type: "trim", keep: MESSAGE_CAP });
      hasMoreRef.current = true;
      setOlderStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSeq]);

  useEffect(() => {
    const el = streamRef.current;
    if (el === null) return;
    const repin = () => {
      if (pendingAnchorRef.current !== null) return;
      readingAnchorRef.current = stabilizeConversation(el, stickBottom.current, readingAnchorRef.current);
    };
    return observeConversationGeometry(el, repin);
  }, []);

  // 当前频道已加载窗口里所有 @我的确定性通知 id：聚焦时据此精确清掉本频道在通知中心的
  // 旧 @提醒，绝不误删其他频道的（issue #399 / CodeRabbit #401）。用 ref 供 markVisible 读最新值。
  const mentionNotificationIds = useMemo(
    () => state.messages.filter((m) => isOwnMention(m, selfHandle, state.self)).map((m) => mentionNotificationId(slug, m.seq)),
    [state.messages, selfHandle, state.self, slug],
  );
  const mentionNotificationIdsRef = useRef<number[]>(mentionNotificationIds);
  mentionNotificationIdsRef.current = mentionNotificationIds;

  useEffect(() => {
    const markVisible = () => {
      if (document.hidden) return;
      desktopMentionBadgeRef.current = 0;
      void setDesktopBadge(0);
      // 聚焦即视为读到：清掉通知中心里本频道堆积的旧 @提醒，否则每次打开桌面版仍会看到已读的 @（issue #399）。
      void clearDeliveredMentionNotifications(slug, mentionNotificationIdsRef.current);
      if (stickBottom.current) sendSeen(lastSeqRef.current);
    };
    document.addEventListener("visibilitychange", markVisible);
    window.addEventListener("focus", markVisible);
    markVisible();
    return () => {
      document.removeEventListener("visibilitychange", markVisible);
      window.removeEventListener("focus", markVisible);
      desktopMentionBadgeRef.current = 0;
      void setDesktopBadge(0);
    };
  }, [sendSeen, slug]);

  // prepend 老页后的 scroll anchoring：绘制前把 scrollTop 平移新增高度，视口纹丝不动
  const firstSeq = state.messages.length > 0 ? state.messages[0]!.seq : 0;
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    const el = streamRef.current;
    if (anchor === null || el === null) return;
    pendingAnchorRef.current = null;
    el.scrollTop = el.scrollHeight - anchor.height + anchor.top;
    readingAnchorRef.current = captureReadingAnchor(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstSeq]);

  useEffect(() => {
    if (seenKey === null) return;
    const stored = readSeenSeq(seenKey);
    if (stored === null) {
      if (lastSeq <= 0) return;
      writeSeenSeq(seenKey, lastSeq);
      setSeenSeq(lastSeq);
      return;
    }
    setSeenSeq(stored);
  }, [lastSeq, seenKey]);

  // 触顶上翻：拉 before=<已加载最老 seq> 的上一页，并记录滚动锚（useLayoutEffect 恢复）
  const loadOlder = useCallback(() => {
    const el = streamRef.current;
    if (el === null || loadingOlderRef.current || !hasMoreRef.current) return;
    const oldest = oldestSeqRef.current;
    if (oldest <= 1) {
      hasMoreRef.current = false;
      setOlderStatus("end");
      return;
    }
    loadingOlderRef.current = true;
    setOlderStatus("loading");
    const request = ++olderHistoryRequestRef.current;
    void settleCurrentRequest(fetchMessages(token, slug, { before: oldest, limit: PAGE_SIZE }),
      () => request === olderHistoryRequestRef.current, {
      success: (msgs) => {
        if (msgs.length < PAGE_SIZE) hasMoreRef.current = false;
        setOlderStatus(hasMoreRef.current ? "idle" : "end");
        if (msgs.length === 0) return;
        // 锚在 dispatch 前一刻采样（review P2）：请求飞行期间用户可能已滚走/来了新消息，
        // 用请求发出时的旧锚会把视口拽回触顶位置
        const now = streamRef.current;
        if (now !== null) pendingAnchorRef.current = { height: now.scrollHeight, top: now.scrollTop };
        for (const m of msgs) dispatch({ type: "frame", frame: m });
        // 整页都被去重（firstSeq 没变 → layout effect 不跑）时，别让残锚泄漏到下一次
        requestAnimationFrame(() => {
          if (request === olderHistoryRequestRef.current) pendingAnchorRef.current = null;
        });
      },
      error: (err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) dispatch({ type: "fatal", reason: "forbidden" });
        else setOlderStatus("error");
      },
      settled: () => {
        loadingOlderRef.current = false;
      },
    });
  }, [token, slug]);

  const onScroll = useCallback(() => {
    const el = streamRef.current;
    if (el === null) return;
    // A reader even slightly above the bottom must not be pulled down again.
    stickBottom.current = isNearBottom(el, 2);
    readingAnchorRef.current = captureReadingAnchor(el);
    if (stickBottom.current) sendSeen(lastSeqRef.current); // 滚到底＝看到了最新，回执已读
    if (el.scrollTop < TOP_LOAD_PX) loadOlder();
  }, [loadOlder, sendSeen]);

  // 按 id 精确摘掉待发队头一条（已被服务端终结的那次 send），返回被摘条目；队空即 no-op。
  // 摘队头而非按内容匹配：ws 有序，服务端对每次 send 恰好回一个终局帧（sent 或 error），FIFO 对齐。
  // #633：按 FIFO 摘队头。服务端在同一条 WebSocket 上**串行**处理 send 并**按序**回终局帧——每条 send
  // 恰好对应一个 sent 或一个 send-拒绝 error（见 state.ts 仅对 send-拒绝码 bump sendRejectedSeq，连接级
  // 的 forbidden 不算），故终局帧与待发条目严格同序，摘队头即摘其对应条目。head.id 用于幂等（万一某个
  // reconcile effect 重入也只删这一条、不误删两条）。若未来终局回执会乱序/去重/合并，需服务端在 sent/error
  // 帧里回带一个 client_id 精确关联——那是跨 worker+shared+web 的协议强化，非本 bug 修复范围。
  const reconcilePendingSend = useCallback(() => {
    const head = pendingSendsRef.current[0];
    if (head === undefined) return undefined;
    pendingSendsRef.current = pendingSendsRef.current.filter((p) => p.id !== head.id);
    return head;
  }, []);

  // 服务端 sent 确认后才清对应草稿；用户已输入的新内容不能被旧 ack 清掉。
  useEffect(() => {
    if (state.lastSentSeq <= 0) return;
    const submitted = reconcilePendingSend();
    if (submitted === undefined) return;
    setDraft((current) => (current === submitted.draft ? "" : current));
    setReplyTo((current) => (current === submitted.replyTo ? null : current));
  }, [state.lastSentSeq, reconcilePendingSend]);

  // 服务端 error 帧（loop_guard / rate_limited / too_large / unauthorized / archived）即一次 send 被拒：
  // 它永不发 sent，若不在此摘掉对应待发条目，FIFO 队列永久错位一位——之后一次成功发送的 sent ack 会去
  // 清那条陈旧草稿、清不掉真正已发出的 composer，用户误以为没发出去而重复发送（issue #633）。被拒时草稿
  // 保留供重试，故这里只摘队头、不动 composer。
  useEffect(() => {
    if (state.sendRejectedSeq <= 0) return;
    reconcilePendingSend();
  }, [state.sendRejectedSeq, reconcilePendingSend]);

  const send = useCallback(() => {
    const body = draft.trim();
    // 上传在途时按下 ⌘⏎ 不发（按钮已 disabled，但快捷键绕过它）——否则会漏掉还没落 R2 的引用。
    if (uploads.some((u) => u.status === "uploading")) return;
    // 有附件时允许空正文（纯图片/文件消息）
    if (body === "" && attachments.length === 0) return;
    // 与草稿 chips / 服务端 BODY_MENTION_RE 同一份语义：@ 前须行首或非标识符字符，不吃 email 里的 @。
    // #663：网页没有独立的「显式 mention」输入口，所有 @ 都来自正文提取，故整体走 body_mentions——
    // 命中的照常路由/唤醒，未命中的（如自然语言「@我」）由服务端降级为文本，绝不硬拒整条发送。
    // 权威 mentions 留空，与 CLI/Worker 共享同一条「显式 vs 正文」契约。
    const bodyMentions = parseDraftMentions(body, mentionNames);
    const ok =
      sockRef.current?.send({
        type: "send",
        kind: "message",
        body,
        mentions: [],
        ...(bodyMentions.length > 0 ? { body_mentions: bodyMentions } : {}),
        reply_to: replyTo,
        ...(attachments.length > 0 ? { attachments } : {}),
      }) ?? false;
    // ⌘⏎ 不受按钮 disabled 门控，断线窗口内发送失败要内联提示（草稿保留）
    if (ok) {
      pendingSendsRef.current.push({ id: ++pendingSendIdRef.current, draft, replyTo });
      // 附件已落 R2，ws 已接收帧 → 乐观清空待发引用（失败上传一并丢弃，失败时保留草稿由 ack 逻辑处理）
      setAttachments([]);
      setUploads([]);
      uploadFilesRef.current.clear();
    } else {
      dispatch({ type: "send_failed", message: tRef.current("Channel.error.sendNotConnected") });
    }
  }, [draft, replyTo, attachments, uploads, mentionNames]);

  // 单文件上传：先落一条 uploading 态，成功转入 attachments、失败转 error 态（可重试）。
  const runUpload = useCallback(
    async (id: string, file: File) => {
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: "uploading", error: undefined } : u)));
      try {
        const meta = await uploadAttachment(token, slug, file);
        uploadFilesRef.current.delete(id);
        setUploads((prev) => prev.filter((u) => u.id !== id));
        setAttachments((prev) => (prev.some((a) => a.key === meta.key) ? prev : [...prev, meta]));
      } catch (err) {
        if (err instanceof AuthError) {
          authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
          return;
        }
        const error =
          err instanceof TooLargeError
            ? tRef.current("Channel.upload.tooLarge")
            : err instanceof ForbiddenError
              ? tRef.current("Channel.upload.forbidden")
              : tRef.current("Channel.upload.failed");
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: "error", error } : u)));
      }
    },
    [token, slug],
  );

  // 选/拖/粘贴文件 → 每文件一条上传态并行上传；上限 25MB / 20 个由服务端强制，前端只报错不拦。
  const onPickFiles = useCallback(
    (files: FileList) => {
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID();
        uploadFilesRef.current.set(id, file);
        setUploads((prev) => [...prev, { id, filename: file.name, size: file.size, status: "uploading" }]);
        void runUpload(id, file);
      }
    },
    [runUpload],
  );

  const onRetryUpload = useCallback(
    (id: string) => {
      const file = uploadFilesRef.current.get(id);
      if (file !== undefined) void runUpload(id, file);
    },
    [runUpload],
  );

  const onCancelUpload = useCallback((id: string) => {
    uploadFilesRef.current.delete(id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const onRemoveAttachment = useCallback((key: string) => {
    setAttachments((prev) => prev.filter((a) => a.key !== key));
  }, []);

  const canWrite = state.self !== null && !state.archived && !state.readonly;
  // 谁能回应决策（#284）：人类账号会话（canMintAgent ⟹ me.role==="human"）或频道 moderator。
  // 服务端才是权威（human OR moderator）；这里只决定是否给这位查看者渲染选项按钮。
  const canRespondDecision = !state.archived && (canModerate || canMintAgent);
  const charterUpdated = charter !== null && charter.charter_rev > seenCharterRev;
  const catchupDigest =
    state.self !== null && seenSeq !== null && lastSeq > seenSeq
      ? summarizeCatchup(state.messages, state.self, seenSeq)
      : null;

  const onResetGuard = useCallback(() => {
    if (guardResetting) return;
    setGuardResetting(true);
    setGuardResetError(null);
    resetGuard(token, slug)
      .then(() => {
        dispatch({ type: "guard_reset" });
        setGuardResetError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setGuardResetError(tRef.current("Channel.guard.error.forbidden"));
        else setGuardResetError(tRef.current("Channel.guard.error.failed"));
      })
      .finally(() => setGuardResetting(false));
  }, [guardResetting, slug, token]);

  const onCaughtUp = useCallback(() => {
    if (seenKey !== null) writeSeenSeq(seenKey, lastSeq);
    setSeenSeq(lastSeq);
  }, [lastSeq, seenKey]);

  const openPanel = useCallback((panel: ChannelPanel) => {
    rememberPanelOrigin(panel);
    skipPanelFocusRestoreRef.current = false;
    setActiveAdminSurface(null);
    setMemberDetailRoute(null);
    setSelectedTaskId(null);
    if (panel === "charter" && charter !== null) {
      writeSeenCharterRev(slug, charter.charter_rev);
      setSeenCharterRev(charter.charter_rev);
    }
    if (panel === "tasks" || panel === "team" || panel === "focus") void loadTaskLedger();
    setActivePanel(panel);
  }, [charter, loadTaskLedger, slug, rememberPanelOrigin]);



  const openFocusedTask = useCallback((taskId: number) => {
    rememberPanelOrigin("tasks");
    skipPanelFocusRestoreRef.current = false;
    setActiveAdminSurface(null);
    setMemberDetailRoute(null);
    setSelectedTaskId(taskId);
    void loadTaskLedger();
    setActivePanel("tasks");
  }, [loadTaskLedger, rememberPanelOrigin]);

  const setAdminSurface = useCallback((surface: AdminSurface, open: boolean) => {
    if(open){if(panelLocationRef.current?.admin!==surface)rememberPanelOrigin(surface);}else {stopPanelScrollRestoreRef.current?.();restorePanelScrollRef.current=null;setPanelOrigins([]);}
    setActivePanel(null);
    setMemberDetailRoute(null);
    setActiveAdminSurface(open ? surface : null);
    if (!open || surface !== "agentTokens") setAgentManagerTarget(null);
    // 引导会话的清理不放在这里：还有别的路径会直接 setActiveAdminSurface(null)（openTeamMember 等），
    // 只在这一处清会漏（pr_agent on #1010）。改由下面那个 effect 按「当前面板是不是 agentJoin」兜住全部路径。
  }, [rememberPanelOrigin]);

  // 引导会话只属于当前打开的 stepper：面板一旦不是 agentJoin（关掉、切到别的面板、被成员详情顶掉…）
  // 就丢掉，否则下次点「＋ 让 agent 加入」会自己弹回上一次那个身份的引导。openJoinGuide 与
  // setActiveAdminSurface("agentJoin") 在同一批提交，effect 看到的已是 agentJoin，不会误清。
  useEffect(() => {
    if (activeAdminSurface !== "agentJoin") setJoinGuideSession(null);
  }, [activeAdminSurface]);

  // 「接入凭证」面板 → 四步引导：先记下 session，再把面板切到 agentJoin（两个面板不打架）。
  const openJoinGuide = useCallback((session: JoinGuideSession) => {
    rememberPanelOrigin("agentJoin");
    setActivePanel(null);
    setMemberDetailRoute(null);
    setAgentManagerTarget(null);
    setJoinGuideSession(session);
    setActiveAdminSurface("agentJoin");
  }, [rememberPanelOrigin]);

  // #1103：live session 只读终端。所有入口都调它，打开的是同一份 state.liveSessions[name]。
  const [liveSessionTarget, setLiveSessionTarget] = useState<string | null>(null);
  const closeLiveSession = useCallback(() => {setLiveSessionTarget(null);setPanelOrigins([]);}, []);
  const liveSessionsRef = useRef(state.liveSessions);
  liveSessionsRef.current = state.liveSessions;
  const hasLiveSessionFor = useCallback(
    (name: string) => hasLiveSession(liveSessionsRef.current, name),
    // 依赖 liveSessions 让 MessageCard 在流出现/消失时重渲染入口状态。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.liveSessions],
  );

  const openTeamMember = useCallback((name: string) => {
    if (!authoritativeMemberNamesRef.current.has(name)) return;
    rememberPanelOrigin("team");
    skipPanelFocusRestoreRef.current = false;
    setActiveAdminSurface(null);
    setMemberDetailRoute({ name, source: "team" });
    setActivePanel("team");
    void loadTaskLedger();
  }, [loadTaskLedger, rememberPanelOrigin]);
  useEffect(()=>{
    if(!workspaceAction||workspaceAction.id===lastWorkspaceAction.current)return;
    if(!workspaceActionReady(workspaceAction,{canConnect:canMintAgent&&accountKey!==null&&!state.archived,members:authoritativeMemberNames}))return;
    lastWorkspaceAction.current=workspaceAction.id;
    setWorkspaceFiles(workspaceAction.panel==='files');
    if(workspaceAction.panel==='files'){setCloudConnectTarget(null);collaborationViewMemory.current=null;}
    if(workspaceAction.panel==='connect'){if(canMintAgent&&accountKey!==null&&!state.archived)setAdminSurface('agentJoin',true);return;}
    if(workspaceAction.agent){openTeamMember(workspaceAction.agent);return;}
    openPanel(workspaceAction.panel==='files'?'collaboration':workspaceAction.panel);
  },[workspaceAction,openPanel,openTeamMember,canMintAgent,accountKey,state.archived,setAdminSurface,authoritativeMemberNames]);
  const canOpenTeamMember = useCallback(
    (name: string) => authoritativeMemberNamesRef.current.has(name),
    [],
  );

  const openAdminMember = useCallback((name: string) => {
    skipPanelFocusRestoreRef.current = false;
    setActiveAdminSurface(null);
    setMemberDetailRoute({ name, source: "admin" });
  }, []);

  const closeChannelPanel = useCallback(() => {
    setPanelOrigins([]);
    stopPanelScrollRestoreRef.current?.();restorePanelScrollRef.current=null;
    messageNavigationRequestRef.current += 1;
    cancelPendingMessageNavigation();
    setMemberDetailRoute(null);
    setSelectedTaskId(null);
    setActivePanel(null);
  }, [cancelPendingMessageNavigation]);

  const backChannelPanel=useCallback(()=>{
    const {previous,remaining}=popPanelOrigin(panelOriginsRef.current);
    if(!previous){closeChannelPanel();return;}
    stopPanelScrollRestoreRef.current?.();
    setPanelOrigins(remaining);
    setDetailsOpen(previous.details);
    setWorkspaceFiles(previous.files);setCloudConnectTarget(previous.provider);
    setMemberDetailRoute(previous.member);setSelectedTaskId(previous.task);setAgentManagerTarget(previous.manager);
    setActiveAdminSurface(previous.admin);setActivePanel(previous.panel);
    restorePanelScrollRef.current={key:previous.key,top:previous.scroll,selector:previous.details?'.conversation-details-content':previous.admin==='agentTokens'?'.agentmanager-dialog .settings-content':previous.admin==='agentJoin'?'.agent-join-card':'.channel-panel-body'};
  },[closeChannelPanel]);
  const panelBackTarget=panelOrigins.at(-1);
  const panelBackLabel=panelBackTarget?t(panelBackTarget.details?"Studio.id":panelBackTarget.admin==="agentTokens"?"AgentTokens.managerTitle":panelBackTarget.panel==='team'?'Channel.tools.team':panelBackTarget.panel==='tasks'?'Channel.tasks.title':panelBackTarget.panel==='focus'?'ChannelFocusBar.overviewTitle':panelBackTarget.panel==='charter'?'Channel.tools.charter':panelBackTarget.panel==='collaboration'?'Collab.title':panelBackTarget.panel==='admin'?'ChannelAdmin.title':panelBackTarget.admin==='agentJoin'?'AgentConnect.back':'Channel.tools.timeline'):undefined;

  // #1113：「本机可介入」里的 @：把 @name 放进输入框开头（已有就不重复），发送仍走 Composer。
  const mentionFromRoster = useCallback((name: string) => {
    setDraft((current) => draftWithMention(current, name));
  }, []);

  // #1103：live session 取代而不是叠在频道面板上——任一时刻只有一个 aria-modal dialog
  // （否则 Esc/Tab 会被两个 focus trap 同时处理）。
  const openLiveSession = useCallback((name: string) => {
    rememberPanelOrigin("live-session");
    setActivePanel(null);setActiveAdminSurface(null);
    setLiveSessionTarget(name);
  }, [rememberPanelOrigin]);

  const closeMemberDetail = useCallback(() => {
    setMemberDetailRoute(null);
  }, []);

  const editCharter = useCallback(() => {
    if (charter === null) {
      void loadCharter();
      return;
    }
    charterEditBaseRevRef.current = charter.charter_rev;
    updateCharterEditing(true);
    setCharterDraft(charter?.charter ?? "");
    setCharterError(null);
  }, [charter, loadCharter, updateCharterEditing]);

  const cancelCharterEdit = useCallback(() => {
    charterEditBaseRevRef.current = null;
    updateCharterEditing(false);
    setCharterDraft(charter?.charter ?? "");
    setCharterError(null);
  }, [charter, updateCharterEditing]);

  const saveCharter = useCallback(() => {
    if (charterSaving) return;
    const expectedRev = charterEditBaseRevRef.current;
    if (expectedRev === null) {
      setCharterError(tRef.current("Channel.charter.error.loadFailed"));
      void loadCharter();
      return;
    }
    const requestId = beginCharterWriteRequest();
    if (requestId === null) return;
    let reloadAfterConflict = false;
    setCharterError(null);
    setChannelCharter(
      token,
      slug,
      charterDraft,
      expectedRev,
    )
      .then((body) => {
        if (!commitCharterWrite(charterRequestGenerationRef.current, requestId)) return;
        setCharter(body);
        setCharterDraft(body.charter ?? "");
        charterEditBaseRevRef.current = null;
        updateCharterEditing(false);
        writeSeenCharterRev(slug, body.charter_rev);
        setSeenCharterRev(body.charter_rev);
      })
      .catch((err: unknown) => {
        if (!canApplyCharterWrite(charterRequestGenerationRef.current, requestId)) return;
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setCharterError(tRef.current("Channel.charter.error.forbidden"));
        else if (err instanceof ConflictError) {
          reloadAfterConflict = true;
          setCharterError(tRef.current("Channel.charter.error.conflict"));
        } else if (err instanceof ValidationError) setCharterError(tRef.current("Channel.charter.error.tooLarge"));
        else setCharterError(tRef.current("Channel.charter.error.saveFailed"));
      })
      .finally(() => {
        const finished = finishCharterWriteRequest(requestId);
        if (finished && reloadAfterConflict) void loadCharter(true);
      });
  }, [
    beginCharterWriteRequest,
    charterDraft,
    charterSaving,
    finishCharterWriteRequest,
    loadCharter,
    slug,
    token,
    updateCharterEditing,
  ]);

  const saveLoopGuard = useCallback(() => {
    if (guardSaving !== null) return;
    const limit = Number(localLoopGuardLimit);
    if (localLoopGuardEnabled && (!Number.isInteger(limit) || limit < 1 || limit > 10_000)) {
      setGuardConfigError(t("Channel.settings.invalidLoop"));
      return;
    }
    setGuardSaving("loop");
    setGuardConfigError(null);
    setLoopGuard(token, slug, localLoopGuardEnabled, localLoopGuardEnabled ? limit : undefined)
      .then((result) => {
        setLocalLoopGuardEnabled(result.enabled);
        setLocalLoopGuardLimit(result.limit === null ? "" : String(result.limit));
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setGuardConfigError(t("Channel.settings.forbidden"));
        else if (err instanceof ValidationError) setGuardConfigError(t("Channel.settings.invalidLoop"));
        else setGuardConfigError(t("Channel.settings.saveFailed"));
      })
      .finally(() => setGuardSaving(null));
  }, [guardSaving, localLoopGuardEnabled, localLoopGuardLimit, slug, t, token]);

  const saveWorkflowGuard = useCallback(() => {
    if (guardSaving !== null) return;
    const limit = Number(localWorkflowGuardLimit);
    if (localWorkflowGuardEnabled && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
      setGuardConfigError(t("Channel.settings.invalidWorkflow"));
      return;
    }
    setGuardSaving("workflow");
    setGuardConfigError(null);
    setWorkflowGuard(token, slug, localWorkflowGuardEnabled, localWorkflowGuardEnabled ? limit : undefined)
      .then((result) => {
        setLocalWorkflowGuardEnabled(result.enabled);
        setLocalWorkflowGuardLimit(String(result.limit ?? limit));
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setGuardConfigError(t("Channel.settings.forbidden"));
        else if (err instanceof ValidationError) setGuardConfigError(t("Channel.settings.invalidWorkflow"));
        else setGuardConfigError(t("Channel.settings.saveFailed"));
      })
      .finally(() => setGuardSaving(null));
  }, [guardSaving, localWorkflowGuardEnabled, localWorkflowGuardLimit, slug, t, token]);

  // 一键无限（issue #182）：直接把守卫置为 disabled=无限/关闭并落库，
  // 不需要用户先取消勾选再保存——把「无限」从复选框语义提升成显式动作。
  const setLoopUnlimited = useCallback(() => {
    if (guardSaving !== null) return;
    setGuardSaving("loop");
    setGuardConfigError(null);
    setLoopGuard(token, slug, false)
      .then((result) => {
        setLocalLoopGuardEnabled(result.enabled);
        setLocalLoopGuardLimit(result.limit === null ? "" : String(result.limit));
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setGuardConfigError(t("Channel.settings.forbidden"));
        else setGuardConfigError(t("Channel.settings.saveFailed"));
      })
      .finally(() => setGuardSaving(null));
  }, [guardSaving, slug, t, token]);

  const setWorkflowUnlimited = useCallback(() => {
    if (guardSaving !== null) return;
    setGuardSaving("workflow");
    setGuardConfigError(null);
    setWorkflowGuard(token, slug, false)
      .then((result) => {
        setLocalWorkflowGuardEnabled(result.enabled);
        setLocalWorkflowGuardLimit(result.limit === null ? String(workflowGuardLimit) : String(result.limit));
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setGuardConfigError(t("Channel.settings.forbidden"));
        else setGuardConfigError(t("Channel.settings.saveFailed"));
      })
      .finally(() => setGuardSaving(null));
  }, [guardSaving, slug, t, token, workflowGuardLimit]);

  const saveRole = useCallback(async (
    rawName: string,
    roleDraft: RoleDraft,
    reportError: (message: string | null) => void = setRoleError,
  ): Promise<boolean> => {
    const name = rawName.trim();
    if (name === "" || roleSaving !== null) return false;
    const savingKey = channelRoles.some((role) => role.name === name) ? name : "__new__";
    setRoleSaving(savingKey);
    reportError(null);
    try {
      const saved = await setChannelRole(token, slug, name, roleDraft.role, roleDraft.responsibility);
      setChannelRoles((current) => {
        if (removedChannelMembersRef.current.has(saved.name)) {
          return current.filter((role) => role.name !== saved.name);
        }
        const previous = current.find((role) => role.name === saved.name);
        return [...current.filter((role) => role.name !== saved.name), { ...previous, ...saved }];
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
      else if (err instanceof ForbiddenError) reportError(t("Channel.roles.forbidden"));
      else if (err instanceof ValidationError) reportError(t("Channel.roles.invalid"));
      else reportError(t("Channel.roles.saveFailed"));
      return false;
    } finally {
      setRoleSaving(null);
    }
  }, [channelRoles, roleSaving, slug, token, t]);

  const assignChannelHost = useCallback((name: string) => (
    saveRole(name, {
      role: "host",
      responsibility: t("Channel.hostBoard.defaultResponsibility"),
    }, setHostAssignError)
  ), [saveRole, t]);

  // #370 组织树：就地设置某成员向谁汇报（reportsTo=null 清空）。沿用现有角色/职责，只改 reports_to。
  const setReportsTo = useCallback((name: string, reportsTo: string | null) => {
    if (roleSaving !== null) return;
    const current = channelRoles.find((role) => role.name === name);
    if (current === undefined) return;
    setRoleSaving(name);
    setRoleError(null);
    setChannelRole(token, slug, name, current.role, current.responsibility ?? "", reportsTo)
      .then((saved) => {
        setChannelRoles((roles) => (
          removedChannelMembersRef.current.has(saved.name)
            ? roles.filter((role) => role.name !== saved.name)
            : [...roles.filter((role) => role.name !== saved.name), { ...current, ...saved }]
        ));
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setRoleError(t("Channel.roles.forbidden"));
        else if (err instanceof ValidationError) setRoleError(t("Channel.roles.invalid"));
        else setRoleError(t("Channel.roles.saveFailed"));
      })
      .finally(() => setRoleSaving(null));
  }, [channelRoles, roleSaving, slug, token, t]);

  const clearRole = useCallback((name: string) => {
    if (roleSaving !== null) return;
    const ok = window.confirm(t("Channel.roles.clearConfirm", { name }));
    if (!ok) return;
    setRoleSaving(name);
    setRoleError(null);
    deleteChannelRole(token, slug, name)
      .then(() => {
        setChannelRoles((current) => current.filter((role) => role.name !== name));
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setRoleError(t("Channel.roles.forbidden"));
        else setRoleError(t("Channel.roles.saveFailed"));
      })
      .finally(() => setRoleSaving(null));
  }, [roleSaving, slug, token, t]);

  const replyMessage = useMemo(
    () => (replyTo === null ? null : state.messages.find((message) => message.seq === replyTo) ?? null),
    [replyTo, state.messages],
  );
  const editingMessage = useMemo(
    () => (editingSeq === null ? null : state.messages.find((message) => message.seq === editingSeq) ?? null),
    [editingSeq, state.messages],
  );
  const replyPreview =
    replyMessage === null
      ? t("Channel.reply.unavailable")
      : replyMessage.retracted
        ? t("Channel.reply.retracted")
        : summarizeReplyPreview(replyMessage.body);

  useEffect(() => {
    if (editingSeq === null) return;
    if (editingMessage !== null && editingMessage.kind === "message" && !editingMessage.retracted) return;
    setEditingSeq(null);
    setEditDraft("");
    setEditSaving(false);
    setMessageActionError((current) => (current?.seq === editingSeq ? null : current));
  }, [editingMessage, editingSeq]);

  const startReply = useCallback((seq: number) => {
    setReplyTo(seq);
    setMessageActionError((current) => (current?.seq === seq ? null : current));
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const startEdit = useCallback((seq: number) => {
    const target = state.messages.find((message) => message.seq === seq);
    if (target === undefined || target.kind !== "message" || target.retracted) return;
    setEditingSeq(seq);
    setEditDraft(target.body);
    setMessageActionError(null);
  }, [state.messages]);

  const cancelEdit = useCallback(() => {
    setEditingSeq(null);
    setEditDraft("");
    setEditSaving(false);
    setMessageActionError(null);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingSeq === null || editSaving || editingMessage === null || editingMessage.kind !== "message") return;
    if (editDraft.trim() === "") return;
    // #722：未改动就点保存 → 直接关掉编辑器(等价取消),不发无谓请求。保存键不再因此变灰,
    // 所以这里必须把「无变化」当成一次干净的关闭,而不是静默 no-op(否则又变成点了没反应)。
    if (editDraft.trim() === editingMessage.body.trim()) {
      setEditingSeq(null);
      setEditDraft("");
      setMessageActionError(null);
      return;
    }
    setEditSaving(true);
    setMessageActionBusySeq(editingSeq);
    setMessageActionError(null);
    const mentions = parseDraftMentions(editDraft, mentionNames);
    reviseMessage(slug, editingSeq, "edit", { body: editDraft, mentions })
      .then(({ message }) => {
        dispatch({ type: "frame", frame: message });
        setEditingSeq(null);
        setEditDraft("");
        setMessageActionError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setMessageActionError({ seq: editingSeq, message: t("Channel.revise.edit.forbidden") });
        else if (err instanceof ValidationError) setMessageActionError({ seq: editingSeq, message: t("Channel.revise.edit.invalid") });
        else setMessageActionError({ seq: editingSeq, message: t("Channel.revise.edit.failed") });
      })
      .finally(() => {
        setEditSaving(false);
        setMessageActionBusySeq((current) => (current === editingSeq ? null : current));
      });
  }, [editDraft, editSaving, editingMessage, editingSeq, mentionNames, slug, t]);

  const retractMessage = useCallback((seq: number) => {
    if (messageActionBusySeq !== null) return;
    if (!window.confirm(t("Channel.revise.retract.confirm", { seq }))) return;
    setMessageActionBusySeq(seq);
    setMessageActionError(null);
    reviseMessage(slug, seq, "retract")
      .then(({ message }) => {
        dispatch({ type: "frame", frame: message });
        if (editingSeq === seq) {
          setEditingSeq(null);
          setEditDraft("");
          setEditSaving(false);
        }
        setReplyTo((current) => (current === seq ? null : current));
      })
      .catch((err: unknown) => {
        if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
        else if (err instanceof ForbiddenError) setMessageActionError({ seq, message: t("Channel.revise.retract.forbidden") });
        else setMessageActionError({ seq, message: t("Channel.revise.retract.failed") });
      })
      .finally(() => {
        setMessageActionBusySeq((current) => (current === seq ? null : current));
      });
  }, [editingSeq, messageActionBusySeq, slug, t]);

  const q = search.trim();
  const from = searchFrom.trim();
  const since = nonNegativeInt(searchSince);
  const limit = positiveInt(searchLimit, 100, 1000);
  const searchInputErrorKey =
    q !== "" && since === null ? "Channel.search.error.since" :
    q !== "" && limit === null ? "Channel.search.error.limit" :
    null;
  const searchInputError = searchInputErrorKey === null ? null : t(searchInputErrorKey);
  const knownSenders = [
    ...new Set([
      ...state.participants.map((p) => p.name),
      ...Object.keys(state.presence),
      ...channelRoles.map((role) => role.name),
      ...channelSquads.map((squad) => squad.name),
      ...state.messages.map((m) => m.sender.name),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const senderListId = `senders-${slug}`;
  // seq → 消息：给引用预览用，把 reply_to 解析成完整消息（含发送者/正文/撤回状态）而不止一个编号。
  // 只在已加载窗口内查得到——超出 MESSAGE_CAP 或翻页边界外的历史引用会查不到，MessageCard 侧降级回纯编号。
  const messageBySeq = useMemo(() => new Map(state.messages.map((m) => [m.seq, m])), [state.messages]);
  const recentMessagesByAgent = useMemo(() => {
    const byAgent = new Map<string, MsgFrame[]>();
    for (let index = state.messages.length - 1; index >= 0; index--) {
      const message = state.messages[index]!;
      if (message.sender.kind !== "agent" || message.retracted) continue;
      const recent = byAgent.get(message.sender.name) ?? [];
      if (recent.length >= 3) continue;
      recent.push(message);
      byAgent.set(message.sender.name, recent);
    }
    return byAgent;
  }, [state.messages]);
  const completions = useMemo(() => completionMessages(state.messages), [state.messages]);
  const timelineMessages = completionOnly ? completions : state.messages;
  const visibleMessages = useMemo(() => filterByAgent(timelineMessages, agentFilter), [agentFilter, timelineMessages]);
  const visibleCompletions = useMemo(() => filterByAgent(completions, agentFilter), [agentFilter, completions]);
  const visibleTimeline = useMemo(
    () => completionOnly ? visibleMessages.map((message) => ({ type: "message" as const, message })) : groupTeamMessages(visibleMessages),
    [completionOnly, visibleMessages],
  );
  const threadKeys = useMemo(() => {
    const threads = visibleTimeline.filter((item): item is TeamMessageThread => item.type === "team_thread");
    const identities = reconcileThreadIdentities(threads, threadIdentitiesRef.current);
    threadIdentitiesRef.current = identities;
    return new Map(threads.map((thread, index) => [thread, identities[index]!.key]));
  }, [visibleTimeline]);
  // Geometry-only, idempotent correction before paint. Receipt/font/stream growth
  // follows only an already-bottom reader; an up-scrolled reader keeps their anchor.
  // No delayed second RAF can override a gesture.
  useLayoutEffect(() => {
    const el = streamRef.current;
    if (el === null || pendingAnchorRef.current !== null) return;
    readingAnchorRef.current = stabilizeConversation(el, stickBottom.current, readingAnchorRef.current);
  });
  const visibleSearchHits = useMemo(() => filterByAgent(searchHits, agentFilter), [agentFilter, searchHits]);
  // #339 触顶上翻只挂在 onScroll 上：开 agent 筛选/completionOnly 后内容可能撑不满视口，
  // 元素不可滚动 → scroll 永不触发 → 历史永远加载不出来。这里主动补拉，
  // 每页 prepend 后随 firstSeq/可见条数变化重新评估，直到内容可滚或历史拉尽（loadOlder 自带防重入与终止）。
  useEffect(() => {
    const el = streamRef.current;
    if (el !== null && hasMoreRef.current && !loadingOlderRef.current && el.scrollHeight <= el.clientHeight) loadOlder();
  }, [visibleTimeline.length, firstSeq, loadOlder]);
  const teamSummaries = useMemo(
    () =>
      summarizeTeams({
        presence: state.presence,
        participants: state.participants,
        messages: state.messages,
        now: teamNow,
        memberNames: authoritativeMemberNames,
      }),
    [authoritativeMemberNames, state.messages, state.participants, state.presence, teamNow],
  );
  const hostBoard = useMemo(
    // #204 open_claims / conflicts / blockers 改由任务台账派生：把已加载的 tasks 一并喂进 buildHostBoard。
    // Channel 挂载即拉完整台账，因此 Focus 里的 host actions 不依赖用户先打开 Tasks。
    () => buildHostBoard(slug, Object.values(state.presence), state.messages, tasks, teamNow, { loopGuardActive: state.loopGuard !== null }),
    [slug, state.loopGuard, state.messages, state.presence, tasks, teamNow],
  );

  // #1060 PR B：团队看板模型——presence / 角色 / 任务 / 投递 / 主持 / 血缘 / squad 合成一张成员卡。
  const nowTick = Date.now();
  const teamBoardModel = useMemo(
    () =>
      buildTeamBoard({
        presence: Object.values(state.presence),
        participants: state.participants,
        roles: channelRoles,
        identities: channelIdentities,
        tasks,
        deliveries: Object.values(state.directedDeliveries),
        hostBoard,
        teams: teamSummaries,
        squads: channelSquads,
        memberNames: authoritativeMemberNames,
        now: nowTick,
      }),
    // nowTick 只用于「最近 N 分钟前」这类相对时间，随其它依赖一起刷新即可，不单独驱动重算。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.presence, state.participants, channelRoles, channelIdentities, tasks, state.directedDeliveries, hostBoard, teamSummaries, channelSquads, authoritativeMemberNames],
  );
  const saveTeamRole = useCallback(async (name: string, draft: TeamRoleDraft): Promise<boolean> => {
    const ok = await saveRole(name, { role: draft.role, responsibility: draft.responsibility });
    if (ok && draft.reportsTo !== undefined) setReportsTo(name, draft.reportsTo);
    return ok;
  }, [saveRole, setReportsTo]);
  // #1060 PR C：squad 增删改。members 整体替换；成功后本地列表就地更新，不等下一次拉取。
  const [squadSaving, setSquadSaving] = useState<string | null>(null);
  const [squadError, setSquadError] = useState<string | null>(null);
  const squadWrite = useCallback(async (key: string, run: () => Promise<void>): Promise<boolean> => {
    if (squadSaving !== null) return false;
    setSquadSaving(key);
    setSquadError(null);
    try {
      await run();
      return true;
    } catch (err: unknown) {
      if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
      else if (err instanceof ForbiddenError) setSquadError(t("TeamBoard.squad.forbidden"));
      else if (err instanceof ValidationError) setSquadError(err.message);
      else setSquadError(t("TeamBoard.squad.saveFailed"));
      return false;
    } finally {
      setSquadSaving(null);
    }
  }, [squadSaving, t]);
  const createTeamSquad = useCallback((name: string, draft: TeamSquadDraft) =>
    squadWrite("__new__", async () => {
      const saved = await createSquad(token, slug, name, draft);
      setChannelSquads((current) => [...current.filter((s) => s !== undefined && s.name !== saved.name), saved]);
    }), [squadWrite, token, slug]);
  const updateTeamSquad = useCallback((name: string, draft: TeamSquadDraft) =>
    squadWrite(name, async () => {
      const saved = await updateSquad(token, slug, name, draft);
      setChannelSquads((current) => current.filter((s) => s !== undefined).map((s) => (s.name === saved.name ? saved : s)));
    }), [squadWrite, token, slug]);
  const deleteTeamSquad = useCallback((name: string) =>
    squadWrite(name, async () => {
      await deleteSquad(token, slug, name);
      setChannelSquads((current) => current.filter((s) => s.name !== name));
    }), [squadWrite, token, slug]);
  const reconnectAgent = useMemo(
    () =>
      canMintAgent && accountKey !== null && !state.archived
        ? (name: string) =>
            openJoinGuide({
              name,
              command: `party recover ${slug}`,
              mode: "interactive",
              harness: guessJoinPackHarness(name),
              runner: "codex",
              recover: true,
              token: null,
            })
        : undefined,
    [canMintAgent, accountKey, state.archived, openJoinGuide, slug],
  );
  const identityDisplay = useMemo(
    () =>
      buildIdentityDisplay({
        channelIdentities,
        mentionOptions,
        messages: state.messages,
        participants: state.participants,
        presence: state.presence,
      }),
    [channelIdentities, mentionOptions, state.messages, state.participants, state.presence],
  );
  const displayedChannelIdentities = useMemo(() => channelIdentities.map(identity => ({
    ...identity, display: resolveIdentityPresentation(identity.name, identityDisplay).label,
  })), [channelIdentities, identityDisplay]);
  const agentRoster = useMemo(() => displayedChannelIdentities.filter(identity => identity.kind === 'agent').map(({name,display,connector_type}) => ({name,display,connector_type,role:channelRoles.find(role=>role.name===name)?.responsibility??undefined})), [displayedChannelIdentities,channelRoles]);
  useEffect(()=>{onAgentRoster?.(slug,agentRoster);},[onAgentRoster,slug,agentRoster]);
  useEffect(()=>()=>{onAgentRoster?.(slug,[]);},[onAgentRoster,slug]);

  const activeChannelAdminMembers = useMemo<ChannelAdminMember[]>(() => {
    const names = new Set<string>([
      ...state.participants.map((participant) => participant.name),
      ...Object.keys(state.presence),
      ...channelIdentities.map((identity) => identity.name),
      ...channelRoles.map((role) => role.name),
    ]);
    return [...names]
      .sort((left, right) => left.localeCompare(right))
      .map((name) => {
        const participant = state.participants.find((entry) => entry.name === name);
        const presence = state.presence[name];
        const assignment = channelRoles.find((role) => role.name === name);
        const identity = identityDisplay[name];
        const kind = identity?.kind ?? assignment?.kind ?? presence?.kind ?? participant?.kind ?? "agent";
        const detail = assignment !== undefined
          ? [assignment.role, assignment.responsibility].filter(Boolean).join(" · ")
          : presence?.state ?? null;
        return {
          name,
          display: identity?.display ?? assignment?.display ?? name,
          kind,
          account: identity?.account
            ?? assignment?.account
            ?? presence?.account
            ?? participant?.owner
            ?? null,
          detail,
          canRemove: canModerate && !state.archived && name !== state.self,
        };
      });
  }, [
    canModerate,
    channelIdentities,
    channelRoles,
    identityDisplay,
    state.archived,
    state.participants,
    state.presence,
    state.self,
  ]);
  channelAdminMemberRowsRef.current = new Map(
    activeChannelAdminMembers.map((member) => [member.name, member]),
  );
  const channelAdminMembers = useMemo<ChannelAdminMember[]>(() => {
    const activeNames = new Set(activeChannelAdminMembers.map((member) => member.name));
    const removed = Object.values(removedChannelMemberSnapshots)
      .filter((member) => removedMemberNames.has(member.name) && !activeNames.has(member.name))
      .map((member): ChannelAdminMember => ({
        ...member,
        removed: true,
        canRemove: false,
        canRestore: canModerate && !state.archived,
      }));
    return [...activeChannelAdminMembers, ...removed]
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [
    activeChannelAdminMembers,
    canModerate,
    removedChannelMemberSnapshots,
    removedMemberNames,
    state.archived,
  ]);
  const selectedTeamMember = useMemo(() => {
    if (memberDetailRoute === null) return null;
    const { name } = memberDetailRoute;
    return resolveTeamMemberView({
      name,
      assignment: channelRoles.find((role) => role.name === name) ?? null,
      identity: identityDisplay[name] ?? null,
      presence: state.presence[name] ?? null,
      participant: state.participants.find((participant) => participant.name === name) ?? null,
    });
  }, [channelRoles, identityDisplay, memberDetailRoute, state.participants, state.presence]);
  // 只给「确定是 agent」的 @ 目标算回执：kind 已知 agent 才纳入，未知/人类不标（避免把人误标成待唤醒）。
  const isAgentMention = useMemo(() => {
    const kind = new Map<string, "agent" | "human">();
    for (const p of state.participants) kind.set(p.name, p.kind);
    for (const [name, p] of Object.entries(state.presence)) if (!kind.has(name) && p.kind) kind.set(name, p.kind);
    for (const m of state.messages) if (!kind.has(m.sender.name)) kind.set(m.sender.name, m.sender.kind);
    for (const identity of channelIdentities) if (!kind.has(identity.name) && identity.kind) kind.set(identity.name, identity.kind);
    for (const role of channelRoles) if (!kind.has(role.name) && role.kind) kind.set(role.name, role.kind);
    return (name: string): boolean => kind.get(name) === "agent";
  }, [channelIdentities, channelRoles, state.participants, state.presence, state.messages]);
  // 发送后回执：seq → 每个被 @ 的 agent 目标的状态（已回复/已唤醒/唤醒失败/在线已送达/待唤醒/待重连）。
  const receiptsBySeq = useMemo(
    () =>
      buildReceipts(
        state.messages,
        wakeDeliveries,
        new Set(state.participants.map((p) => p.name)),
        state.presence,
        teamNow,
        isAgentMention,
      ),
    [state.messages, wakeDeliveries, state.participants, state.presence, teamNow, isAgentMention],
  );
  // 可靠投递协议的服务端真值：按原消息 seq 分组，目标名排序保证卡片 props 稳定且展示顺序可预测。
  const deliveriesBySeq = useMemo(() => {
    const grouped = new Map<number, PublicDirectedDelivery[]>();
    for (const delivery of Object.values(state.directedDeliveries)) {
      const current = grouped.get(delivery.message_seq);
      if (current === undefined) grouped.set(delivery.message_seq, [delivery]);
      else current.push(delivery);
    }
    for (const deliveries of grouped.values()) {
      deliveries.sort((left, right) => left.target_name.localeCompare(right.target_name) || left.id.localeCompare(right.id));
    }
    return grouped;
  }, [state.directedDeliveries]);
  // 发送前状态条：草稿里已 @ 的、且在频道里认得的目标 + 当前存活档位。
  const draftMentionStatuses = useMemo<DraftMentionStatus[]>(() => {
    // 以补全菜单的最终结果为唯一身份集合：消息 sender、handle 与 squad 都不会再和状态条各算一套。
    const known = new Map(mentionOptions.map((candidate) => [candidate.name, candidate]));
    return parseDraftMentions(draft, mentionNames)
      .filter((name) => known.has(name) && name !== state.self)
      .map((name) => {
        const candidate = known.get(name)!;
        return { name, display: candidate.display, tier: candidate.tier, wakeKind: candidate.wakeKind ?? null };
      });
  }, [draft, mentionNames, mentionOptions, state.self]);
  // 轮询 @ 唤醒台账（仅 webhook 侧有行；serve/watch 靠 presence + 回复链接补齐）。用 ref 保持 7s 稳定
  // 间隔，不因每条新消息重挂定时器；标签页隐藏或频道无 agent @ 时跳过，端点失败也不影响其余回执渲染。
  const messagesRef = useRef(state.messages);
  messagesRef.current = state.messages;
  const isAgentMentionRef = useRef(isAgentMention);
  isAgentMentionRef.current = isAgentMention;
  useEffect(() => {
    if (shareMode) return;
    let alive = true;
    const poll = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const msgs = messagesRef.current;
      const hasAgentMention = msgs.some(
        (m) => m.kind === "message" && !m.retracted && m.mentions.some(isAgentMentionRef.current),
      );
      if (!hasAgentMention) return;
      const since = Math.max(0, (msgs[0]?.seq ?? 1) - 1);
      fetchWakeDeliveries(token, slug, { since, limit: 100 })
        .then((d) => {
          if (alive) setWakeDeliveries(d);
        })
        .catch(() => {
          /* 台账拉取失败不致命：回执仍能从 presence + 客户端回复链接渲染 */
        });
    };
    poll();
    const id = window.setInterval(poll, 7000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [token, slug, shareMode]);
  const agentFilterActive = agentFilter.agents.length > 0 || agentFilter.kind !== null;
  const totalInView = q === "" ? timelineMessages.length : searchHits.length;
  const visibleInView = q === "" ? visibleMessages.length : visibleSearchHits.length;
  // Team 的「正式分工」角标只数 channel_roles；presence 自报留作待确认 claim。
  const structuredRoleCount = channelRoles.length;
  const channelRolesByName = useMemo(
    () => Object.fromEntries(channelRoles.map((role) => [role.name, role])),
    [channelRoles],
  );
  // 公告摘要只从正式 channel_roles 派生。presence 自报不得写成频道正式分工。
  const charterDivisionSummary = formatAgentRoleSummary(
    channelRoles.map((role) => ({
      name: role.name,
      display: identityDisplay[role.name]?.display ?? role.display ?? role.name,
      kind: role.kind ?? identityDisplay[role.name]?.kind ?? state.presence[role.name]?.kind,
      role: role.role,
    })),
  );
  const taskOpenCount = taskSummary?.open ?? tasks.filter((task) => task.state !== "done").length;
  const taskReviewCount = taskSummary?.needs_review ?? tasks.filter((task) => task.state === "needs_review").length;
  const taskBlockedCount = taskSummary?.blocked ?? tasks.filter((task) => task.state === "blocked").length;
  const taskMineCount = taskSummary?.mine ?? 0;
  const memberOnlineNames = useMemo(
    () => teamMemberOnlineNames(Object.values(state.presence), state.participants),
    [state.participants, state.presence],
  );
  const hostCandidates = useMemo<HostCandidate[]>(
    () => activeChannelAdminMembers
      .filter((member) => member.kind === "agent" && member.name !== "system")
      .map((member) => buildHostCandidate(
        member,
        identityDisplay,
        memberOnlineNames.has(member.name),
      )),
    [activeChannelAdminMembers, identityDisplay, memberOnlineNames],
  );
  const teamIdentityStats = useMemo(() => {
    const byName = new Map<string, {
      name: string;
      kind: Sender["kind"];
      account: string | null;
      display: string;
    }>();
    for (const participant of state.participants) {
      byName.set(participant.name, {
        name: participant.name,
        kind: participant.kind,
        account: participant.owner ?? null,
        display: participant.display_name ?? participant.handle ?? participant.name,
      });
    }
    for (const entry of Object.values(state.presence)) {
      byName.set(entry.name, {
        name: entry.name,
        kind: entry.kind ?? byName.get(entry.name)?.kind ?? "agent",
        account: entry.account ?? byName.get(entry.name)?.account ?? null,
        display: identityDisplay[entry.name]?.display ?? byName.get(entry.name)?.display ?? entry.name,
      });
    }
    for (const identity of channelIdentities) {
      byName.set(identity.name, {
        name: identity.name,
        kind: identity.kind ?? byName.get(identity.name)?.kind ?? "agent",
        account: identity.account ?? byName.get(identity.name)?.account ?? null,
        display: identity.display,
      });
    }
    const people = new Map<string, boolean>();
    const agents = new Map<string, boolean>();
    for (const member of byName.values()) {
      if (member.name === "system") continue;
      const online = memberOnlineNames.has(member.name);
      if (member.kind === "human") {
        const key = member.account ?? member.display ?? member.name;
        people.set(key, (people.get(key) ?? false) || online);
      } else {
        agents.set(member.name, online);
      }
    }
    const online = [...people.values(), ...agents.values()].filter(Boolean).length;
    const total = people.size + agents.size;
    return { people: people.size, agents: agents.size, online, offline: total - online };
  }, [channelIdentities, identityDisplay, memberOnlineNames, state.participants, state.presence]);
  const onlineMemberCount = teamIdentityStats.online;
  // Team 头部和 Members 列表必须使用同一口径：presence 自报是「待确认」，不能再次
  // 计入「未认领」。此前这里传空 selfRoles，实机会把 3 个待确认 + 10 个未分工显示成
  // 13 个未认领，而 Members 折叠区仍是 10。
  // 频道常驻焦点栏（#682）：跨成员把任务台账 + presence/status + 未闭合决策聚成「球在谁手里」。
  // teamNow 已每秒推进（团队面板复用），焦点的 staleness/时间判定跟着刷新，无需另起计时器。
  const channelFocus = useMemo(
    () => computeChannelFocus({
      presence: Object.values(state.presence),
      tasks,
      decisions: pendingDecisionData ?? [],
      viewer: { name: state.self, account: accountKey, canModerate },
      now: teamNow,
    }),
    [state.presence, state.self, tasks, pendingDecisionData, accountKey, canModerate, teamNow],
  );
  const pendingDecisionLoadState = useMemo(() => ({
    lastSuccessfulData: pendingDecisionData,
    loading: pendingDecisionsLoading,
    error: pendingDecisionsError,
  }), [pendingDecisionData, pendingDecisionsError, pendingDecisionsLoading]);

  const setAgentMode = useCallback((mode: AgentFilterMode) => {
    setAgentFilter((current) => ({ ...current, mode }));
  }, []);

  const toggleAgentFilter = useCallback((agent: string) => {
    setAgentFilter((current) => toggleAgent(current, agent));
  }, []);

  const setAgentKind = useCallback((kind: AgentFilterKind) => {
    setAgentFilter((current) => setKind(current, kind));
  }, []);

  const clearAgentFilter = useCallback(() => {
    setAgentFilter((current) => ({ ...current, agents: [], kind: null }));
  }, []);

  const revealMessage = useCallback((
    target: MsgFrame,
    request: number,
    desiredCompletionOnly = false,
  ): Promise<boolean> => {
    if (request !== messageNavigationRequestRef.current) return Promise.resolve(false);
    const plan = planLoadedMessageNavigation({
      messages: [target],
      seq: target.seq,
      agentFilter,
      completionOnly,
      desiredCompletionOnly,
    });
    if (!plan.found) return Promise.resolve(false);
    if (plan.preserveCurrentView) {
      setMessageViewRestore((current) => current ?? { completionOnly, agentFilter });
    }
    if (plan.clearAgentFilter) {
      setAgentFilter((current) => ({ ...current, agents: [], kind: null }));
    }
    if (plan.changeCompletionView) setCompletionOnly(desiredCompletionOnly);
    setMessageNavigationError(null);
    setMessageNavigationAnnouncement("");
    return new Promise<boolean>((resolve) => {
      const previous = messageNavigationCompletionRef.current;
      messageNavigationCompletionRef.current = null;
      previous?.resolve(false);
      messageNavigationCompletionRef.current = { request, resolve };
      setPendingMessageJump({ seq: target.seq, sender: target.sender.name, request });
    });
  }, [agentFilter, completionOnly]);

  const navigateToMessage = useCallback(async (
    seq: number,
    desiredCompletionOnly = false,
  ): Promise<boolean> => {
    const request = ++messageNavigationRequestRef.current;
    cancelPendingMessageNavigation();
    setMessageNavigationError(null);
    try {
      const resolved = await resolveMessageNavigationTarget({
        messages: state.messages,
        seq,
        loadAround: (targetSeq) => fetchMessages(token, slug, {
          around: targetSeq,
          limit: PAGE_SIZE,
        }),
      });
      if (request !== messageNavigationRequestRef.current) return false;
      if (resolved === null) {
        setMessageNavigationError(t("Channel.navigation.notLoaded", { seq: String(seq) }));
        return false;
      }
      for (const message of resolved.messagesToMerge) {
        dispatch({ type: "frame", frame: message });
      }
      return await revealMessage(resolved.target, request, desiredCompletionOnly);
    } catch (error) {
      if (request !== messageNavigationRequestRef.current) return false;
      if (error instanceof AuthError) {
        authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
      } else if (error instanceof ForbiddenError) {
        dispatch({ type: "fatal", reason: "forbidden" });
      } else {
        setMessageNavigationError(t("Channel.navigation.loadFailed", { seq: String(seq) }));
      }
      return false;
    }
  }, [cancelPendingMessageNavigation, revealMessage, slug, state.messages, t, token]);

  useEffect(() => {
    if (pendingMessageJump === null) return;
    const jump = pendingMessageJump;
    let attempts = 0;
    let frame = 0;
    const finish = (located: boolean) => {
      setPendingMessageJump((current) => current?.request === jump.request ? null : current);
      settleMessageNavigation(jump.request, located);
    };
    const locate = () => {
      if (jump.request !== messageNavigationRequestRef.current) {
        finish(false);
        return;
      }
      const element = document.getElementById(`msg-${jump.seq}`);
      if (element === null && attempts < 1) {
        attempts += 1;
        frame = window.requestAnimationFrame(locate);
        return;
      }
      if (element === null) {
        setMessageNavigationError(t("Channel.navigation.renderFailed", { seq: String(jump.seq) }));
        finish(false);
        return;
      }
      let focused = false;
      focusMessageNavigationTarget(
        element,
        () => {
          focused = document.activeElement === element;
          if (focused) {
            setMessageNavigationAnnouncement(t("Channel.navigation.arrived", {
              seq: String(jump.seq),
              sender: jump.sender,
            }));
          }
        },
        (callback, delayMs) => window.setTimeout(callback, delayMs),
      );
      if (!focused) {
        setMessageNavigationError(t("Channel.navigation.renderFailed", { seq: String(jump.seq) }));
      }
      finish(focused);
    };
    frame = window.requestAnimationFrame(locate);
    return () => window.cancelAnimationFrame(frame);
  }, [pendingMessageJump, settleMessageNavigation, t, visibleMessages]);

  const restoreMessageView = useCallback(() => {
    if (messageViewRestore === null) return;
    setCompletionOnly(messageViewRestore.completionOnly);
    setAgentFilter(messageViewRestore.agentFilter);
    setMessageViewRestore(null);
  }, [messageViewRestore]);

  const jumpToMention = useCallback(async (seq: number): Promise<boolean> => {
    const located = await navigateToMessage(seq);
    if (located) {
      setToasts((current) => current.filter((toast) => toast.seq !== seq));
    }
    return located;
  }, [navigateToMessage]);

  const jumpToCompletion = useCallback(async (seq: number): Promise<boolean> => {
    const located = await navigateToMessage(seq, true);
    if (located) setSearch("");
    return located;
  }, [navigateToMessage]);

  // 所有入口（Search / mention / Focus decision / completion）统一走有锚历史解析。
  // Promise 只在目标 DOM 真正拿到焦点后才返回 true；失败则保留调用入口供重试。
  const jumpToSearchHit = useCallback(async (seq: number): Promise<boolean> => {
    const located = await navigateToMessage(seq);
    if (located) {
      setSearch("");
      if (activePanel === "search") skipPanelFocusRestoreRef.current = true;
    }
    return located;
  }, [activePanel, navigateToMessage]);

  const memberDetailContent = selectedTeamMember === null ? null : (
    <AgentDetailPanel
      name={selectedTeamMember.name}
      display={selectedTeamMember.display}
      kind={selectedTeamMember.kind}
      owner={selectedTeamMember.owner}
      online={selectedTeamMember.runtime.online}
      presence={selectedTeamMember.runtime.presence}
      messages={state.messages}
      tasks={tasks}
      liveSession={state.liveSessions[selectedTeamMember.name] ?? null}
      onOpenLiveSession={openLiveSession}
      onOpenTask={openFocusedTask}
      onOpenMessage={async (seq) => {
        const located = await navigateToMessage(seq);
        if (located) {
          skipPanelFocusRestoreRef.current = true;
          closeChannelPanel();
        }
      }}
      assignment={{
        role: selectedTeamMember.role.role,
        responsibility: selectedTeamMember.role.responsibility,
        reportsTo: selectedTeamMember.role.reportsTo,
        source:
          selectedTeamMember.role.source === "channel_roles"
            ? "assigned"
            : selectedTeamMember.role.source === "presence"
              ? "self_reported"
              : "none",
      }}
    />
  );

  useEffect(() => {
    if (q === "") {
      setSearchHits([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
    // #716：纯 seq 号查询走「跳到 #N」直达，不发全文检索——清空旧结果、跳过网络请求（#718 评审）。
    if (seqFromQuery(q) !== null) {
      setSearchHits([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
    if (searchInputErrorKey !== null || since === null || limit === null) {
      setSearchHits([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      searchMessages(
        token,
        slug,
        { query: q, from: from === "" ? undefined : from, since, limit },
        controller.signal,
      )
        .then((hits) => {
          setSearchHits(hits);
          setSearchError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setSearchHits([]);
          if (err instanceof AuthError) authFailedRef.current(tRef.current("Channel.error.tokenRevoked"));
          else if (err instanceof ForbiddenError) dispatch({ type: "fatal", reason: "forbidden" });
          else setSearchError(tRef.current("Channel.search.error.failed"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [from, limit, q, searchInputErrorKey, since, slug, token]);

  // 私有频道拒入（spec §3）：ws 已停止重连，给一条友好红条，不留空白 / 不无限转圈
  if (state.forbidden) {
    return (
      <div className="chan chan--forbidden">
        <p className="banner banner--red" role="alert">
          {t("Channel.forbidden")}
        </p>
      </div>
    );
  }

  const hostBoardAttentionCount =
    hostBoard.recommended_actions.length + hostBoard.conflicts.length;
  const hostBoardVisible =
    hostBoard.hosts.length > 0 || hostBoardAttentionCount > 0;
  const hostBoardSummary = t("ChannelFocusBar.hostSummary", {
    hosts: String(hostBoard.hosts.length),
    attention: String(hostBoardAttentionCount),
  });

  const searchContent = (
    <div className="timeline-tools">
      <ChannelSearchPanel
        search={search}
        query={q}
        searchFrom={searchFrom}
        searchSince={searchSince}
        searchLimit={searchLimit}
        senderListId={senderListId}
        knownSenders={knownSenders}
        identityDisplay={identityDisplay}
        searchLoading={searchLoading}
        searchHits={searchHits}
        visibleSearchHits={visibleSearchHits}
        agentFilterActive={agentFilterActive}
        searchInputError={searchInputError}
        searchError={searchError}
        jumpError={messageNavigationError}
        onSearch={(value) => {
          messageNavigationRequestRef.current += 1;
          cancelPendingMessageNavigation();
          setSearch(value);
          setMessageNavigationError(null);
        }}
        onSearchFrom={setSearchFrom}
        onSearchSince={setSearchSince}
        onSearchLimit={setSearchLimit}
        onClose={closeChannelPanel}
        onJump={jumpToSearchHit}
      />
      <CompletionPanel
        completions={completions}
        visible={visibleCompletions.length}
        enabled={completionOnly}
        showItems={q === ""}
        onToggle={() => setCompletionOnly((current) => !current)}
        onJump={(seq) => {
          void jumpToCompletion(seq).then((located) => {
            if (!located) return;
            skipPanelFocusRestoreRef.current = true;
            closeChannelPanel();
          });
        }}
      />
      {knownSenders.length > 0 && (
        <AgentFilterPanel
          senders={knownSenders}
          identityDisplay={identityDisplay}
          filter={agentFilter}
          visible={visibleInView}
          total={totalInView}
          onMode={setAgentMode}
          onToggle={toggleAgentFilter}
          onKind={setAgentKind}
          onClear={clearAgentFilter}
        />
      )}
    </div>
  );

  return (
    <div className="chan">
      <ConversationHeader title={title?.trim()||slug} members={displayedChannelIdentities}
        onDetails={()=>setDetailsOpen(true)} connectionStatus={state.status}
        attentionCount={toasts.length} onAttention={()=>{const latest=toasts[toasts.length-1];if(latest)jumpToMention(latest.seq);}}
        visibility={localVisibility}
        onOpenTasks={() => openPanel("tasks")}
        taskOpenCount={taskOpenCount}
        taskAttentionCount={taskReviewCount + taskBlockedCount}
        onOpenTeam={() => openPanel("team")}
        onOpenCollaboration={() => openPanel("collaboration")}
        onOpenSearch={() => openPanel("search")}
        searchActive={q !== "" || agentFilterActive || completionOnly}
        onAddAgent={canMintAgent&&accountKey!==null&&!state.archived?()=>setAdminSurface("agentJoin",true):undefined}/>
      {(channelFocus.waitingOnMe.length > 0 || hostBoardAttentionCount > 0) && (
        <div className="channel-attention-strip">
          <ChannelFocusBar
            displayOf={name => resolveIdentityPresentation(name, identityDisplay).label}
            focus={channelFocus}
            decisionState={pendingDecisionLoadState}
            supplementalOverview={hostBoardVisible ? {
              label: hostBoardSummary,
              attention: hostBoardAttentionCount > 0,
            } : undefined}
            viewerIsModerator={canModerate}
            onOpenTask={openFocusedTask}
            onJumpSeq={jumpToMention}
            onOpenOverview={() => openPanel("focus")}
            onRetryDecisions={() => void refreshPendingDecisions()}
          />
        </div>
      )}
      <ConversationDetails suspended={detailsRosterOpen} open={detailsOpen} onClose={()=>setDetailsOpen(false)} restoreFocus={activePanel===null&&activeAdminSurface===null}>
      <PresenceBar
        onRosterOpenChange={setDetailsRosterOpen}
        attentionCount={hostBoardAttentionCount}
        identities={identityDisplay}
        rosterIdentities={channelIdentities}
        authoritativeNames={authoritativeMemberNames}
        presence={state.presence}
        participants={state.participants}
        status={state.status}
        party={mode === "party" || state.mode === "party"}
        isPublic={localPublic}
        publicWatch={localWatch}
        canModerate={canModerate}
        pausingName={pausingName}
        // #1070：名单里直接踢人/踢 agent——之前这个能力只藏在「管理」面板里。
        onRemoveParticipant={canModerate && !state.archived ? removeParticipant : undefined}
        removingName={removingName}
        removeError={removeError}
        onPauseAgent={pauseAgentReception}
        onResumeAgent={resumeAgentReception}
        roles={channelRoles}
        onOpenAgentDetail={openTeamMember}
        liveSessions={state.liveSessions}
        onOpenLiveSession={openLiveSession}
        ocsRosters={state.ocsRosters}
        onMentionAgent={canWrite ? mentionFromRoster : undefined}
        // 模块②（#1047）：名单里叫不到的 agent 旁的「接回」→ 一条命令的重连引导（同凭证面板的「重新接上」）。
        onReconnect={
          canMintAgent && accountKey !== null && !state.archived
            ? (name) =>
                openJoinGuide({
                  name,
                  command: `party recover ${slug}`,
                  mode: "interactive",
                  harness: guessJoinPackHarness(name),
                  runner: "codex",
                  recover: true,
                  token: null,
                })
            : undefined
        }
        focus={
          <ChannelFocusBar
            displayOf={name => resolveIdentityPresentation(name, identityDisplay).label}
            focus={channelFocus}
            decisionState={pendingDecisionLoadState}
            supplementalOverview={hostBoardVisible ? {
              label: hostBoardSummary,
              attention: hostBoardAttentionCount > 0,
            } : undefined}
            viewerIsModerator={canModerate}
            onOpenTask={openFocusedTask}
            onJumpSeq={jumpToMention}
            onOpenOverview={() => openPanel("focus")}
            onRetryDecisions={() => void refreshPendingDecisions()}
          />
        }
      />
      <ConversationTools
        buttons={
          <>
          <button
            type="button"
            className={"d-btn chan-tool-btn" + (charterUpdated ? " chan-tool-btn--updated" : "")}
            onClick={() => openPanel("charter")}
          >
            <StudioIcon name="announcement" />
            <span>{t("Channel.tools.charter")}</span>
            {/* #1044：「版本 0」没有信息量——只有改过（rev>0）才挂版本徽章 */}
            {charter !== null && charter.charter_rev > 0 && <span className="t-mono chan-tool-badge">{t("Channel.charter.rev", { rev: charter.charter_rev })}</span>}
            {charterUpdated && <span className="t-mono chan-tool-badge chan-tool-badge--hot">{t("Channel.tools.updated")}</span>}
          </button>
          {/* Team 只承接成员、正式分工与工作视图；消息筛选/完成记录/Host 告警各回到所属模块。 */}
          <button type="button" className="d-btn chan-tool-btn" onClick={() => openPanel("team")}>
            <StudioIcon name="division" />
            <span>{t("Channel.tools.team")}</span>
            {structuredRoleCount > 0 && (
              <span className="t-mono chan-tool-badge">{t("Channel.team.rolesBadge", { count: String(structuredRoleCount) })}</span>
            )}
            <span className="t-mono chan-tool-badge">{t("Channel.team.onlineBadge", { count: String(onlineMemberCount) })}</span>
          </button>
          <button type="button" className="d-btn chan-tool-btn" onClick={() => openPanel("tasks")}>
            <StudioIcon name="tasks" />
            <span>{t("Channel.tasks.title")}</span>
            <span className="t-mono chan-tool-badge">{taskOpenCount}</span>
            {taskReviewCount > 0 && <span className="t-mono chan-tool-badge chan-tool-badge--hot">{t("Channel.tasks.summary.review", { count: taskReviewCount })}</span>}
            {taskBlockedCount > 0 && <span className="t-mono chan-tool-badge task-strip-summary--blocked">{t("Channel.tasks.summary.blocked", { count: taskBlockedCount })}</span>}
            {taskMineCount > 0 && <span className="t-mono chan-tool-badge">{t("Channel.tasks.summary.mine", { count: taskMineCount })}</span>}
          </button>
          <button
            type="button"
            className={"d-btn chan-tool-btn" + (q !== "" || agentFilterActive || completionOnly ? " is-active" : "")}
            onClick={() => openPanel("search")}
          >
            <StudioIcon name="search" />
            <span>{t("Channel.tools.timeline")}</span>
            {q !== "" && seqFromQuery(q) === null && <span className="t-mono chan-tool-badge">{searchLoading ? "..." : searchHits.length}</span>}
            {(agentFilterActive || completionOnly) && (
              <span className="t-mono chan-tool-badge chan-tool-badge--hot">{t("Channel.tools.active")}</span>
            )}
          </button>
          <button type="button" className="d-btn chan-tool-btn" onClick={() => openPanel("collaboration")}>
            <StudioIcon name="coordination"/><span>{t("Collab.title")}</span>
          </button>
          {/* #700 的「本机 agent」独立入口已并入「我的 agent」(AgentTokens) 面板的本机运行段，此处不再单列。 */}
          </>
        }
        actions={
          <>
          <MentionHeaderNotice
            items={toasts}
            channel={slug}
            identityDisplay={identityDisplay}
            onJump={jumpToMention}
            onDismiss={dismissToast}
          />
          {((canMintAgent && !state.archived) || canModerate) && (
            <div className="chan-admin-actions">
              {canMintAgent && accountKey !== null && !state.archived && (
                <div className="chan-admin-group chan-admin-group--agents">
                  <AgentJoin
                    channelTitle={title?.trim() || slug}
                    slug={slug}
                    token={token}
                    namePrefix={agentNamePrefix}
                    inviterName={inviterName}
                    charter={charter}
                    accountKey={accountKey}
                    active={activeAdminSurface === "agentJoin"}
                    onActiveChange={(open) => setAdminSurface("agentJoin", open)}
                    onBack={panelBackTarget?backChannelPanel:undefined}
                    backLabel={panelBackLabel}
                    guideSession={joinGuideSession}
                    onCloudConnect={provider=>{collaborationViewMemory.current=null;setWorkspaceFiles(false);setCloudConnectTarget(provider);openPanel("collaboration");}}
                  />
                  <AgentTokens
                    slug={slug}
                    token={token}
                    accountKey={accountKey}
                    inviterName={inviterName}
                    charter={charter}
                    onAuthFailed={onAuthFailed}
                    active={activeAdminSurface === "agentTokens"}
                    onActiveChange={(open) => setAdminSurface("agentTokens", open)}
                    onBack={panelBackTarget?backChannelPanel:undefined}
                    backLabel={panelBackLabel}
                    onNicknameSaved={nicknameSaved}
                    focusAgentName={agentManagerTarget}
                    onGuide={openJoinGuide}
                    onOpenConnections={()=>{setWorkspaceFiles(false);setCloudConnectTarget("dot");openPanel("collaboration");}}
                    onlineNames={memberOnlineNames}
                  />
                </div>
              )}
              {canModerate && (
                <div className="chan-admin-group chan-admin-group--channel">
                  <button type="button" className="d-btn chan-tool-btn" onClick={() => openPanel("admin")}>
                    <StudioIcon name="settings" />
                    <span>{t("Channel.tools.manage")}</span>
                    <span className="t-mono chan-tool-badge">
                      {t(`Channel.visibility.${localVisibility}`)}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
          </>
        }
      />
      </ConversationDetails>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={SCREEN_READER_ONLY_STYLE}
      >
        {messageNavigationAnnouncement}
      </span>
      {liveSessionTarget !== null && (
        <LiveSessionModal
          name={liveSessionTarget}
          display={resolveIdentityPresentation(liveSessionTarget, identityDisplay).label}
          session={state.liveSessions[liveSessionTarget] ?? null}
          onClose={closeLiveSession}
          onBack={panelBackTarget?()=>{setLiveSessionTarget(null);backChannelPanel();}:undefined}
          backLabel={panelBackLabel}
        />
      )}

      {kickError !== null && <p className="banner banner--red">{kickError}</p>}
      {pauseError !== null && <p className="banner banner--red">{pauseError}</p>}
      {archiveError !== null && <p className="banner banner--red">{archiveError}</p>}
      {activePanel !== "search" && messageNavigationError !== null && (
        <p className="banner banner--yellow" role="alert">{messageNavigationError}</p>
      )}
      {messageViewRestore !== null && (
        <aside className="banner banner--yellow" aria-live="polite">
          {t("Channel.navigation.filtersRevealed")}{" "}
          <button type="button" className="d-btn" onClick={restoreMessageView}>
            {t("Channel.navigation.restoreFilters")}
          </button>
        </aside>
      )}
      {/* #662：owner 进入/刷新页面时，主动提醒名下跑着过时 CLI 的 agent，引导用接入包升级。
          CTA 打开 AgentJoin 接入面板（复用 join-pack 生成）；只有能铸 agent 的 owner 才挂该面板，
          故 onUpgrade 仅在 canMintAgent && accountKey!=null 时接线，否则退化为纯提醒（无升级按钮）。 */}
      {!state.archived && (
        <OutdatedAgentsNotice
          presence={state.presence}
          accountKey={accountKey}
          onUpgrade={canMintAgent && accountKey !== null ? (agentName) => {
            setAgentManagerTarget(agentName);
            setAdminSurface("agentTokens", true);
          } : undefined}
        />
      )}

      {shouldShowCatchup(catchupDigest) && seenSeq !== null && (
        <CatchupPanel
          digest={catchupDigest}
          seenSeq={seenSeq}
          latestSeq={lastSeq}
          onCaughtUp={onCaughtUp}
          onJump={(seq) => {
            void jumpToMention(seq);
          }}
        />
      )}
      {activePanel !== null && (
        <ChannelPanelModal
          title={
            activePanel === "charter" ? t("Channel.tools.charter") :
            activePanel === "team" ? t("Channel.tools.team") :
            activePanel === "focus" ? t("ChannelFocusBar.overviewTitle") :
            activePanel === "tasks" ? t("Channel.tasks.title") :
            activePanel === "admin" ? t("ChannelAdmin.title") :
            activePanel === "collaboration" ? t("Collab.title") :
            t("Channel.tools.timeline")
          }
          subtitle={
            activePanel === "charter" && charter !== null ? t("Channel.charter.rev", { rev: charter.charter_rev }) :
            activePanel === "team" ? t("Channel.team.subtitle", { roles: String(structuredRoleCount), online: String(onlineMemberCount) }) :
            activePanel === "focus" ? t("ChannelFocusBar.counts", {
              working: channelFocus.counts.working,
              blocked: channelFocus.counts.blocked,
              decision: channelFocus.counts.waitingDecision,
              stalled: channelFocus.counts.stalled,
            }) :
            activePanel === "tasks" ? t("Channel.tasks.subtitle", { open: taskOpenCount, review: taskReviewCount, blocked: taskBlockedCount }) :
            activePanel === "search" && q !== "" && seqFromQuery(q) === null ? t("Channel.search.hits", { count: searchHits.length }) :
            undefined
          }
          onClose={closeChannelPanel}
          onBack={panelBackTarget?backChannelPanel:undefined}
          backLabel={panelBackLabel}
          closeDisabled={activePanel === "team" && roleSaving !== null}
          onEscape={
            memberDetailRoute !== null && memberDetailRoute.source === activePanel
              ? closeMemberDetail
              : activePanel === "team" && roleSaving !== null
                ? () => {}
              : undefined
          }
          shouldRestoreFocus={() => !skipPanelFocusRestoreRef.current}
          hideHeader={activePanel === "team" || activePanel === "tasks"}
        >
          {activePanel === "collaboration" && (
            <Suspense fallback={<p role="status">{t("Collab.loading")}</p>}>
              <CollaborationHub key={`${slug}:${workspaceFiles?"files":"default"}`} token={token} slug={slug} archived={state.archived} onAuthFailed={onAuthFailed}
                initialTab={workspaceFiles?"files":cloudConnectTarget?"bridges":undefined}
                initialProvider={cloudConnectTarget??undefined} viewMemory={collaborationViewMemory} submissionSafety={submissionSafety} dispatchScopeReady={accountKey!==null} />
            </Suspense>
          )}
          {activePanel === "charter" && (
            <CharterBanner
              charter={charter}
              open={true}
              canModerate={canModerate}
              updated={charterUpdated}
              draft={charterDraft}
              saving={charterSaving}
              editing={charterEditing}
              error={charterError}
              lockedOpen
              onToggle={() => {}}
              onDraft={setCharterDraft}
              onEdit={editCharter}
              onCancel={cancelCharterEdit}
              onSave={saveCharter}
              onRetry={() => void loadCharter()}
            />
          )}
          {activePanel === "charter" && charterDivisionSummary !== "" && (
            // #370 点1：分工在公告里单列一块（与公告正文分开），点开跳团队面板看组织树/全貌。
            <section className="charter-division-summary">
              <span className="charter-division-label">{t("Channel.charter.divisionLabel")}</span>
              <span className="t-mono charter-division-text">{charterDivisionSummary}</span>
              <button type="button" className="d-btn charter-division-open" onClick={() => openPanel("team")}>
                {t("Channel.charter.viewTeam")}
              </button>
            </section>
          )}
          {activePanel === "team" && (
            // #1060 PR B：一个看板替代 分工 / 团队 / agent 泳道 / 组织树。点卡片 → 面板内展开成员详情。
            <TeamShell
              onClose={closeChannelPanel}
              closeDisabled={roleSaving !== null}
              detail={memberDetailRoute?.source === "team" ? memberDetailContent : null}
              detailBackLabel={t("Channel.team.member.back")}
              onBackFromDetail={closeMemberDetail}
            >
              <TeamBoard
                model={teamBoardModel}
                now={nowTick}
                canModerate={canModerate}
                roleSaving={roleSaving}
                roleError={roleError}
                onSaveRole={saveTeamRole}
                onDeleteRole={clearRole}
                onOpenAgentDetail={openTeamMember}
                onOpenTask={openFocusedTask}
                onReconnect={reconnectAgent}
                onAssignHost={canModerate && !state.archived ? assignChannelHost : undefined}
                squadSaving={squadSaving}
                squadError={squadError}
                onCreateSquad={canModerate && !state.archived ? createTeamSquad : undefined}
                onUpdateSquad={canModerate && !state.archived ? updateTeamSquad : undefined}
                onDeleteSquad={canModerate && !state.archived ? deleteTeamSquad : undefined}
              />
            </TeamShell>
          )}
          {activePanel === "focus" && (
            <ChannelFocusPanel
              displayOf={name => resolveIdentityPresentation(name, identityDisplay).label}
              focus={channelFocus}
              decisionState={pendingDecisionLoadState}
              jumpError={messageNavigationError}
              onOpenTask={openFocusedTask}
              onRetryDecisions={() => void refreshPendingDecisions()}
              onJumpSeq={async (seq) => {
                const located = await navigateToMessage(seq);
                if (located) {
                  skipPanelFocusRestoreRef.current = true;
                  closeChannelPanel();
                }
                return located;
              }}
            >
              {hostBoardVisible ? (
                <HostBoardPanel
                  board={hostBoard}
                  candidates={hostCandidates}
                  token={token}
                  slug={slug}
                  canAssignHost={canModerate && !state.archived}
                  assigningHost={roleSaving !== null}
                  assignError={hostAssignError}
                  onAssignHost={assignChannelHost}
                />
              ) : null}
            </ChannelFocusPanel>
          )}
          {activePanel === "tasks" && (
            <TaskLedgerPanel
              tasks={tasks}
              loading={tasksLoading}
              error={tasksError}
              canWrite={canWrite}
              busyTaskId={taskActionBusyId}
              actionError={taskActionError}
              creating={taskCreating}
              createError={taskCreateError}
              onRefresh={loadTaskLedger}
              onSetState={setTaskState}
              onAssign={assignTask}
              onReview={reviewTask}
              onCreateTask={createTaskDraft}
              identities={channelIdentities}
              selectedTaskId={selectedTaskId}
              onSelectedTaskDismiss={()=>setSelectedTaskId(null)}
              viewMemory={taskViewMemory}
              onUploadAttachment={canWrite ? (file) => uploadAttachment(token, slug, file) : undefined}
              onOpenMessage={async (seq) => {
                const located = await navigateToMessage(seq);
                if (located) {
                  skipPanelFocusRestoreRef.current = true;
                  closeChannelPanel();
                }
              }}
              onClose={closeChannelPanel}
            />
          )}
          {activePanel === "admin" && (
            <ChannelAdminView
              embeddedHeader
              viewMemory={channelAdminViewMemory}
              channelTitle={title?.trim() || slug}
              slug={slug}
              visibility={localVisibility}
              archived={state.archived}
              capabilities={{
                manageAccess: canModerate,
                manageMembers: canModerate,
                manageSafety: canModerate,
                archive: canModerate,
              }}
              members={channelAdminMembers}
              accessControls={!state.archived
                ? (active) => (
                    <VisibilityToggle
                      active={active}
                      slug={slug}
                      token={token}
                      visibility={localVisibility}
                      onChanged={setLocalVisibility}
                      onAuthFailed={onAuthFailed}
                    />
                  )
                : undefined}
              invitationControls={!state.archived ? (
                <JoinLink
                  embedded
                  slug={slug}
                  token={token}
                  larkDirectoryEnabled={larkDirectoryEnabled}
                  onAuthFailed={onAuthFailed}
                />
              ) : undefined}
              safetyControls={(
                <GuardSettingsPanel
                  canModerate={canModerate}
                  loopEnabled={localLoopGuardEnabled}
                  loopLimit={localLoopGuardLimit}
                  workflowEnabled={localWorkflowGuardEnabled}
                  workflowLimit={localWorkflowGuardLimit}
                  saving={guardSaving}
                  error={guardConfigError}
                  onLoopEnabled={setLocalLoopGuardEnabled}
                  onLoopLimit={setLocalLoopGuardLimit}
                  onWorkflowEnabled={setLocalWorkflowGuardEnabled}
                  onWorkflowLimit={setLocalWorkflowGuardLimit}
                  onSaveLoop={saveLoopGuard}
                  onSaveWorkflow={saveWorkflowGuard}
                  onLoopUnlimited={setLoopUnlimited}
                  onWorkflowUnlimited={setWorkflowUnlimited}
                />
              )}
              removingMember={removingName}
              restoringMember={restoringName}
              memberError={kickError}
              archiving={archiving}
              lifecycleError={archiveError}
              detail={memberDetailRoute?.source === "admin" ? memberDetailContent : null}
              detailBackLabel={t("ChannelAdmin.members.back")}
              onBackFromDetail={closeMemberDetail}
              onOpenMember={openAdminMember}
              onRemoveMember={removeParticipant}
              onRestoreMember={restoreRemovedParticipant}
              onArchive={archiveCurrentChannel}
              onClose={closeChannelPanel}
            />
          )}
          {activePanel === "search" && searchContent}
        </ChannelPanelModal>
      )}
      {/* overflow-anchor:none —— 浏览器原生滚动锚定会和我们手动的 prepend 锚定打架 */}
      <div className="stream transcript" ref={streamRef} onScroll={onScroll} style={{ overflowAnchor: "none" }}>
        <div className="conversation-inner">
        {q === "" && olderStatus === "loading" && (
          <p className="stream-top-note" role="status">{t("Channel.older.loading")}</p>
        )}
        {q === "" && olderStatus === "error" && (
          <p className="stream-top-note stream-top-note--error" role="alert">
            {t("Channel.older.failed")}
            <button
              type="button"
              className="d-btn"
              onClick={() => {
                setOlderStatus("idle");
                loadOlder();
              }}
            >
              {t("Channel.older.retry")}
            </button>
          </p>
        )}
        {q === "" && olderStatus === "end" && bootstrapped && state.messages.length > 0 && (
          <p className="stream-top-note" role="status">{t("Channel.older.end")}</p>
        )}
        {!bootstrapped && q === "" && (
          <div className="stream-skeleton" aria-hidden>
            {[0, 1, 2].map((index) => (
              <div key={index} className="d-card msg-card msg-card--skeleton">
                <div className="msg-skeleton-avatar" />
                <div className="msg-skeleton-lines">
                  <div className="msg-skeleton-line msg-skeleton-line--short" />
                  <div className="msg-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        )}
        {visibleTimeline.map((item) =>
              item.type === "message" ? (
                <MessageCard
                  key={item.message.seq}
                  msg={item.message}
                  self={state.self}
                  identityDisplay={identityDisplay}
                  receipts={receiptsBySeq.get(item.message.seq)}
                  deliveries={deliveriesBySeq.get(item.message.seq)}
                  readCursors={state.readCursors}
                  participants={state.participants}
                  canModerate={canModerate}
                  presence={state.presence}
                  agentRoles={channelRolesByName}
                  recentMessages={recentMessagesByAgent.get(item.message.sender.name) ?? EMPTY_RECENT_MESSAGES}
                  recentMessagesByAgent={recentMessagesByAgent}
                  quotedMessage={item.message.reply_to !== null ? messageBySeq.get(item.message.reply_to) ?? null : null}
                  onReply={startReply}
                  onEdit={startEdit}
                  onRetract={retractMessage}
                  canCreateTask={canWrite}
                  onCreateTask={createTaskFromMessage}
                  onOpenAgentDetail={openTeamMember}
                  onOpenLiveSession={openLiveSession}
                  hasLiveSession={hasLiveSessionFor}
                  canOpenAgentDetail={canOpenTeamMember}
                  editing={editingSeq === item.message.seq}
                  editDraft={editingSeq === item.message.seq ? editDraft : item.message.body}
                  editSaving={editSaving && editingSeq === item.message.seq}
                  actionError={messageActionError?.seq === item.message.seq ? messageActionError.message : null}
                  busy={messageActionBusySeq === item.message.seq}
                  onEditDraftChange={setEditDraft}
                  onEditCancel={cancelEdit}
                  onEditSave={saveEdit}
                  canRespondDecision={canRespondDecision}
                  decisionBusy={decisionBusySeq === item.message.seq}
                  onDecisionRespond={respondToDecision}
                />
              ) : (
                <TeamThread
                  key={threadKeys.get(item)}
                  thread={item}
                  self={state.self}
                  identityDisplay={identityDisplay}
                  receiptsBySeq={receiptsBySeq}
                  deliveriesBySeq={deliveriesBySeq}
                  readCursors={state.readCursors}
                  participants={state.participants}
                  canModerate={canModerate}
                  editingSeq={editingSeq}
                  editDraft={editDraft}
                  editSaving={editSaving}
                  actionError={messageActionError}
                  busySeq={messageActionBusySeq}
                  messageBySeq={messageBySeq}
                  recentMessagesByAgent={recentMessagesByAgent}
                  presence={state.presence}
                  agentRoles={channelRolesByName}
                  onReply={startReply}
                  onEdit={startEdit}
                  onRetract={retractMessage}
                  canCreateTask={canWrite}
                  onCreateTask={createTaskFromMessage}
                  onOpenAgentDetail={openTeamMember}
                  onOpenLiveSession={openLiveSession}
                  hasLiveSession={hasLiveSessionFor}
                  canOpenAgentDetail={canOpenTeamMember}
                  onEditDraftChange={setEditDraft}
                  onEditCancel={cancelEdit}
                  onEditSave={saveEdit}
                />
              ),
            )}
        {bootstrapped && state.messages.length === 0 && (
          <ChannelWelcome onConnect={canMintAgent && accountKey !== null ? ()=>setAdminSurface("agentJoin", true) : undefined}/>
        )}
        {state.messages.length > 0 && visibleMessages.length === 0 && (
          <p className="d-empty" role="status" aria-live="polite">
            {completionOnly ? t("Channel.empty.completionsFiltered") : t("Channel.empty.messagesFiltered")}
          </p>
        )}
        </div>
      </div>
      {state.archived && (
        <p className="banner banner--gray" role="status" aria-live="polite">
          {t("Channel.banner.archived")}
        </p>
      )}
      {historyError !== null && (
        <div className="banner banner--red" role="alert">
          <span>{historyError}</span>
          <button type="button" className="d-btn" onClick={loadInitialPage}>{t("Channel.history.retry")}</button>
        </div>
      )}
      {state.loopGuard !== null && (
        <div className="banner banner--yellow guard-banner" role="alert">
          <span>
            {t("Channel.guard.banner")}
            {guardResetError !== null ? ` · ${guardResetError}` : ""}
          </span>
          {canResetGuard && (
            <button
              className="d-btn guard-reset"
              type="button"
              onClick={onResetGuard}
              disabled={guardResetting}
            >
              <span>{guardResetting ? t("Channel.guard.resetting") : t("Channel.guard.reset")}</span>
            </button>
          )}
        </div>
      )}
      {state.readonly && !state.archived && (
        <JoinRequestBanner
          state={joinRequestStatus === "none" ? "idle" : joinRequestStatus}
          idleText={t("Channel.banner.readonly")}
          reason={joinRequestReason}
          errorMessage={joinRequestError}
          providers={joinAuthProviders}
          onApply={shareMode ? (note) => void onRequestJoin(note) : undefined}
          onRetry={() => void onRefreshJoinRequest()}
          onLogin={onBeginJoinLogin}
          onEnter={() => void onEnterApprovedChannel()}
        />
      )}
      {state.sendError !== null && canWrite && (
        <p className="banner banner--red" role="alert">
          {state.sendError}
        </p>
      )}
      {canWrite && (state.status === "reconnecting" || state.status === "closed") && (
        <p className="banner banner--yellow conn-banner" role="alert">
          {state.status === "closed" ? t("Channel.conn.closed") : t("Channel.conn.reconnecting")}
        </p>
      )}
      {canWrite && (
        <div className="composer-dock">
          {replyTo !== null && (
            <div className="reply-banner">
              <span className="reply-banner-text">{t("Channel.reply.label", { seq: replyTo, preview: replyPreview })}</span>
              <button type="button" className="d-btn reply-banner-dismiss" onClick={cancelReply}>
                {t("Channel.reply.cancel")}
              </button>
            </div>
          )}
          <Composer
            draft={draft}
            setDraft={setDraft}
            onSend={send}
            onEscape={replyTo !== null ? cancelReply : undefined}
            focusRequest={replyTo}
            ready={state.status === "open"}
            candidates={mentionOptions}
            mentionStatuses={draftMentionStatuses}
            attachments={attachments}
            onPickFiles={onPickFiles}
            onRemoveAttachment={onRemoveAttachment}
            uploads={uploads}
            onRetryUpload={onRetryUpload}
            onCancelUpload={onCancelUpload}
          />
        </div>
      )}
    </div>
  );
}
