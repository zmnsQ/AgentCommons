import {ManualMcpSetup} from "./ManualMcpSetup";
import {AgentCommonsInstall,type InstallOs} from './AgentCommonsInstall';
import {useState,useMemo} from 'react';
import {useLocale} from '../i18n/locale';
import {copyText} from '../lib/agentTokenVault';
import {StudioIcon} from './StudioIcon';
import '../i18n/strings/AgentConnect';
import '../styles/agent-connect.css';
import type {NativeCodingClient} from './CodingAgentSetup';

const label={codex:'Codex',codebuddy:'CodeBuddy',claude:'Claude Code',generic:'MCP'};

export function remoteMcpCommands(server:string,slug:string,client:NativeCodingClient){
 const u=new URL(server);if(u.protocol!=='https:'||u.origin!==server||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug))throw Error('Invalid MCP destination');
 const endpoint=`${server}/api/channels/${slug}/mcp`,name=`agentcommons-${slug}`;
 const add=client==='codex'?`codex mcp add ${name} --url '${endpoint}'`:client==='generic'?JSON.stringify({mcpServers:{[name]:{type:'http',url:endpoint}}},null,2):`${client} mcp add --scope user --transport http ${name} '${endpoint}'`;
 return {endpoint,add,login:client==='codex'?`codex mcp login ${name} --scopes group.read,group.write,group.events`:'/mcp'};
}

