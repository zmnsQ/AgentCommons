import {useEffect,useRef,useState} from 'react';
import {useLocale} from '../i18n/locale';
import {apiBase} from '../lib/base';
import {cloudBridgesApi,type McpPolicyResponse} from '../lib/cloudBridgesApi';
import {McpSecurityPanel} from './McpSecurityPanel';

/** Readiness is a read-only policy check, never proof of an external client connection. */
export function McpReadiness({token,slug}:{token:string;slug:string}){
 const {locale}=useLocale(),zh=locale==='zh';
 const [state,setState]=useState<McpPolicyResponse|null>(null),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0),[showSettings,setShowSettings]=useState(false);
 const base=apiBase(),generation=useRef(0);
 useEffect(()=>{
  const id=++generation.current,controller=new AbortController();setState(null);setFailed(false);
  void cloudBridgesApi.security(token,slug,controller.signal).then(value=>{
   if(controller.signal.aborted||id!==generation.current||apiBase()!==base)return;
   if(!value?.policy||typeof value.policy.enabled!=='boolean'||typeof value.policy.owner_mfa_enabled!=='boolean'){setFailed(true);return;}
   setState(value);
  }).catch(()=>{if(!controller.signal.aborted&&id===generation.current&&apiBase()===base)setFailed(true);});
  return()=>controller.abort();
 },[token,slug,base,revision]);
 const ready=!!state?.policy.enabled&&!!state.policy.owner_mfa_enabled;
 return <section className="ac-card mcp-readiness" aria-label={zh?'本群 MCP 前提检查':'Group MCP prerequisites'}>
  <div className="ac-card-head"><div><span className="ac-kicker">READINESS</span><h4>{zh?'先检查本群服务状态':'Check group service readiness first'}</h4></div><span className={`ac-status-pill ${failed?'is-error':state&&ready?'is-ok':''}`}>{failed?(zh?'未知':'Unknown'):!state?(zh?'检查中…':'Checking…'):ready?(zh?'就绪':'Ready'):(zh?'待处理':'Action needed')}</span></div>
  <p className="ac-card-hint">{zh?'生成 Token 不会自动开启 MCP。这里只检查服务侧前提，不代表第三方客户端已连接。':'Creating a Token does not enable MCP. This checks server prerequisites only, not your external client connection.'}</p>
  {!state&&!failed&&<p role="status" className="ac-inline-status">{zh?'正在读取本群设置…':'Reading group settings…'}</p>}
  {failed&&<p role="alert" className="commons-error">{zh?'暂时无法确认本群 MCP 状态；不要据此重复生成 Token。请刷新检查或让群主检查服务权限。':'Could not verify MCP readiness. Do not create another Token to fix this; refresh or ask the owner to check service permissions.'}</p>}
  {state&&<>
   <p role={ready?'status':'alert'} className={ready?'ac-status-note is-ok':'ac-status-note is-warn'}>{ready?(zh?'本群 MCP 读取前提已满足；仍需在客户端验证连接。':'Group MCP read prerequisites are satisfied; verify the connection in your client.'):(zh?'当前还不能通过 MCP 初始化，先处理下列前提；Token 本身不一定失效。':'MCP initialization is currently blocked by the prerequisites below; this does not mean the Token is invalid.')}</p>
   <ul className="ac-status-list">
    <li className={state.policy.enabled?'is-ok':'is-warn'}><span>{zh?'本群 MCP':'Group MCP'}</span><strong>{state.policy.enabled?(zh?'已启用':'enabled'):(zh?'未启用（会返回 403）':'disabled (returns 403)')}</strong></li>
    <li className={state.policy.owner_mfa_enabled?'is-ok':'is-warn'}><span>{zh?'群主二步验证':'Owner two-step verification'}</span><strong>{state.policy.owner_mfa_enabled?(zh?'已启用':'enabled'):(zh?'未启用（会返回 403）':'not enabled (returns 403)')}</strong></li>
   </ul>
   {!ready&&<p className="ac-card-hint">{zh?'请群主完成账户二步验证，再明确开启本群 MCP；读取、写入和事件权限分别控制。这里不会自动替你更改权限。':'The owner must complete account two-step verification and explicitly enable group MCP. Read, write and event access are separate; nothing is enabled automatically here.'}</p>}
   <p className="ac-card-hint">{zh?'保存权限后，点击“重新检查状态”更新结果。':'After saving permissions, choose Recheck readiness to update this result.'}</p>
   <details className="ac-callout-details" onToggle={event=>setShowSettings(event.currentTarget.open)}><summary>{zh?'查看本群 MCP 权限设置':'Review group MCP permissions'}</summary>{showSettings&&<McpSecurityPanel token={token} slug={slug} canManage={state.can_manage}/>}</details>
  </>}
  <button type="button" className="d-btn" onClick={()=>setRevision(v=>v+1)}>{zh?'重新检查状态':'Recheck readiness'}</button>
 </section>;
}
