import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useT} from '../i18n/useT';
import {useLocale} from '../i18n/locale';
import {apiBase} from '../lib/base';
import {copyText} from '../lib/agentTokenVault';
import {cloudBridgesApi,type MuseConnectorState} from '../lib/cloudBridgesApi';
import {StudioIcon,type StudioIconName} from './StudioIcon';
import {PersonalMusePanel} from './PersonalMusePanel';
import {ProviderMark} from './ProviderMark';
import '../i18n/strings/MuseCloud';
import '../styles/muse-cloud.css';
export function MuseCloudPanel({token,slug,canManage}:{token:string;slug:string;canManage:boolean}){
 const t=useT(),{locale}=useLocale();const [state,setState]=useState<MuseConnectorState|null>(null);
 const [method,setMethod]=useState<'mcp'|'gadget'|'personal'|null>(null);
 const [revision,update]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [callback,setCallback]=useState(''),[created,setCreated]=useState<{client_id:string;client_secret:string}|null>(null);
 const epoch=useRef(0),base=apiBase();
 const scope=JSON.stringify([base,slug]),currentScope=useRef(scope);currentScope.current=scope;
 const inFlight=useRef(new Set<string>()),uncertain=useRef(new Set<string>()),revocationTarget=useRef(new Map<string,string>());
 const [blocked,setBlocked]=useState(false);
 const uncertainText=locale==='zh'?'上次变更结果待确认。请检查现有客户端，不要重复创建或撤销。':'The previous change needs confirmation. Inspect existing clients; do not repeat creation or revocation.';
 useEffect(()=>{const n=++epoch.current,abort=new AbortController();setState(null);setCreated(null);setCallback('');setNotice('');setError('');setBusy(inFlight.current.has(scope));setBlocked(uncertain.current.has(scope));
  if(canManage)void cloudBridgesApi.muse(token,slug,abort.signal).then(data=>{if(epoch.current===n&&!abort.signal.aborted&&base===apiBase()){
    setState(data);
    const target=revocationTarget.current.get(scope);
    // A disabled exact client is affirmative revocation evidence. Absence or a
    // new client ID is not proof of what happened to an ambiguous creation.
    if(!inFlight.current.has(scope)&&target&&data.clients.some(client=>client.client_id===target&&client.disabled)){
     uncertain.current.delete(scope);revocationTarget.current.delete(scope);setBlocked(false);
    }
   }})
   .catch(()=>{if(!abort.signal.aborted&&epoch.current===n)setError(t('Muse.error'));});
  return()=>{abort.abort();++epoch.current;};
 },[token,slug,canManage,revision,base,locale]);
 useEffect(()=>{setMethod(null);},[token,slug,base]);
 const copy=async(value:string)=>{const n=epoch.current;try{if(await copyText(value)&&epoch.current===n&&currentScope.current===scope&&base===apiBase())setNotice(t('Muse.copied'));}catch{/* clipboard failure is not a successful copy */}};
 const run=async(action:()=>Promise<void>,mutation=false)=>{
  if(!canManage||currentScope.current!==scope||base!==apiBase()||inFlight.current.has(scope)||(mutation&&uncertain.current.has(scope)))return;
  const n=epoch.current;inFlight.current.add(scope);setBusy(true);setError('');
  if(mutation)uncertain.current.add(scope);
  try{await action();if(epoch.current===n&&base===apiBase()&&mutation){uncertain.current.delete(scope);revocationTarget.current.delete(scope);}}
  catch{if(epoch.current===n)setError(t('Muse.error'));}
  finally{inFlight.current.delete(scope);if(currentScope.current===scope){setBusy(false);setBlocked(uncertain.current.has(scope));}}
 };
 const create=(e:FormEvent)=>{e.preventDefault();if(created||!callback.trim()||!state?.can_configure)return;void run(async()=>{
  const n=epoch.current;const result=await cloudBridgesApi.createMuseClient(token,slug,callback.trim());
  if(epoch.current!==n||base!==apiBase())return;setCreated(result);setCallback('');setNotice(t('Muse.created'));
  const latest=await cloudBridgesApi.muse(token,slug);if(epoch.current===n&&base===apiBase())setState(latest);
 },true);};
 const prompt=locale==='zh'?`使用已授权的 Agent Commons 连接。先调用 party_profile，确认群组是 ${slug}。只读取最近 5 条消息，不发帖、不修改文件、不通知其他智能体；不匹配就停止。`:
  `Use your authorized Agent Commons connector. First call party_profile and verify group ${slug}. Read only the latest 5 messages. Do not post, change files or notify agents; stop on a group mismatch.`;
 const clients=state?.clients.filter(x=>!x.disabled)??[],authorized=state?.native_authorized===true||clients.some(x=>x.active_grants>0);
 const oauthState=state?.native_oauth?.status;
 const oauthText=oauthState==='access_valid'?(locale==='zh'?'授权有效 · 待检查客户端连接':'Authorization valid · check client connection'):
  oauthState==='refresh_required'?(locale==='zh'?'访问凭证已过期 · 等待客户端续期':'Access expired · client refresh required'):
  oauthState==='reauthorization_required'?(locale==='zh'?'授权已过期或不可用 · 需重新授权':'Authorization expired or unusable · reauthorization required'):
  authorized?(locale==='zh'?'已授权 · 待检查连接':'Authorized · check the connection'):
  t(clients.length?'Muse.configured':'Muse.unconfigured');
 const status=(icon:StudioIconName,label:string,text:string)=><div><StudioIcon name={icon}/><div><dt>{label}</dt><dd>{text}</dd></div></div>;
 if(!canManage)return <p className="commons-note">{t('Muse.noManage')}</p>;
 return <section className="muse-connect" aria-label={t('Muse.title')}>
  <header className="muse-connect-heading"><ProviderMark provider="muse"/><div><h3>{t('Muse.title')}</h3><p>{locale==='zh'?'选择适合你的接入方式。':'Choose a connection method.'}</p></div>
   <button type="button" className="d-btn d-btn--ghost" onClick={()=>update(x=>x+1)} aria-label={t('Muse.refresh')} disabled={busy}><StudioIcon name="refresh"/></button></header>
  {!state&&!error&&<p role="status">{t('Muse.loading')}</p>}{error&&<p role="alert" className="commons-error">{error}</p>}
  {blocked&&<p role="alert" className="commons-error">{uncertainText}</p>}
  {notice&&<p role="status" className="muse-notice">{notice}</p>}
  {!method&&<div className="muse-methods" aria-label={locale==='zh'?'选择 Muse 接入方式':'Choose a Muse connection method'}>
   <button type="button" className="muse-method" onClick={()=>setMethod('mcp')}><strong>{locale==='zh'?'MCP 连接器':'MCP connector'}</strong><span>{locale==='zh'?'在 Muse 中读取本群消息并回复。需要 Muse 支持自定义 MCP。':'Read and reply to this group from Muse. Requires custom MCP support.'}</span></button>
   <button type="button" className="muse-method" onClick={()=>setMethod('gadget')}><strong>{locale==='zh'?'Gadget 设备桥接':'Gadget device bridge'}</strong><span>{locale==='zh'?'通过已配对的 Linux / BLE 设备转发群任务。':'Relay group tasks through a paired Linux / BLE device.'}</span></button>
   <button type="button" className="muse-method" onClick={()=>setMethod('personal')}><strong>{t('Muse.personalTitle')}</strong><span>{t('Muse.personalCard')}</span></button>
  </div>}
  {method&&<button className="d-btn muse-method-back" type="button" onClick={()=>setMethod(null)}>{locale==='zh'?'← 更换接入方式':'← Change connection method'}</button>}
  {method==='personal'&&<PersonalMusePanel token={token} slug={slug} canManage={canManage}/>}
  {method==='gadget'&&<section className="muse-gadget-primary" aria-label={locale==='zh'?'Gadget 设备桥接指南':'Gadget device bridge guide'}>
   <h4>{locale==='zh'?'配对设备并连接本群':'Pair a device and connect this group'}</h4>
   <p>{locale==='zh'?'需要 Linux / BLE 桥接设备、运行中的桥接服务和 Muse App。':'Requires a Linux / BLE bridge device, a running bridge service and Muse App.'}</p>
   <ol className="muse-simple-steps"><li><strong>{locale==='zh'?'准备桥接设备':'Prepare the bridge device'}</strong><p>{locale==='zh'?'请管理员准备隔离宿主和本群桥接服务。':'Ask an administrator to prepare an isolated host and the group bridge service.'}</p></li><li><strong>{locale==='zh'?'在 Muse App 配对':'Pair in Muse App'}</strong><p>{locale==='zh'?'打开“设置 → 设备 → Developer mode / 添加设备”，确认设备。凭据保存在设备上。':'Open Settings → Devices → Developer mode / Add Device and confirm the device. Keep credentials on the device.'}</p></li><li><strong>{locale==='zh'?'绑定当前群':'Bind this group'}</strong><p>{locale==='zh'?'由管理员授权本群专用 Agent，并选择哪些消息触发任务。':'Have an administrator authorize this group’s agent and select the messages that trigger tasks.'}</p></li><li><strong>{locale==='zh'?'检查任务与回复':'Check a task and its reply'}</strong><p>{locale==='zh'?'发送一条测试任务，确认 Muse 收到并回复到本群。':'Send a test task and confirm Muse receives it and replies to this group.'}</p></li></ol>
   <details className="muse-technical"><summary>{locale==='zh'?'设备安装与开发者资料':'Device setup and developer documentation'}</summary><p>{t('Muse.gadgetWarning')}</p><a target="_blank" rel="noopener noreferrer" href="https://github.com/facebookincubator/muse-gadget-sdk/tree/main/linux">{locale==='zh'?'官方设备安装与配对说明':'Official device setup and pairing documentation'}</a><br/><a target="_blank" rel="noopener noreferrer" href="https://github.com/zmnsQ/AgentParty/blob/codex/web-design-system/bridges/muse-cloud/README.md">{t('Muse.bridgeDocs')}</a></details>
  </section>}
  {method==='mcp'&&state&&<section className="muse-legacy" aria-label={locale==='zh'?'MCP 工具访问指南':'MCP tool access guide'}><h4>{locale==='zh'?'在 Muse 中添加本群工具':'Add this group’s tools inside Muse'}</h4><p>{locale==='zh'?'将本群添加为 Muse 的自定义 MCP 连接器。实时通知需要 Muse 客户端支持事件订阅。':'Add this group as a custom MCP connector in Muse. Realtime notifications require event subscription support in the Muse client.'}</p>
   <dl className="muse-state-grid">
    {status(authorized?'check':'link',t('Muse.oauth'),oauthText)}

   </dl>
   {state.native_oauth&&<small>{locale==='zh'?'更新于：':'Updated: '}{new Date(state.native_oauth.checked_at).toLocaleString()}</small>}
   <p className="commons-note">{locale==="zh"?"复制本群地址，在 Muse 中添加连接器。":"Copy this group’s address and add a connector in Muse."}</p><div className="muse-endpoint"><label>{t('Muse.endpoint')}<input readOnly value={state.mcp_endpoint} onFocus={e=>e.currentTarget.select()}/></label><button className="d-btn" onClick={()=>void copy(state.mcp_endpoint)}><StudioIcon name="copy"/>{t('Muse.copy')}</button></div>
   <ol className="muse-native-steps"><li>{locale==="zh"?"在 Muse 的自定义连接器设置中填入上方 MCP 地址。":"Enter the MCP address above in Muse’s custom connector settings."}</li><li>{locale==="zh"?"从 Muse 打开授权页，核对群组与权限后允许访问，再返回 Muse。":"Open authorization from Muse, review this group and its permissions, approve access, then return to Muse."}</li></ol>
   <details className="muse-native-client"><summary>{locale==="zh"?"Muse 要求填写 Client ID？":"Does Muse ask for a Client ID?"}</summary><p>{locale==="zh"?"生成本群 Client ID，填入 Muse 后完成登录与授权。":"Generate this group’s Client ID, enter it in Muse, then complete sign-in and authorization."}</p>
   {!state.can_configure?<p>{t('Muse.mfa')} <a href="/auth/security">{t('Muse.security')}</a></p>:state.native_client_id?<div className="muse-endpoint"><label>Client ID<input readOnly value={state.native_client_id} onFocus={e=>e.currentTarget.select()}/></label><button className="d-btn" onClick={()=>void copy(state.native_client_id!)}>{t('Muse.copy')}</button></div>:<button type="button" className="d-btn" disabled={busy} onClick={()=>void run(async()=>{await cloudBridgesApi.createMuseNativeClient(token,slug);update(x=>x+1);})}>{locale==="zh"?"准备 Muse Client ID":"Prepare Muse Client ID"}</button>}
   </details>
   <details className="muse-recovery"><summary>{locale==='zh'?'凭证过期 / Muse 显示「已添加凭证」？':'Credential expired / Muse says “already added”?'}</summary><p>{locale==='zh'?'访问凭证需要由 Muse 续期。遇到过期提示，请先刷新上方状态，再在 Muse 中重新打开授权。':'Access credentials need renewal in Muse. If an expiry message appears, refresh the status above, then reopen authorization in Muse.'}</p><p>{locale==='zh'?'若授权卡打不开，请保留现有连接并联系 Muse 支持；群管理员可检查 OAuth 续期记录。':'If the authorization card will not open, keep the existing connection and contact Muse support. A group administrator can check OAuth renewal records.'}</p></details>
   <details className="muse-native-check" open><summary>{locale==="zh"?"连接后验证（只读）":"Verify the connection (read-only)"}</summary><textarea readOnly value={prompt} rows={4} aria-label={t('Muse.testPrompt')}/><button className="d-btn" onClick={()=>void copy(prompt)}>{t('Muse.copy')}</button></details>
   <details className="muse-technical"><summary>{locale==="zh"?"高级：OAuth 客户端注册与调试":"Advanced OAuth client registration"}</summary><ol className="muse-steps">
    <li><span className="muse-step-index">1</span><div><h4>{t('Muse.step1')}</h4><p>{t('Muse.step1Help')}</p>
     {!state.can_configure?<p className="commons-note">{t('Muse.mfa')} <a href="/auth/security">{t('Muse.security')}</a></p>:
      <form onSubmit={create} className="muse-oauth-form"><label>{t('Muse.callback')}<input type="url" autoComplete="off" value={callback} onChange={e=>setCallback(e.target.value)} required maxLength={1400}/></label>
      <button className="d-btn d-btn--primary" disabled={busy||blocked||!!created||!callback.trim()}><StudioIcon name="key"/>{t('Muse.create')}</button></form>}
     {created&&<div className="muse-secret-once"><strong>{t('Muse.secret')}</strong><p>{t('Muse.secretHint')}</p>
       <label>{t('Muse.client')}<input readOnly value={created.client_id}/></label>
       <label>{t('Muse.secret')}<input type="password" readOnly value={created.client_secret} autoComplete="new-password"/></label>
       <div className="muse-inline-actions"><button className="d-btn" onClick={()=>void copy(created.client_secret)}><StudioIcon name="copy"/>{t('Muse.copy')}</button><button className="d-btn" onClick={()=>setCreated(null)}><StudioIcon name="check"/>{t('Muse.saved')}</button></div>
     </div>}
     <details className="muse-technical"><summary>{t('Muse.authDetails')}</summary><dl>{Object.entries(state.configuration).filter(([,v])=>typeof v==='string').map(([k,v])=><div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></details>
     {clients.map(client=><div className="muse-client-row" key={client.client_id}><div><strong>{client.name}</strong><code>{client.client_id}</code></div><button className="d-btn d-btn--ghost" disabled={busy||blocked} onClick={()=>{
       if(!confirm(t('Muse.revokeConfirm')))return;void run(async()=>{revocationTarget.current.set(scope,client.client_id);const n=epoch.current;await cloudBridgesApi.revokeMuseClient(token,slug,client.client_id);if(epoch.current!==n||base!==apiBase())return;setCreated(null);update(x=>x+1);},true);
     }}><StudioIcon name="unlink"/>{t('Muse.revoke')}</button></div>)}
    </div></li>
    <li><span className="muse-step-index">2</span><div><h4>{t('Muse.step2')}</h4><p>{t('Muse.step2Help')}</p><textarea readOnly value={prompt} rows={3} aria-label={t('Muse.testPrompt')}/><button className="d-btn" onClick={()=>void copy(prompt)}><StudioIcon name="copy"/>{t('Muse.copy')}</button></div></li>
    <li><span className="muse-step-index">3</span><div><h4>{t('Muse.step4')}</h4><p>{t('Muse.step4Help')}</p><div className="muse-inline-actions"><button className="d-btn" disabled={busy} onClick={()=>void run(async()=>{
      const n=epoch.current;const data=await cloudBridgesApi.museReview(token,slug);if(epoch.current!==n||base!==apiBase())return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='agent-commons-muse-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    })}><StudioIcon name="download"/>{t('Muse.download')}</button><a className="d-btn" href="https://platform.muse.ai/login?return_to=%2Fsubmission" target="_blank" rel="noopener noreferrer"><StudioIcon name="external"/>{t('Muse.portal')}</a></div><small>{t('Muse.noFakeApproval')}</small></div></li>
   </ol></details>
   <details className="muse-technical"><summary>{t('Muse.codeSeparate')}</summary><p>{t('Muse.codeHint')}</p><a href="https://github.com/meta-models/muse-code-sdk" target="_blank" rel="noopener noreferrer">Muse Code SDK <StudioIcon name="external" size={14}/></a></details>
  </section>}
 </section>;
}
