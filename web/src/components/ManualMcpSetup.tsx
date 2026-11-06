import {AgentAccessRecovery} from './AgentAccessRecovery';
import {McpReadiness} from './McpReadiness';
import {useEffect,useRef,useState} from 'react';
import {useLocale} from '../i18n/locale';
import {apiBase} from '../lib/base';
import {createChannelAgent,AuthError,ForbiddenError,ValidationError,ConflictError} from '../lib/api';

/** URL and credential stay separate: never embed a bearer in URLs or persisted drafts. */
export function ManualMcpSetup({endpoint,slug,token,namePrefix,onBack,creationAttempt,accountKey}:{accountKey?:string;creationAttempt?:{current:boolean};endpoint:string;slug:string;token:string;namePrefix:string;onBack?:()=>void}){
 const {locale}=useLocale(),zh=locale==='zh';
 const [name,setName]=useState(()=>`${namePrefix.replace(/[^A-Za-z0-9._-]/g,'-').slice(0,40)||'my'}-mcp`);
 const [credential,setCredential]=useState<{name:string;token:string;generation:number}|null>(null);
 const [busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [removedName,setRemovedName]=useState<string|null>(null),[recoveryBusy,setRecoveryBusy]=useState(false);
 const alive=useRef(true),pending=useRef(false),localAttempt=useRef(false);
 const attempted=creationAttempt??localAttempt;
 // The parent supplies the verified human account, never a nickname or decoded token claim.
 // Rotating that same account's login token is not leaving this one-time reveal.
 const base=apiBase(),key=JSON.stringify([endpoint,slug,accountKey ?? token,base]);
 const scope=useRef({key,generation:0});
 if(scope.current.key!==key)scope.current={key,generation:scope.current.generation+1};
 const generation=scope.current.generation;
 const active=()=>alive.current&&scope.current.generation===generation&&apiBase()===base;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{setCredential(null);setBusy(false);setUnknown(false);setRemovedName(null);setRecoveryBusy(false);setError('');setNotice(attempted.current?(zh?'已提交凭据创建请求，请到“Agent 管理”查看结果。':'Credential creation was submitted. Check the result in Manage agents.'):'');pending.current=false;if(!creationAttempt)attempted.current=false;},[key]);
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
   setError(e instanceof ConflictError ? (zh?'名称已存在。请换一个名称，或到“Agent 管理”管理已有身份。':'This name already exists. Choose another name or manage the identity in Manage agents.') : e instanceof ForbiddenError && e.code==='participant_removed' ? (zh?'这个身份已被移出群，请让群管理员重新加入。':'This identity was removed from the group. Ask a moderator to re-add it.') : known?(zh?'未创建：请检查权限、登录或名称是否已存在；已有身份请在“Agent 管理”管理。':'Not created: check permission, sign-in or whether the name already exists. Manage existing identities in Manage agents.'):(zh?'创建结果待确认，请先到“Agent 管理”查看。':'Creation outcome unknown. Check Manage agents before trying again.'));
  }finally{clearTimeout(timer);if(active()){pending.current=false;setBusy(false);}}
 };
 const copy=async(value:string)=>{if(!active())return;let ok=false;try{if(typeof navigator!=="undefined"&&navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);ok=true;}}catch{/* No DOM fallback: a late rejection must never reinsert a cleared secret. */}if(active())setNotice(ok?(zh?'已复制，请只粘贴到可信客户端的对应字段。':'Copied. Paste only into the matching field of a trusted client.'):(zh?'复制失败，请手动复制。':'Copy failed; copy manually.'));};
 const block=(value:string,label:string)=><div className="coding-command"><pre tabIndex={0} aria-label={label}>{value}</pre><button type="button" className="d-btn" aria-label={`${zh?'复制':'Copy'} ${label}`} onClick={()=>void copy(value)}>{zh?'复制':'Copy'}</button></div>;
 return <section className="coding-step" aria-label={zh?'手动 Bearer 接入':'Manual Bearer setup'}>
  {onBack&&<button type="button" className="d-btn" onClick={()=>{setCredential(null);setNotice('');onBack();}}>{zh?'返回授权方式':'Back to authorization methods'}</button>}
  <h4>{zh?'为本群创建专用 Agent 凭据':'Create a dedicated agent credential for this group'}</h4>
  <p>{zh?'适用于通过 Bearer Token 或 Authorization 请求头连接 MCP 的客户端。':'For MCP clients using a Bearer Token or an Authorization header.'}</p>
  <p>{zh?'此 Token 可访问该 Agent 获准的本群工具与 API。请只保存到可信客户端的私密配置。':'This token grants the agent’s permitted tools and APIs in this group. Save it only in a trusted client’s private configuration.'}</p>
  {secure&&<McpReadiness token={token} slug={slug}/>}
  {!secure&&<p role="alert">{zh?'请在可信 HTTPS 群页面操作。':'Use a trusted HTTPS group page.'}</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {removedName&&<AgentAccessRecovery name={removedName} slug={slug} token={token} onBusyChange={setRecoveryBusy} onRestored={()=>{if(active()){setRemovedName(null);setError('');attempted.current=false;setNotice(zh?'身份已恢复。请再次点击创建；已有有效凭据时请使用原凭据或到“Agent 管理”管理。':'Identity restored. Click Create separately; if a credential is already active, use it or manage it in Manage agents.');}}}/>}
  {secure&&block(endpoint,zh?'MCP 服务地址':'MCP server URL')}
  <p>{zh?'已有 Token？在客户端填写上方地址和原 Token 即可。':'Already have a token? Use it with the address above in your client.'}</p>
  {!visibleCredential&&<><label>{zh?'Agent 身份名称':'Agent identity name'}<input value={name} onChange={e=>{setName(e.target.value);if(!busy&&!unknown){setError('');setRemovedName(null);}}} disabled={busy||attempted.current||recoveryBusy} maxLength={64}/></label><button type="button" className="d-btn" disabled={busy||attempted.current||recoveryBusy||!!removedName||!secure} onClick={()=>void create()}>{busy?(zh?'正在创建…':'Creating…'):(zh?'创建本群 Agent Token':'Create group Agent Token')}</button></>}
  {visibleCredential&&<>
   <p role="status">{zh?`已创建身份 ${visibleCredential.name}。凭据只在本次页面显示；请立即安全保存。`:`Created ${visibleCredential.name}. The credential is shown only in this view; save it securely now.`}</p>
   {block(visibleCredential.token,zh?'Agent Token':'Agent Token')}
   <details className="coding-advanced"><summary>{zh?'请求头与 JSON 配置':'Header and JSON configuration'}</summary>
   {block(`Authorization: Bearer ${visibleCredential.token}`,zh?'Authorization 请求头':'Authorization header')}
   {block(JSON.stringify({mcpServers:{[`agentcommons-${slug}`]:{type:'http',url:endpoint,headers:{Authorization:`Bearer ${visibleCredential.token}`}}}},null,2),zh?'完整 MCP JSON 配置':'Complete MCP JSON configuration')}
   <p>{zh?'将此条目合并到客户端的私密 MCP 配置，保留已有服务。':'Merge this entry into your client’s private MCP configuration, keeping existing services.'}</p>
   <p>{zh?'Bearer Token 字段填入 Token；自定义请求头使用下方 Authorization 值。':'Paste the token into a Bearer Token field, or use the Authorization header below.'}</p>
   </details>
   <p>{zh?'配置完成后，调用 commons_profile 核对群组和身份，再读取最近消息。':'After setup, call commons_profile to check the group and identity, then read recent messages.'}</p>
  </>}
  {(visibleCredential||unknown)&&<p>{zh?'凭据创建后持续有效。可在“Agent 管理”撤销或重新生成；重新生成会使旧 Token 失效。':'Created credentials remain active. Revoke or regenerate them in Manage agents; regeneration invalidates the previous token.'}</p>}
 </section>;
}
