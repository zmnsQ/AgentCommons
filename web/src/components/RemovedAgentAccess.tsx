import {useEffect,useRef,useState} from 'react';
import {fetchChannelAgentAccess,restoreChannelAgent,type ChannelAgentInfo} from '../lib/api';
import {useLocale} from '../i18n/locale';
import {apiOrigin} from '../lib/base';

/** Explicit moderator action, with readback before any retry. Never issues credentials. */
export function RemovedAgentAccess({agent,token,slug,onRestored,onBusyChange}:{agent:ChannelAgentInfo;token:string;slug:string;onRestored():void|Promise<void>;onBusyChange?(busy:boolean):void}){
 const {locale}=useLocale(),zh=locale==='zh';
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const pending=useRef<number|null>(null),epoch=useRef(0),key=JSON.stringify([token,slug,agent.name,agent.owner,apiOrigin()]);
 const scope=useRef(key);if(scope.current!==key){scope.current=key;epoch.current++;}
 useEffect(()=>{pending.current=null;setBusy(false);setError('');setUncertain(false);},[key]);
 useEffect(()=>()=>{epoch.current++;},[]);
 async function restore(){
  if(pending.current!==null)return;
  pending.current=epoch.current;setBusy(true);onBusyChange?.(true);setError('');
  const version=epoch.current,origin=apiOrigin(),active=()=>version===epoch.current&&origin===apiOrigin();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30_000);
  const read=async()=>{
   const row=await fetchChannelAgentAccess(token,slug,agent.name,controller.signal);
   if(row.name!==agent.name||row.owner!==agent.owner||row.channel_scope!==slug)throw Error('Identity changed');
   return row;
  };
  try{
   const current=await read();if(!active())return;
   if(current.access_status==='active'){setUncertain(false);await onRestored();return;}
   // After an uncertain write, this click only reads status. A later explicit
   // click and fresh confirmation are required before another restore request.
   if(uncertain){setUncertain(false);setError(zh?'该身份仍被移除，可再次确认恢复。':'This identity is still removed. Confirm again to restore it.');return;}
   if(!current.can_restore||!current.removal_epoch){setError(zh?'请有权限的群管理员恢复此身份。':'Ask an authorized moderator to restore this identity.');return;}
   if(!window.confirm(zh?`允许 Agent ${agent.name}（所属账号 ${agent.owner}）重新加入群 ${slug}？`:`Allow Agent ${agent.name} (owner ${agent.owner}) to rejoin group ${slug}?`))return;
   try{await restoreChannelAgent(token,slug,agent.name,current.removal_epoch,controller.signal,agent.owner);}catch{/* Read back even if the response was lost. */}
   const result=await read();if(!active())return;
   if(result.access_status==='active'){setUncertain(false);await onRestored();}
   else setError(zh?'恢复未完成，该身份仍被移除。请检查权限后重试。':'Restoration did not complete. Readback still shows removal; check permissions and try again.');
  }catch{if(active()){setUncertain(true);setError(zh?'恢复状态待确认，请点击“核对恢复状态”。':'Restoration status is unknown. Choose Recheck restoration status.');}}
  finally{clearTimeout(timer);if(pending.current===version)pending.current=null;if(active()){setBusy(false);onBusyChange?.(false);}}
 }
 return <section className="agentmanager-detail-section agentmanager-callout agent-access-recovery" role="status">
  <strong>{zh?'恢复此身份':'Restore this identity'}</strong>
  <p>{zh?`身份：${agent.name}；频道：${slug}`:`Identity: ${agent.name}; group: ${slug}`}</p>
  <p>{zh?'这个身份已被移出本群，恢复成员资格后可继续接入。':'This identity was removed from the group. Restore its membership to reconnect.'}</p>
  {agent.can_restore&&agent.removal_epoch?<button className="d-btn" type="button" disabled={busy} onClick={()=>void restore()}>{busy?(zh?'正在核对…':'Checking…'):uncertain?(zh?'核对恢复状态':'Recheck restoration status'):(zh?'确认重新加入此 Agent':'Re-add this Agent')}</button>:<p>{zh?'请群管理员重新加入此 Agent。':'Ask a group moderator to re-add this agent.'}</p>}
  {agent.credential_revoked&&<p>{zh?'旧凭据已撤销，恢复后请创建新凭据。':'The old credential is revoked. Create a new credential after restoration.'}</p>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