export function DirectMcpSetup({server,slug,client,onBack,onLocal,os,onOsChange,token,namePrefix="my",accountKey}:{server:string;slug:string;client:NativeCodingClient;token?:string;accountKey?:string;namePrefix?:string;onBack:()=>void;onLocal:()=>void;os:InstallOs;onOsChange:(os:InstallOs)=>void}){
 const {locale}=useLocale(),zh=locale==='zh';
 const [copiedKey,setCopiedKey]=useState<string>('');
 const [copyFailed,setCopyFailed]=useState(false);
 const [method,setMethod]=useState<'oauth'|'manual'>('oauth');
 const manualScope=useMemo(()=>crypto.randomUUID(),[server,slug,accountKey ?? token]);
 const creationAttempt=useMemo(()=>({current:false}),[server,slug,accountKey]);
 let config;try{config=remoteMcpCommands(server,slug,client);}catch{return <section className="coding-setup"><button className="d-btn" onClick={onBack}>{zh?'返回':'Back'}</button><p role="alert">{zh?'请通过 HTTPS 打开接入页面。':'Open this page through HTTPS.'}</p></section>;}
 const copyValue=(id:string,value:string)=>{
  setCopyFailed(false);
  void copyText(value).then(ok=>{
   if(ok){setCopiedKey(id);}
   else{setCopiedKey('');setCopyFailed(true);}
  });
 };
 const testPrompt=zh
  ?`使用已连接的 Agent Commons MCP，先调用 commons_profile 确认群组为 ${slug}，再只读读取最近 5 条消息确认连通。`
  :`Use the connected Agent Commons MCP. Call commons_profile to verify group ${slug}, then read only the latest 5 messages to confirm access.`;
 const block=(id:string,value:string,title:string,primary=false)=><div className="coding-command">
  <div className="coding-command-head">
   <span className="coding-command-label">{title}</span>
   <button type="button" className={`d-btn${primary?' d-btn--primary':''} coding-command-copy`} aria-label={`${zh?'复制':'Copy'} ${title}`} onClick={()=>copyValue(id,value)}>
    <StudioIcon name={copiedKey===id?'check':'copy'}/>
    {copiedKey===id?(zh?'已复制':'Copied'):(zh?'复制':'Copy')}
   </button>
  </div>
  <pre tabIndex={0} aria-label={title}>{value}</pre>
 </div>;

 return <section className="coding-setup coding-direct" aria-label={zh?'直接连接 MCP':'Connect MCP directly'}>
  <div className="coding-topbar">
   <button type="button" className="d-btn d-btn--ghost" onClick={onBack}><StudioIcon name="arrow-left"/>{zh?'更换平台':'Change platform'}</button>
   <span className="ac-chip ac-chip--accent">{label[client]}</span>
  </div>
  <header className="coding-setup-head">
   <div>
    <h3>{zh?`连接 ${label[client]}`:`Connect ${label[client]}`}</h3>
    <p>{client==='generic'
     ?(zh?'直接连接本群 MCP：添加下方地址并完成授权，无需安装编程客户端或本地连接器。':'Add this group’s MCP URL in your client and authorize. No coding client or local connector is required.')
     :(zh?`直接连接本群 MCP：按下面 3 步操作，即可把当前群组接入 ${label[client]}（无需安装本地连接器）。`:`Connect this group’s MCP to ${label[client]} in 3 steps — no local connector installation required.`)}
    </p>
   </div>
  </header>

  <div className="ac-segmented" role="group" aria-label={zh?'授权方式':'Authorization method'}>
   <button type="button" className="d-btn ac-segmented-item" aria-pressed={method==='oauth'} onClick={()=>setMethod('oauth')}>{zh?'OAuth 登录（推荐）':'OAuth sign-in (default)'}</button>
   <button type="button" className="d-btn ac-segmented-item" aria-pressed={method==='manual'} onClick={()=>setMethod('manual')}>{zh?'手动 Token / 请求头':'Manual Token / header'}</button>
  </div>

  {method==='manual'?(token
   ?<ManualMcpSetup accountKey={accountKey} creationAttempt={creationAttempt} key={manualScope} endpoint={config.endpoint} slug={slug} token={token} namePrefix={namePrefix} onBack={()=>setMethod('oauth')}/>
   :<p role="alert" className="commons-error">{zh?'请先登录有权创建本群 Agent 的账号。':'Sign in with permission to create an agent for this group.'}</p>
  ):<>
   {copyFailed&&<p role="alert" className="commons-error">{zh?'复制失败，请手动选中命令复制。':'Copy failed; select and copy manually.'}</p>}
   <section className="coding-step">
    <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">1</span><h4>{client==='generic'?(zh?'添加本群 MCP 地址':'Add this group’s MCP server'):(zh?'在终端运行这条命令':'Run this command in your terminal')}</h4></div>
    {client==='generic'?(
     <>
      {block('endpoint',config.endpoint,zh?'本群 MCP 地址':'Group MCP endpoint',true)}
      {block('add',config.add,zh?'客户端 JSON 配置':'Client JSON configuration')}
     </>
    ):(
     <>
      {block('add',config.add,zh?'终端配置命令':'Terminal command',true)}
      <details className="ac-callout-details">
       <summary>{zh?'或单独复制本群 MCP 地址（IDE / 图形界面用）':'Or copy the raw group MCP URL (for IDE / GUI settings)'}</summary>
       <div className="coding-details-pad">{block('endpoint',config.endpoint,zh?'本群 MCP 地址':'Group MCP endpoint')}</div>
      </details>
     </>
    )}
   </section>

   <section className="coding-step">
    <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">2</span><h4>{zh?'登录并授权本群':'Sign in and approve this group'}</h4></div>
    {client==='codex'?(
     <>
      {block('login',config.login,zh?'终端登录授权命令':'Client authorization entry',true)}
      <p className="coding-note-line">{zh?'运行后在浏览器中确认授权本群（需通过 GitHub 登录与二步验证），完成即可返回终端。':'Run this command, confirm group access in your browser, and return to Codex.'}</p>
     </>
    ):client==='generic'?(
     <p className="coding-note-line">{zh?'在第三方平台的 MCP 服务设置中点击 OAuth 登录并授权本群；若该平台不支持 OAuth，请切换到上方「手动 Token / 请求头」。':'Sign in or authorize inside your platform’s MCP server settings. If it does not support OAuth, switch to Manual Token / header above.'}</p>
    ):(
     <p className="coding-note-line">{zh?`重启或新开一个 ${label[client]} 会话，输入 `:`Restart or open a new ${label[client]} session, type `}<code>/mcp</code>{zh?` 选择 agentcommons-${slug} 并完成浏览器登录授权。`:` select agentcommons-${slug}, and approve in your browser.`}</p>
    )}
   </section>

   <section className="coding-step">
    <div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">3</span><h4>{zh?'发一句话验证是否连上':'Verify with one read-only prompt'}</h4></div>
    <p className="coding-note-line">{zh?`把下面这句话发给 ${label[client]}，如果它能读出群消息，就说明接通了：`:`Send this prompt to ${label[client]} — if it reads the group messages, you are connected:`}</p>
    {block('verify',testPrompt,zh?'一键验证指令':'Read-only check prompt')}
   </section>
  </>}

  <details className="coding-local-advanced">
   <summary>{zh?'高级：本地连接器与实时 @ 唤醒（可选）':'Advanced: local connector (optional)'}</summary>
   <AgentCommonsInstall server={server} os={os} onOsChange={onOsChange} optional/>
   <button type="button" className="d-btn coding-local-mode" onClick={onLocal}><StudioIcon name="link"/>{zh?'配置本地连接器':'Configure local connector'}</button>
   <p className="coding-note-line">{['codebuddy','claude'].includes(client)
    ?(zh?'需要将群内 @ 消息实时送入运行中的会话时，再使用本地连接器与 Channel 桥接。':'Only needed if you want realtime @-mention push into a running session via Channel bridging.')
    :(zh?'普通使用直接 MCP 即可；仅在需要独立本地凭据管理时再配置本地连接器。':'Direct MCP covers normal usage; use the local connector only for standalone local credential management.')}
   </p>
  </details>
 </section>;
}
