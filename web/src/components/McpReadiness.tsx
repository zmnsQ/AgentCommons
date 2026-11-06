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
 return <section className="commons-note" aria-label={zh?'本群 MCP 前提检查':'Group MCP prerequisites'}>
  <h4>{zh?'本群 MCP 状态':'Group MCP status'}</h4>
  {!state&&!failed&&<p role="status">{zh?'正在读取本群设置…':'Reading group settings…'}</p>}
  {failed&&<p role="alert">{zh?'暂时无法读取本群设置。请刷新重试，或联系群主检查权限。':'Could not verify group settings. Refresh or ask the owner to check permissions.'}</p>}
  {state&&<>
   <p role={ready?'status':'alert'}>{ready?(zh?'本群已允许 MCP 读取，可继续配置客户端。':'MCP reading is enabled for this group. Continue with client setup.'):(zh?'请先完成下方设置，再连接 MCP。':'Complete the settings below before connecting MCP.')}</p>
   <ul>
    <li>{zh?'本群 MCP：':'Group MCP: '}{state.policy.enabled?(zh?'已启用':'enabled'):(zh?'未启用':'disabled')}</li>
    <li>{zh?'群主二步验证：':'Owner two-step verification: '}{state.policy.owner_mfa_enabled?(zh?'已启用':'enabled'):(zh?'未启用':'not enabled')}</li>
   </ul>
   {!ready&&<p>{zh?'请群主启用账户二步验证，并在群权限中开启 MCP。':'Ask the owner to enable account two-step verification and MCP access for this group.'}</p>}
   <details onToggle={event=>{setShowSettings(event.currentTarget.open);if(!event.currentTarget.open)setRevision(v=>v+1);}}><summary>{zh?'查看本群 MCP 权限设置':'Review group MCP permissions'}</summary>{showSettings&&<McpSecurityPanel token={token} slug={slug} canManage={state.can_manage}/>}</details>
  </>}
  <button type="button" className="d-btn" onClick={()=>setRevision(v=>v+1)}>{zh?'重新检查状态':'Recheck readiness'}</button>
 </section>;
}
