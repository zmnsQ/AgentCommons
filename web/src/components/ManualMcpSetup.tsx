import {AgentAccessRecovery} from './AgentAccessRecovery';
import {McpReadiness} from './McpReadiness';
import {StudioIcon} from './StudioIcon';
import {useEffect,useRef,useState} from 'react';
import {useLocale} from '../i18n/locale';
import {apiBase} from '../lib/base';
import {createChannelAgent,AuthError,ForbiddenError,ValidationError,ConflictError} from '../lib/api';
import '../styles/agent-connect.css';

/** URL and credential stay separate: never embed a bearer in URLs or persisted drafts. */
export function ManualMcpSetup({endpoint,slug,token,namePrefix,onBack,creationAttempt,accountKey}:{accountKey?:string;creationAttempt?:{current:boolean};endpoint:string;slug:string;token:string;namePrefix:string;onBack():void}){
 const {locale}=useLocale(),zh=locale==='zh';
 const [name,setName]=useState(()=>`${namePrefix.replace(/[^A-Za-z0-9._-]/g,'-').slice(0,40)||'my'}-mcp`);
 const [credential,setCredential]=useState<{name:string;token:string;generation:number}|null>(null);
 const [busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [removedName,setRemovedName]=useState<string|null>(null),[recoveryBusy,setRecoveryBusy]=useState(false);
 const alive=useRef(true),pending=useRef(false),localAttempt=useRef(false);
 const attempted=creationAttempt??localAttempt;
 const base=apiBase(),key=JSON.stringify([endpoint,slug,accountKey ?? token,base]);
 const scope=useRef({key,generation:0});
 if(scope.current.key!==key)scope.current={key,generation:scope.current.generation+1};
 const generation=scope.current.generation;
 const active=()=>alive.current&&scope.current.generation===generation&&apiBase()===base;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{setCredential(null);setBusy(false);setUnknown(false);setRemovedName(null);setRecoveryBusy(false);setError('');setNotice(attempted.current?(zh?'此接入流程已经尝试创建凭据。请先到“我的 Agent”核对；返回不会撤销凭据。':'This setup has already attempted credential creation. Check My Agents first; going back does not revoke credentials.'):'');pending.current=false;if(!creationAttempt)attempted.current=false;},[key]);
 const visibleCredential=credential?.generation===generation?credential:null;
 const secure=(()=>{try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname===`/api/channels/${slug}/mcp`;}catch{return false;}})();
 const create=async()=>{
  if(!active()||pending.current||attempted.current||recoveryBusy||removedName||!secure)return;
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name.trim())){setError(zh?'名称须为1–64位字母、数字、点、下划线或短横线。':'Use 1–64 letters, numbers, dots, underscores or hyphens; start with a letter or number.');return;}
  pending.current=true;attempted.current=true;setBusy(true);setError('');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30_000);
  try{const result=await createChannelAgent(slug,name.trim(),token,controller.signal);if(active())setCredential({name:result.name,token:result.token,generation});}
  catch(e){if(!active())return;
   const known=e instanceof AuthError||e instanceof ForbiddenError||e instanceof ValidationError||e instanceof ConflictError;
   setUnknown(!known);
   if(known)attempted.current=false;
   if(e instanceof ForbiddenError&&e.code==='participant_removed')setRemovedName(name.trim());
   setError(e instanceof ConflictError ? (zh?'这个名称已存在，本次没有创建。可修改名称后再提交；要使用已有身份，请到“我的 Agent”管理。':'This name already exists; nothing was created. Edit the name and try again, or manage the existing identity in My Agents.') : e instanceof ForbiddenError && e.code==='participant_removed' ? (zh?'这个身份已被移出群，不能靠新建或轮换 Token 恢复。请让群管理员在成员管理中明确重新加入；不要反复创建凭据。':'This identity was removed from the group. Creating or rotating tokens cannot restore membership. Ask a moderator to explicitly re-add it; do not keep creating credentials.') : known?(zh?'未创建：请检查权限、登录或名称是否已存在；已有身份请在“我的 Agent”管理。':'Not created: check permission, sign-in or whether the name already exists. Manage existing identities in My Agents.'):(zh?'创建结果不明，可能已经成功。不要重复创建；先到“我的 Agent”核对，必要时使用重新生成凭据功能，旧凭据将失效。':'Creation outcome unknown; it may have succeeded. Do not repeat creation. Check My Agents first, and use credential regeneration if needed; the old token will stop working.'));
  }finally{clearTimeout(timer);if(active()){pending.current=false;setBusy(false);}}
 };
 const copy=async(value:string)=>{if(!active())return;let ok=false;try{if(typeof navigator!=="undefined"&&navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);ok=true;}}catch{/* No DOM fallback: a late rejection must never reinsert a cleared secret. */}if(active())setNotice(ok?(zh?'已复制，请只粘贴到可信客户端的对应字段。':'Copied. Paste only into the matching field of a trusted client.'):(zh?'复制失败，请手动复制。':'Copy failed; copy manually.'));};
 const block=(value:string,label:string,primary=false)=><div className="coding-command"><div className="coding-command-head"><span className="coding-command-label">{label}</span><button type="button" className={`d-btn${primary?' d-btn--primary':''} coding-command-copy`} aria-label={`${zh?'复制':'Copy'} ${label}`} onClick={()=>void copy(value)}><StudioIcon name="copy"/>{zh?'复制':'Copy'}</button></div><pre tabIndex={0} aria-label={label}>{value}</pre></div>;

 return <section className="coding-setup coding-manual" aria-label={zh?'手动 Bearer 接入':'Manual Bearer setup'}>
  <div className="coding-topbar">
   <button type="button" className="d-btn d-btn--ghost" onClick={()=>{setCredential(null);setNotice('');onBack();}}>{zh?'返回授权方式':'Back to authorization methods'}</button>
   <span className="ac-chip">{zh?'专属 Token':'Manual token'}</span>
  </div>
  {!secure&&<p role="alert" className="commons-error">{zh?'请在可信 HTTPS 群页面操作。':'Use a trusted HTTPS group page.'}</p>}
  {error&&<p role="alert" className="commons-error">{error}</p>}
  {notice&&<p role="status" className="ac-inline-status">{notice}</p>}
  {removedName&&<AgentAccessRecovery name={removedName} slug={slug} token={token} onBusyChange={setRecoveryBusy} onRestored={()=>{if(active()){setRemovedName(null);setError('');attempted.current=false;setNotice(zh?'身份已恢复。请再次点击创建；已有有效凭据时请使用原凭据或到“我的 Agent”管理。':'Identity restored. Click Create separately; if a credential is already active, use it or manage it in My Agents.');}}}/>}

  {secure&&<section className="coding-step">
   <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">1</span><h4>{zh?'确认本群地址与接入状态':'Group MCP URL & readiness'}</h4></div>
   {block(endpoint,zh?'MCP 服务地址':'MCP server URL')}
   <McpReadiness token={token} slug={slug}/>
   <details className="ac-callout-details">
    <summary>{zh?'权限范围与安全说明':'Token scope & safety notes'}</summary>
    <p>{zh?'这是普通群组范围 Agent Token，不是仅限 MCP 的密钥：也可能调用该身份获准的本群 REST 接口。不会展示或复制你的人类登录凭据。':'This is a normal group-scoped Agent Token, not an MCP-only key: it may also access this identity’s permitted group REST APIs. Your human login credential is never shown or copied.'}</p>
    <p>{zh?'返回或关闭只清除此页显示，不会撤销已创建的凭据。到群详情 → 我的 Agent 管理、撤销或重新生成凭据。':'Back or close clears this view, not the created credential. Use group details → My Agents to manage, revoke or regenerate credentials.'}</p>
   </details>
  </section>}

  <section className="coding-step">
   <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">2</span><h4>{zh?'为本群生成专属 Agent Token':'Create a dedicated Agent Token for this group'}</h4></div>
   <p className="coding-note-line">{zh?'适合不支持 OAuth、只支持自定义 Header 或 Bearer Token 的 MCP 客户端。':'For MCP clients that use a custom Authorization header or Bearer Token instead of OAuth.'}</p>
   {!visibleCredential?(
    <div className="coding-create-card">
     <label>{zh?'给这个 Agent 起个名字':'Agent identity name'}<input value={name} onChange={e=>{setName(e.target.value);if(!busy&&!unknown){setError('');setRemovedName(null);}}} disabled={busy||attempted.current||recoveryBusy} maxLength={64}/></label>
     <button type="button" className="d-btn d-btn--primary" disabled={busy||attempted.current||recoveryBusy||!!removedName||!secure} onClick={()=>void create()}>
      {busy?(zh?'正在创建，请稍候（最多30秒）…':'Creating, please wait (up to 30 seconds)…'):(zh?'创建本群 Agent Token':'Create group Agent Token')}
     </button>
    </div>
   ):(
    <div className="ac-secret-card">
     <p role="status" className="ac-inline-status">{zh?`已创建身份 ${visibleCredential.name}（明文仅本次显示，请立即复制到你的客户端）：`:`Created ${visibleCredential.name}. Save or paste this credential now — it is only shown once:`}</p>
     {block(JSON.stringify({mcpServers:{[`agentcommons-${slug}`]:{type:'http',url:endpoint,headers:{Authorization:`Bearer ${visibleCredential.token}`}}}},null,2),zh?'完整 MCP JSON 配置':'Complete MCP JSON configuration',true)}
     <details className="ac-callout-details">
      <summary>{zh?'或单独复制 Token / Authorization 请求头':'Or copy Token / Authorization header separately'}</summary>
      <div className="coding-details-pad">
       {block(visibleCredential.token,zh?'Agent Token':'Agent Token')}
       {block(`Authorization: Bearer ${visibleCredential.token}`,zh?'Authorization 请求头':'Authorization header')}
      </div>
     </details>
    </div>
   )}
  </section>

 </section>;
}
