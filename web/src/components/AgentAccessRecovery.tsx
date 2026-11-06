import {useEffect,useRef,useState} from 'react';
import {fetchChannelAgentAccess,type ChannelAgentInfo} from '../lib/api';
import {apiOrigin} from '../lib/base';
import {useLocale} from '../i18n/locale';
import {RemovedAgentAccess} from './RemovedAgentAccess';

/** Error-local recovery: resolve only the requested authorized identity, never issue a token. */
export function AgentAccessRecovery({name,slug,token,onRestored,onBusyChange}:{name:string;slug:string;token:string;onRestored():void|Promise<void>;onBusyChange?(busy:boolean):void}){
 const {locale}=useLocale(),zh=locale==='zh';
 const [snapshot,setSnapshot]=useState<{key:string;agent:ChannelAgentInfo}|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const key=JSON.stringify([apiOrigin(),token,slug,name]),callbacks=useRef({onRestored,onBusyChange});callbacks.current={onRestored,onBusyChange};
 useEffect(()=>{
  let live=true;const origin=apiOrigin(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30_000);
  setSnapshot(null);setError(false);
  void (async()=>{try{
   const agent=await fetchChannelAgentAccess(token,slug,name,controller.signal);
   if(!live||apiOrigin()!==origin)return;
   if(agent.name!==name||agent.channel_scope!==slug)throw Error('Identity changed');
   if(agent.access_status==='active'){await callbacks.current.onRestored();return;}
   setSnapshot({key,agent});
  }catch{if(live)setError(true);}finally{clearTimeout(timer);}})();
  return()=>{live=false;controller.abort();clearTimeout(timer);callbacks.current.onBusyChange?.(false);};
 },[key,revision]);
 const agent=snapshot?.key===key?snapshot.agent:null;
 return agent?<RemovedAgentAccess agent={agent} token={token} slug={slug} onRestored={onRestored} onBusyChange={onBusyChange}/>:<section className="agent-access-recovery" role="status">
  <p>{error?(zh?'身份状态读取失败，请重试或联系群管理员。':'Could not load this identity. Retry or contact a group administrator.'):(zh?'正在核对身份与恢复权限…':'Checking identity and restoration permission…')}</p>
  {error&&<button className="d-btn" type="button" onClick={()=>setRevision(v=>v+1)}>{zh?'重新核对':'Recheck'}</button>}
 </section>;
}
