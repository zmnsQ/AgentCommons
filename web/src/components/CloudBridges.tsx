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

interface Props { submissionSafety?:GrokSubmissionSafety; token:string;slug:string;canManage:boolean;canRun:boolean;initialProvider?:CloudAgentChoice;onProviderChange?(provider:CloudAgentChoice):void;showAuthorizationManagement?:boolean;onConfigureApi?(provider:"hermes"|"manus"):void; }
export function CloudBridges({submissionSafety,token,slug,canManage,canRun,initialProvider,onProviderChange,onConfigureApi,showAuthorizationManagement=true}:Props){
  const t=useT();
  const [selected,setSelected]=useState<CloudAgentChoice|null>(initialProvider??null);
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
  // Dispatch safety scope deliberately outlives token/permission refresh. Store
  // only salted digests + IDs, never prior prompt text or credentials.
  const submissionKey=JSON.stringify([apiBase(),slug]);
  const fallbackSubmission=useRef(createGrokSubmissionSafety(apiBase(),slug));
  if(fallbackSubmission.current.key!==submissionKey)fallbackSubmission.current=createGrokSubmissionSafety(apiBase(),slug);
  const submissionStore=submissionSafety?.key===submissionKey?submissionSafety:fallbackSubmission.current;
  const submissions=useRef(submissionStore);
  submissions.current=submissionStore;
  const busyRequest=useRef<number|null>(null);
  const [busy,setBusy]=useState(false);
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
    setName("Grok Automation");setSecret("");setEndpoint("");setApiKey("");setPrompt("");setError("");setNotice("");
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
      // Read-only status discovery: this is not a WebSocket heartbeat.
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
    if(isActive()){setCue(result.agents);setApiKey("");setNotice(zh?"已找到你的 Cue Agent。复制 ID 后，点击“继续连接 Cue”。":"Found your Cue agents. Copy an ID, then choose Continue with Cue.");}
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
    if(!isActive())return; // scope may change while hashing; no request was sent
    const id=submission.ids.get(digest)??crypto.randomUUID();
    submission.ids.set(digest,id);
    const r=await cloudBridgesApi.sendToGrok(token,slug,{prompt:text,request_id:id});
    if(isActive()){
      setNotice(zh?`投递状态：${automationDeliveryLabel(r.delivery.state,zh)}`:`Delivery: ${automationDeliveryLabel(r.delivery.state,zh)}`);
      // Unknown/submitting is not a safe new submission: retain input and request ID.
      if(r.delivery.state==="submitted"||r.delivery.state==="rejected"){setPrompt("");submission.ids.delete(digest);}
    }
    await reload();
    } finally {
      submission.inFlight=false;
      notifyGrokSubmissionSafety(submission);
      // Releasing transport lock is safe across credential refresh; do not
      // publish the old response, prompt, notice, or error into the new UI.
      if(alive.current&&submissions.current===submission)setBusy(false);
    }
  });};
  return <section className="cloud-bridges" aria-label={zh?"Agent 接入指南":"Agent connection guides"}>
    <h2>{zh?"连接个人 Agent":"Connect a personal agent"}</h2>
    {error&&<p role="alert" className="commons-error">{error}</p>}
    {notice&&<p role="status" className="commons-success">{notice}</p>}
    {canManage && showAuthorizationManagement && <details className="cloud-bridge-card connector-presence-overview" aria-label={t("ConnectorUsage.connectionOverviewTitle")}>
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
    <div className="agent-connect-tabs" aria-label={t("AgentConnect.cloud")}>
      {(["dot","muse","cue","hermes","grok"] as const).map(provider=><button className="d-btn" type="button" key={provider}
        aria-pressed={selected===provider} onClick={()=>{setSelected(provider);onProviderChange?.(provider);}}><ProviderMark provider={provider}/>{t(`AgentConnect.${provider}`)}</button>)}
    </div>
    {selected==="dot"&&<details className="cloud-bridge-card" open={!authorizedAgents?.some(agent=>agent.oauth?.provider==="chatgpt"&&agent.oauth.status==="authorized")}><summary>{t("ConnectorUsage.firstConnection")}</summary><ol className="agent-connect-steps">{[1,2,3,4].map(n=><li key={n}>{t(`AgentConnect.dotStep${n}`).replace(/^\d\. /,"")}</li>)}</ol><a href="https://developers.openai.com/plugins/build/plugins" target="_blank" rel="noopener noreferrer">{t("AgentConnect.dotDocs")}</a></details>}
    {selected==="dot"&&<ChatGptQuickStart key={`${slug}:${token}`} token={token} slug={slug} canManage={canManage} />}
    {showAuthorizationManagement&&(selected==="dot"||selected==="muse")&&<details className="studio-grants-details"><summary>{zh?"已授权连接 · 管理与撤销":"Authorized connections · manage and revoke"}</summary><ConnectorGrants slug={slug} /></details>}
    {selected==="dot"&&<details className="cloud-bridge-card studio-diagnostics">
      <summary>{zh?"事件投递诊断":"Event delivery diagnostics"}</summary>
      {events&&<p>{zh?"有效订阅":"Subscriptions"}: {events.active_subscriptions} · {zh?"待投递":"Queued"}: {events.pending_deliveries}</p>}
      {canRun&&<button type="button" className="d-btn" disabled={busy||!events?.pending_deliveries} onClick={()=>void task(async()=>{
        const r=await cloudBridgesApi.flushEvents(token,slug);
        if(isActive())setNotice(zh?`已检查 ${r.attempted} 个事件，成功送达 ${r.delivered} 个`:`Checked ${r.attempted} events, acknowledged ${r.delivered}`);
        await reload();
      })}>{t("ConnectorUsage.retry")}</button>}
      {events?.pending_deliveries===0&&<p><small>{t("ConnectorUsage.noQueue")}</small></p>}
    </details>}
    {selected==="hermes"&&<article className="cloud-bridge-card">
      <h3>Hermes Agent</h3>
      <p>{zh?"向运行中的 Hermes API Server 发送任务，并将结果同步到本群。":"Send tasks to your running Hermes API Server and synchronize results to this group."}</p>
      <ol><li>{zh?"准备运行中的 Hermes API 服务、地址和凭据。":"Prepare your running Hermes API service, its address and credential."}</li><li>{zh?"下一步填写服务信息，验证后绑定本群。":"Continue to enter service details, then verify and bind this group."}</li><li>{zh?"连接后发送任务，查看进度和回群结果。":"After connecting, send a task and check its progress and returned result."}</li></ol>
      {onConfigureApi&&<button type="button" className="d-btn" onClick={()=>onConfigureApi("hermes")}>{zh?"继续连接 Hermes":"Continue with Hermes"}</button>}
    </article>}
    {selected==="cue"&&<article className="cloud-bridge-card">
      <h3>Manus / Cue · <a href="https://open.manus.ai/docs/v2/agent.list" target="_blank" rel="noreferrer">API v2 ↗</a></h3>
      <p>{zh?"通过 Manus 官方 Agent API 查找你现有的 Cue Agent。API Key 仅用于这次查询，不保存在浏览器或数据库。":"Discover your existing Cue agents through the official Manus Agent API. The API key is used for this one lookup only."}</p>
      {canManage&&<form onSubmit={discover} className="cloud-bridge-form">
        <label>{zh?"Manus API Key":"Manus API key"}<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} required disabled={busy}/></label>
        <button className="d-btn" disabled={busy||!apiKey}>{zh?"查找我的 Cue Agent":"Discover my Cue agents"}</button>
      </form>}
      {cue.length>0&&<ul>{cue.map(agent=><li key={agent.id}><strong>{agent.name}</strong> · <code>{agent.id}</code> <button className="d-btn" type="button" onClick={()=>void navigator.clipboard?.writeText(agent.id)}>{zh?"复制 ID":"Copy ID"}</button></li>)}</ul>}
      {onConfigureApi&&<button type="button" className="d-btn" onClick={()=>onConfigureApi("manus")}>{zh?"继续连接 Cue":"Continue with Cue"}</button>}
      <p><small>{zh?"任务会投递到你的 Cue Agent，请在 Manus / Cue 中查看回复。":"Tasks are sent to your Cue agent. View replies in Manus / Cue."}</small></p>
    </article>}
    {selected==="grok"&&<article className="cloud-bridge-card">
      <h3>Grok · Automation Webhook</h3>
      <p>{zh?"准备 Automation 的 HTTPS 触发地址和签名密钥，请服务器管理员允许该来源。此连接用于投递任务，执行结果请在 Automation 中查看。":"Prepare your Automation HTTPS trigger and signing secret, and ask the server administrator to allow its origin. This connection dispatches tasks; view execution results in Automation."}</p>
      <p>{state?.connection?zh?`配置已保存：${state.connection.name}`:`Configured: ${state.connection.name}`:zh?"尚未绑定":"Not configured"}</p>
      {canManage&&<form onSubmit={saveGrok} className="cloud-bridge-form">
        <label>{zh?"显示名称":"Name"}<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} disabled={busy} required/></label>
        <label>{zh?"Automation HTTPS 触发地址":"Automation HTTPS trigger URL"}<input type="url" value={endpoint} onChange={e=>setEndpoint(e.target.value)} disabled={busy} required/></label>
        <label>{zh?"签名密钥 whsec_…":"Webhook signing secret whsec_…"}<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} disabled={busy} required autoComplete="new-password"/></label>
        <button className="d-btn" disabled={busy||!endpoint||!secret}>{zh?"加密保存连接":"Save encrypted connection"}</button>
      </form>}
      {canRun&&state?.connection&&<form onSubmit={send} className="cloud-bridge-form">
        <label>{zh?"明确投递的任务":"Task to dispatch"}<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={busy} rows={3} required maxLength={12_000}/></label>
        <button className="d-btn" disabled={busy||!prompt.trim()}>{zh?"发送到 Automation":"Send to Automation"}</button>
      </form>}
      {state?.deliveries.slice(0,5).map(d=><p key={d.id}><small>{d.request_id}: {automationDeliveryLabel(d.state,zh)}</small></p>)}
      {canManage&&state?.connection&&<button type="button" className="d-btn" disabled={busy} onClick={()=>void task(async()=>{
        if(!confirm(zh?"取消此群 Grok Automation 绑定？已发送的远程任务不会自动取消。":"Disconnect Grok Automation for this group? In-flight remote work is not cancelled."))return;
        await cloudBridgesApi.disconnectGrok(token,slug);await reload();
      })}>{zh?"断开连接":"Disconnect"}</button>}
    </article>}
    {selected==="muse"&&<MuseCloudPanel key={`${slug}:${token}`} token={token} slug={slug} canManage={canManage}/>}
    {(selected==="dot"||selected==="muse")&&<details className="cloud-bridge-card cloud-bridge-security"><summary><StudioIcon name="chevron-right"/>{t("AgentConnect.security")}</summary>
      <McpSecurityPanel token={token} slug={slug} canManage={canManage} />
    </details>}
  </section>;
}
