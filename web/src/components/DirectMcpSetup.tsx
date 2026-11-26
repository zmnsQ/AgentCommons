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
 const {locale}=useLocale(),zh=locale==='zh';const [notice,setNotice]=useState('');const [method,setMethod]=useState<'oauth'|'manual'>('oauth');const manualScope=useMemo(()=>crypto.randomUUID(),[server,slug,accountKey ?? token]);const creationAttempt=useMemo(()=>({current:false}),[server,slug,accountKey]);
 let config;try{config=remoteMcpCommands(server,slug,client);}catch{return <section className="coding-setup"><button className="d-btn" onClick={onBack}>{zh?'返回':'Back'}</button><p role="alert">{zh?'请通过 HTTPS 打开接入页面。':'Open this page through HTTPS.'}</p></section>;}
 const block=(value:string,title:string)=><div className="coding-command"><div className="coding-command-head"><span className="coding-command-label">{title}</span><button type="button" className="d-btn coding-command-copy" aria-label={`${zh?'复制':'Copy'} ${title}`} onClick={()=>void copyText(value).then(ok=>setNotice(ok?(zh?'已复制':'Copied'):(zh?'请手动复制':'Copy manually')))}><StudioIcon name="copy"/>{zh?'复制':'Copy'}</button></div><pre tabIndex={0} aria-label={title}>{value}</pre></div>;
 return <section className="coding-setup coding-direct" aria-label={zh?'直接连接 MCP':'Connect MCP directly'}>
 <div className="coding-topbar"><button className="d-btn d-btn--ghost" type="button" onClick={onBack}><StudioIcon name="arrow-left"/>{zh?'返回选择':'Back'}</button><span className="ac-kicker">AGENT COMMONS</span></div>
 <header className="coding-setup-head"><div><span className="ac-chip">{label[client]}</span><h3>{zh?'连接 ':'Connect '}{label[client]}</h3><p>{client==='generic'?(zh?'在支持远程 HTTP MCP 的平台添加本群服务地址，选择该平台支持的授权方式，再只读核验。无需安装编程客户端或本地连接器。':'Add this group’s server URL in a platform supporting remote HTTP MCP, choose its supported authorization method, then verify read-only. No coding client or local connector is required.'):zh?'直接连接本群 MCP：先安装并登录所选编程客户端，再添加本群地址、授权、只读验证。此路径无需安装本地连接器。':'First install and sign in to your chosen coding client, then add this group’s MCP address, authorize and verify read-only. This path needs no local connector installation.'}</p></div></header>
 <div className="ac-segmented" role="group" aria-label={zh?'授权方式':'Authorization method'}><button type="button" className="d-btn ac-segmented-item" aria-pressed={method==='oauth'} onClick={()=>setMethod('oauth')}>{zh?'OAuth 登录（默认）':'OAuth sign-in (default)'}</button><button type="button" className="d-btn ac-segmented-item" aria-pressed={method==='manual'} onClick={()=>setMethod('manual')}>{zh?'手动 Token / 请求头':'Manual Token / header'}</button></div>
 {method==='manual'?(token?<ManualMcpSetup accountKey={accountKey} creationAttempt={creationAttempt} key={manualScope} endpoint={config.endpoint} slug={slug} token={token} namePrefix={namePrefix} onBack={()=>setMethod('oauth')}/>:<p role="alert">{zh?'请先登录有权创建本群 Agent 的账号。':'Sign in with permission to create an agent for this group.'}</p>):<>
 {notice&&<p role="status" className="ac-inline-status">{notice}</p>}
 <section className="coding-step"><div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">1</span><h4>{zh?'添加 MCP 服务':'Add the MCP server'}</h4></div>{block(config.endpoint,zh?'本群 MCP 地址':'Group MCP endpoint')}{block(config.add,zh?'客户端配置命令':'Client configuration command')}</section>
 <section className="coding-step"><div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">2</span><h4>{zh?'登录并授权本群':'Sign in and approve this group'}</h4></div>{client!=='generic'&&block(config.login,zh?'客户端授权入口':'Client authorization entry')}
  <p className="coding-note-line">{client==='generic'?(zh?'在第三方平台的 MCP 服务设置中完成登录或授权。':'Sign in or authorize inside your platform’s MCP server settings.') : zh?'Codex 执行上方登录命令；其他客户端在会话内打开 /mcp 并授权。':'Run the login command in Codex, or open /mcp in other clients and authorize.'}</p>
  <details className="ac-callout-details"><summary>{zh?'第三方平台与远程回调':'Third-party platforms and remote callbacks'}</summary><p>{client==='generic'?(zh?'若平台不支持 OAuth，请选择上方手动 Token / 请求头方式。':'If your platform does not support OAuth, choose Manual Token / header above.'):zh?'核对群组和权限，完成二步验证后返回客户端。':'Review the group and permissions, complete two-step verification, then return to the client.'}</p><p>{zh?'远程开发机的回调需要在运行该客户端的机器上完成；浏览器不在同机时使用客户端支持的远程登录方式。':'The OAuth callback must reach the machine running your client; use its supported remote-login workflow when the browser runs elsewhere.'}</p></details>
 </section>
 <section className="coding-step"><div className="coding-step-head"><span className="ac-step-index" aria-hidden="true">3</span><h4>{zh?'检查工具与实时消息':'Check tools and event delivery'}</h4></div>
  <p className="coding-note-line">{zh?'先用 commons_profile 核对群组与身份，再只读获取消息。工具可用不代表常驻在线。':'Call commons_profile to verify group and identity, then read messages. Tool access does not mean continuous presence.'}</p>
  <details className="ac-callout-details"><summary>{zh?'事件订阅与通知边界':'Event subscriptions and notification limits'}</summary><p>{zh?'支持 MCP Events 的客户端可订阅 message.mentioned，使用 events/stream 接收实时通知；工具连接成功不等于已经订阅。':'Clients supporting MCP Events can subscribe to message.mentioned with events/stream. A tool connection alone is not an active event subscription.'}</p><p>{zh?'默认仅接收群主人类账号对你的明确 @。通知不授予执行或修改权限，客户端原有审批仍然生效。':'By default, receive only explicit mentions from the human owner. Notifications grant no new execution or write permissions; existing client approvals remain in force.'}</p></details>
 </section>
 </>}
 <details className="coding-local-advanced"><summary>{zh?'高级：本地连接器（可选）':'Advanced: local connector (optional)'}</summary>
 <AgentCommonsInstall server={server} os={os} onOsChange={onOsChange} optional/>
 <button type="button" className="d-btn coding-local-mode" onClick={onLocal}><StudioIcon name="link"/>{zh?'配置本地连接器':'Configure local connector'}</button>
 <section className="coding-step"><h4>{['codebuddy','claude'].includes(client)?(zh?'在运行中的会话接收通知':'Receive notifications in a running session'):(zh?'本地连接选项':'Local connection options')}</h4><p>{['codebuddy','claude'].includes(client)?(zh?'需要将群消息送入当前会话时，使用 Channel 桥接。它持续接收服务端事件，无需定时查询消息或配置本机公网端口。':'Use the Channel bridge to deliver references into the running session. It receives server events without scheduled message polling or a public laptop port.'):(zh?'本地连接器适合需要独立凭据配置的环境。客户端未提供事件接收能力时，不会把普通 MCP 工具连接标成自动唤醒。':'The local connector is available for independently managed credentials. Ordinary tool access is not labeled automatic wake when the host lacks event support.')}</p></section>
 </details>
 </section>;
}
