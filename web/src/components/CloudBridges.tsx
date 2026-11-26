import {createGrokSubmissionSafety,notifyGrokSubmissionSafety,type GrokSubmissionSafety} from "../lib/grokSubmissionSafety";
import {connectionFailure,automationDeliveryLabel} from "../lib/connectionGuidance";
import {MuseCloudPanel} from "./MuseCloudPanel";
import {ProviderMark} from "./ProviderMark";
import {StudioIcon} from "./StudioIcon";
import "../i18n/strings/Studio";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "../i18n/locale";
import { apiBase } from "../lib/base";
import { listChannelAgents, type ChannelAgentInfo } from "../lib/api";
import { cloudBridgesApi, type CueAgent, type EventBridgeState, type GrokBridgeState } from "../lib/cloudBridgesApi";
import { ConnectorGrants } from "./ConnectorGrants";
import { ChatGptQuickStart } from "./ChatGptQuickStart";
import "../i18n/strings/ConnectorUsage";
import {McpSecurityPanel} from "./McpSecurityPanel";
import {useT} from "../i18n/useT";
import type {CloudAgentChoice} from "./AgentConnectionPicker";
import "../i18n/strings/AgentConnect";
import "../styles/cloud-bridges.css";
import "../styles/agent-connect.css";

interface Props {
  submissionSafety?:GrokSubmissionSafety;
  token:string;
  slug:string;
  canManage:boolean;
  canRun:boolean;
  initialProvider?:CloudAgentChoice;
  focusedProvider?:CloudAgentChoice;
  onBackToPicker?():void;
  onProviderChange?(provider:CloudAgentChoice):void;
  showAuthorizationManagement?:boolean;
  onConfigureApi?(provider:"hermes"|"manus"):void;
}
export function CloudBridges({submissionSafety,token,slug,canManage,canRun,initialProvider,focusedProvider,onBackToPicker,onProviderChange,onConfigureApi,showAuthorizationManagement=true}:Props){
  const t=useT();
  const [selectedState,setSelected]=useState<CloudAgentChoice|null>(focusedProvider??initialProvider??null);
  const selected=focusedProvider??selectedState;
  const focused=focusedProvider!==undefined;
  const {locale}=useLocale();const zh=locale==="zh";
  const [state,setState]=useState<GrokBridgeState|null>(null);
  const [events,setEvents]=useState<EventBridgeState|null>(null);
  const [authorizedAgents,setAuthorizedAgents]=useState<ChannelAgentInfo[]|null>(null);
  const [cue,setCue]=useState<CueAgent[]>([]);
  const [name,setName]=useState("Grok Automation");
  const [endpoint,setEndpoint]=useState("");
  const [secret,setSecret]=useState("");
  const [apiKey,setApiKey]=useState("");
  const [prompt,setPrompt]=useState("");
  const submissionKey=JSON.stringify([apiBase(),slug]);
  const fallbackSubmission=useRef(createGrokSubmissionSafety(apiBase(),slug));
  if(fallbackSubmission.current.key!==submissionKey)fallbackSubmission.current=createGrokSubmissionSafety(apiBase(),slug);
  const submissionStore=submissionSafety?.key===submissionKey?submissionSafety:fallbackSubmission.current;
  const submissions=useRef(submissionStore);
  submissions.current=submissionStore;
  const busyRequest=useRef<number|null>(null);
  const [busy,setBusy]=useState(false);
  const [confirmDisconnect,setConfirmDisconnect]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const alive=useRef(true);
  const base=apiBase();
  const scopeKey=JSON.stringify([token,slug,base,canManage,canRun,submissionStore.salt]);
  const scope=useRef({key:scopeKey,generation:0});
  if(scope.current.key!==scopeKey){
    scope.current={key:scopeKey,generation:scope.current.generation+1};
    busyRequest.current=null;
  }
  const generation=scope.current.generation;
  const isActive=useCallback(()=>alive.current&&scope.current.generation===generation&&apiBase()===base,[generation,base]);
  useEffect(()=>{
    setBusy(submissions.current.inFlight);setState(null);setEvents(null);setAuthorizedAgents(null);setCue([]);
    setName("Grok Automation");setSecret("");setEndpoint("");setApiKey("");setPrompt("");setError("");setNotice("");setConfirmDisconnect(false);
  },[generation]);
  useEffect(()=>{
    const update=()=>setBusy(submissionStore.inFlight||busyRequest.current!==null);
    submissionStore.listeners.add(update);update();
    return()=>{submissionStore.listeners.delete(update);};
  },[submissionStore]);
  const reload=useCallback(async(signal?:AbortSignal)=>{
    if(!isActive())return;
    const [grok,eventState,connections]=await Promise.all([
      cloudBridgesApi.grok(token,slug,signal),
      canManage ? cloudBridgesApi.events(token,slug,signal) : Promise.resolve(null),
      canManage ? listChannelAgents(token,slug).catch(()=>null) : Promise.resolve(null),
    ]);
    if(isActive()&&!signal?.aborted){setState(grok);setEvents(eventState);setAuthorizedAgents(connections);setError("");}
  },[token,slug,canManage,isActive]);
  useEffect(()=>{alive.current=true;const controller=new AbortController();
    void reload(controller.signal).catch(e=>{if(isActive()&&!controller.signal.aborted)setError(connectionFailure(e,zh));});
    return()=>{alive.current=false;controller.abort();};
  },[reload,isActive]);
  const task=async(fn:()=>Promise<void>)=>{
    if(busyRequest.current!==null||submissions.current.inFlight||!isActive())return;
    busyRequest.current=generation;
    setBusy(true);setError("");setNotice("");
    try{await fn();}catch(e){if(isActive())setError(connectionFailure(e,zh));}
    finally{if(isActive()&&busyRequest.current===generation){busyRequest.current=null;setBusy(false);}}
  };
  const saveGrok=(e:FormEvent)=>{e.preventDefault();void task(async()=>{
    if(!canManage)throw new Error("owner_only");
    await cloudBridgesApi.connectGrok(token,slug,{name:name.trim(),endpoint:endpoint.trim(),signing_secret:secret.trim()});
    if(isActive()){setSecret("");setEndpoint("");setNotice(zh?"已保存加密配置":"Encrypted configuration saved");}
    await reload();
  });};
  const discover=(e:FormEvent)=>{e.preventDefault();void task(async()=>{
    if(!canManage)throw new Error("owner_only");
    const result=await cloudBridgesApi.cue(token,slug,apiKey);
    if(isActive()){setCue(result.agents);setApiKey("");setNotice(zh?"已读取你的 Cue Agent，复制 ID 后点击下方按钮完成绑定。":"Retrieved your Cue agents. Copy an ID and click below to bind.");}
  });};
  const send=(e:FormEvent)=>{e.preventDefault();void task(async()=>{
    if(!canRun)throw new Error("human_member_required");
    const text=prompt.trim();
    if(!text)throw new Error("prompt_required");
    const submission=submissions.current;
    if(submission.inFlight)return;
    submission.inFlight=true;
    notifyGrokSubmissionSafety(submission);
    try {
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${submission.salt}\0${text}`)))).map(v=>v.toString(16).padStart(2,"0")).join("");
    if(!isActive())return;
    const id=submission.ids.get(digest)??crypto.randomUUID();
    submission.ids.set(digest,id);
    const r=await cloudBridgesApi.sendToGrok(token,slug,{prompt:text,request_id:id});
    if(isActive()){
      setNotice(zh?`投递状态：${automationDeliveryLabel(r.delivery.state,zh)}（不代表 Bot 已完成）`:`Delivery: ${automationDeliveryLabel(r.delivery.state,zh)} (not proof of Bot completion)`);
      if(r.delivery.state==="submitted"||r.delivery.state==="rejected"){setPrompt("");submission.ids.delete(digest);}
    }
    await reload();
    } finally {
      submission.inFlight=false;
      notifyGrokSubmissionSafety(submission);
      if(alive.current&&submissions.current===submission)setBusy(false);
    }
  });};

  return <section className="cloud-bridges" aria-label={zh?"Agent 接入指南":"Agent connection guides"}>
    {focused?(
      <div className="coding-topbar">
        {onBackToPicker&&<button type="button" className="d-btn d-btn--ghost" onClick={onBackToPicker}><StudioIcon name="arrow-left"/>{zh?"更换平台":"Change platform"}</button>}
        <span className="ac-chip ac-chip--accent">{t(`AgentConnect.${focusedProvider}`)}</span>
      </div>
    ):(
      <>
        <h2>{zh?"选择平台，再按步骤接入":"Choose a platform, then follow its steps"}</h2>
        <p>{zh?"点选平台直接查看连接步骤；查看说明不会自动授权或启动任务。":"Pick a platform to view its setup steps. Viewing a guide never authorizes accounts or starts work."}</p>
      </>
    )}
    {error&&<p role="alert" className="commons-error">{error}</p>}
    {notice&&<p role="status" className="commons-success">{notice}</p>}
    {canManage && showAuthorizationManagement && !focused && <details className="cloud-bridge-card connector-presence-overview" aria-label={t("ConnectorUsage.connectionOverviewTitle")}>
      <summary>{t("ConnectorUsage.connectionOverviewTitle")}</summary>
      <p>{t("ConnectorUsage.connectionOverviewHint")}</p>
      {authorizedAgents===null && <p role="status">{t("ConnectorUsage.connectionStatusUnknown")}</p>}
      {authorizedAgents?.filter(item=>item.credential_kind==="oauth").length===0 && (
        <p>{t("ConnectorUsage.noneConnected")}</p>
      )}
      {authorizedAgents && <dl className="connector-presence-list">
        {authorizedAgents.filter(item=>item.credential_kind==="oauth").map(item=>{
          const count=events?.agents?.find(sub=>sub.agent_name===item.name)?.active_subscriptions;
          const authorized=item.oauth?.status==="authorized";
          return <div key={item.name} className="connector-presence-item">
            <dt>
              <strong>{item.nickname??item.oauth?.client_name??item.name}</strong>
              <code>{item.name}</code>
            </dt>
            <dd>{t(authorized?"ConnectorUsage.authorized":"ConnectorUsage.reconnect")}</dd>
            <dd>{count===undefined
              ?t("ConnectorUsage.unknown")
              :count>0?t("ConnectorUsage.subscribed"):t("ConnectorUsage.notSubscribed")}</dd>
            <dd>{t("ConnectorUsage.notWebsocketPresence")}</dd>
          </div>;
        })}
      </dl>}
    </details>}
    {!focused&&<div className="agent-connect-tabs" aria-label={t("AgentConnect.cloud")}>
      {(["dot","muse","cue","hermes","grok"] as const).map(provider=><button className="d-btn" type="button" key={provider}
        aria-pressed={selected===provider} onClick={()=>{setSelected(provider);setConfirmDisconnect(false);onProviderChange?.(provider);}}><ProviderMark provider={provider}/>{t(`AgentConnect.${provider}`)}</button>)}
    </div>}

    {selected==="dot"&&<>
      <section className="coding-step">
        <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">1</span><h4>{zh?"开启本群外部 MCP 并复制地址":"Enable group MCP & copy endpoint"}</h4></div>
        <McpSecurityPanel token={token} slug={slug} canManage={canManage} />
      </section>
      <section className="coding-step">
        <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">2</span><h4>{zh?"在 ChatGPT 中添加自定义 MCP 并授权":"Add custom MCP in ChatGPT & authorize"}</h4></div>
        <ol className="agent-connect-steps">
          <li>{t("AgentConnect.dotStep2").replace(/^\d\. /,"")}</li>
          <li>{t("AgentConnect.dotStep3").replace(/^\d\. /,"")}</li>
        </ol>
        <div className="cloud-step-actions">
          <a className="d-btn d-btn--primary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">{zh?"打开 ChatGPT ↗":"Open ChatGPT ↗"}</a>
          <a className="d-btn d-btn--ghost" href="https://developers.openai.com/plugins/build/plugins" target="_blank" rel="noopener noreferrer">{t("AgentConnect.dotDocs")}</a>
        </div>
      </section>
      <section className="coding-step">
        <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">3</span><h4>{zh?"授权完成后，测试连接":"Verify after authorizing"}</h4></div>
        <ChatGptQuickStart key={`${slug}:${token}`} token={token} slug={slug} canManage={canManage} />
      </section>
      {showAuthorizationManagement&&<details className="studio-grants-details"><summary>{zh?"已授权连接 · 管理与撤销":"Authorized connections · manage and revoke"}</summary><ConnectorGrants slug={slug} /></details>}
      <details className="cloud-bridge-card studio-diagnostics">
        <summary>{zh?"高级：事件 @ 唤醒订阅与诊断":"Advanced: event wake-ups & diagnostics"}</summary>
        <p>{t("AgentConnect.dotStep4").replace(/^\d\. /,"")}</p>
        {events&&<p>{zh?"有效订阅":"Subscriptions"}: {events.active_subscriptions} · {zh?"待投递":"Queued"}: {events.pending_deliveries}</p>}
        {canRun&&<button type="button" className="d-btn" disabled={busy||!events?.pending_deliveries} onClick={()=>void task(async()=>{
          const r=await cloudBridgesApi.flushEvents(token,slug);
          if(isActive())setNotice(zh?`已检查 ${r.attempted} 个事件，成功送达 ${r.delivered} 个`:`Checked ${r.attempted} events, acknowledged ${r.delivered}`);
          await reload();
        })}>{t("ConnectorUsage.retry")}</button>}
        {events?.pending_deliveries===0&&<p><small>{t("ConnectorUsage.noQueue")}</small></p>}
      </details>
    </>}

    {selected==="hermes"&&<article className="cloud-bridge-card">
      <h3>Hermes Agent</h3>
      <p>{zh?"连接你正在运行的 Hermes API Server，把本群任务直接发给 Hermes 并回传结果。":"Send tasks to your running Hermes API Server and synchronize results back to this group."}</p>
      <ol className="agent-connect-steps">
        <li>{zh?"准备好运行中的 Hermes API Server 地址与 API 凭据。":"Have your running Hermes API Server URL and credential ready."}</li>
        <li>{zh?"点击下方按钮填写服务信息，核验通过后即绑定本群。":"Click below to enter service details, verify, and bind to this group."}</li>
      </ol>
      {onConfigureApi&&<button type="button" className="d-btn d-btn--primary" onClick={()=>onConfigureApi("hermes")}>{zh?"继续连接 Hermes":"Continue with Hermes"}</button>}
    </article>}

    {selected==="cue"&&<article className="cloud-bridge-card">
      <h3>Manus / Cue · <a href="https://open.manus.ai/docs/v2/agent.list" target="_blank" rel="noreferrer">API v2 ↗</a></h3>
      <p>{zh?"第 1 步（可选）：输入 Manus API Key 查找你的 Cue Agent ID；第 2 步：点击下方按钮绑定本群。":"Step 1 (optional): look up your Cue Agent ID via Manus API; Step 2: click below to bind it to this group."}</p>
      {canManage&&<form onSubmit={discover} className="cloud-bridge-form">
        <label>{zh?"Manus API Key（仅用于临时查询，不保存）":"Manus API key (lookup only, not stored)"}<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} required disabled={busy}/></label>
        <button className="d-btn" disabled={busy||!apiKey}>{zh?"查找我的 Cue Agent":"Discover my Cue agents"}</button>
      </form>}
      {cue.length>0&&<ul>{cue.map(agent=><li key={agent.id}><strong>{agent.name}</strong> · <code>{agent.id}</code> <button className="d-btn" type="button" onClick={()=>void navigator.clipboard?.writeText(agent.id)}>{zh?"复制 ID":"Copy ID"}</button></li>)}</ul>}
      {onConfigureApi&&<button type="button" className="d-btn d-btn--primary" onClick={()=>onConfigureApi("manus")}>{zh?"继续连接 Cue":"Continue with Cue"}</button>}
      <p><small>{zh?"向已有个人 Cue 主会话投递任务已支持；不自动导入无法确定归属的私人聊天回复。":"Send to existing Cue main tasks is supported; private replies without reliable request correlation are not imported."}</small></p>
    </article>}

    {selected==="grok"&&<article className="cloud-bridge-card">
      <h3>Grok · Automation Webhook</h3>
      <p className="coding-note-line">{zh?"使用你自己的 Automation HTTPS 触发地址与签名密钥；这不是个人 Grok Bot 登录。":"This uses your own Automation HTTPS trigger and signing secret; it is not a personal Grok Bot login."}</p>
      <details className="ac-callout-details"><summary>{zh?"前提与结果边界":"Prerequisites and result limits"}</summary><p>{zh?"该地址来源需由服务器管理员批准。若账号没有这些能力，请勿填写猜测的地址。保存不验证任务完成，回复也不会自动回群。":"The origin must be approved by the server administrator. If your account lacks these capabilities, do not guess an endpoint. Saving does not verify task completion; replies are not automatically imported."}</p></details>
      <p>{state?.connection?zh?`配置已保存：${state.connection.name}`:`Configured: ${state.connection.name}`:zh?"尚未绑定":"Not configured"}</p>
      {canManage&&<form onSubmit={saveGrok} className="cloud-bridge-form">
        <label>{zh?"显示名称":"Name"}<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} disabled={busy} required/></label>
        <label>{zh?"Automation HTTPS 触发地址":"Automation HTTPS trigger URL"}<input type="url" value={endpoint} onChange={e=>setEndpoint(e.target.value)} disabled={busy} required/></label>
        <label>{zh?"签名密钥 whsec_…":"Webhook signing secret whsec_…"}<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} disabled={busy} required autoComplete="new-password"/></label>
        <button className="d-btn d-btn--primary" disabled={busy||!endpoint||!secret}>{zh?"加密保存连接":"Save encrypted connection"}</button>
      </form>}
      {canRun&&state?.connection&&<form onSubmit={send} className="cloud-bridge-form">
        <label>{zh?"明确投递的任务":"Task to dispatch"}<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={busy} rows={3} required maxLength={12_000}/></label>
        <button className="d-btn d-btn--primary" disabled={busy||!prompt.trim()}>{zh?"发送到 Automation":"Send to Automation"}</button>
      </form>}
      {state?.deliveries.slice(0,5).map(d=><p key={d.id}><small>{d.request_id}: {automationDeliveryLabel(d.state,zh)}</small></p>)}
      {canManage&&state?.connection&&(confirmDisconnect?<div className="commons-confirm"><p>{zh?"取消此群 Grok Automation 绑定？已发送的远程任务不会自动取消。":"Disconnect Grok Automation for this group? In-flight remote work is not cancelled."}</p><div className="commons-actions"><button type="button" className="d-btn d-btn--danger" disabled={busy} onClick={()=>void task(async()=>{await cloudBridgesApi.disconnectGrok(token,slug);if(isActive())setConfirmDisconnect(false);await reload();})}>{busy?(zh?"处理中…":"Working…"):(zh?"确认断开":"Confirm disconnect")}</button><button type="button" className="d-btn" disabled={busy} onClick={()=>setConfirmDisconnect(false)}>{zh?"取消":"Cancel"}</button></div></div>:<button type="button" className="d-btn" disabled={busy} onClick={()=>setConfirmDisconnect(true)}>{zh?"断开连接":"Disconnect"}</button>)}
    </article>}

    {selected==="muse"&&<>
      <MuseCloudPanel key={`${slug}:${token}`} token={token} slug={slug} canManage={canManage}/>
      <details className="cloud-bridge-card"><summary>{t("AgentConnect.security")}</summary>
        <McpSecurityPanel token={token} slug={slug} canManage={canManage} />
      </details>
      {showAuthorizationManagement&&<details className="studio-grants-details"><summary>{zh?"已授权连接 · 管理与撤销":"Authorized connections · manage and revoke"}</summary><ConnectorGrants slug={slug} /></details>}
    </>}
  </section>;
}
