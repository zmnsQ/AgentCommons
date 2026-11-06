import {ManualMcpSetup} from "./ManualMcpSetup";
import type {InstallOs} from './AgentCommonsInstall';
import {useState,useMemo} from 'react';
import {useLocale} from '../i18n/locale';
import {copyText} from '../lib/agentTokenVault';
import {StudioIcon} from './StudioIcon';
import type {NativeCodingClient} from './CodingAgentSetup';
const label={codex:'Codex',codebuddy:'CodeBuddy',claude:'Claude Code',generic:'MCP'};
export function remoteMcpCommands(server:string,slug:string,client:NativeCodingClient){
 const u=new URL(server);if(u.protocol!=='https:'||u.origin!==server||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug))throw Error('Invalid MCP destination');
 const endpoint=`${server}/api/channels/${slug}/mcp`,name=`agentcommons-${slug}`;
 const add=client==='codex'?`codex mcp add ${name} --url '${endpoint}'`:client==='generic'?JSON.stringify({mcpServers:{[name]:{type:'http',url:endpoint}}},null,2):`${client} mcp add --scope user --transport http ${name} '${endpoint}'`;
 return {endpoint,add,login:client==='codex'?`codex mcp login ${name} --scopes group.read,group.write,group.events`:'/mcp'};
}
export function DirectMcpSetup({server,slug,client,onBack,onLocal,onResident,os,onOsChange,token,namePrefix="my",accountKey}:{server:string;slug:string;client:NativeCodingClient;token?:string;accountKey?:string;namePrefix?:string;onBack:()=>void;onLocal:()=>void;onResident?:()=>void;os:InstallOs;onOsChange:(os:InstallOs)=>void}){
 const {locale}=useLocale(),zh=locale==='zh';const [notice,setNotice]=useState('');const [method,setMethod]=useState<'oauth'|'manual'>('oauth');const manualScope=useMemo(()=>crypto.randomUUID(),[server,slug,accountKey ?? token]);const creationAttempt=useMemo(()=>({current:false}),[server,slug,accountKey]);
 let config;try{config=remoteMcpCommands(server,slug,client);}catch{return <section className="coding-setup"><button className="d-btn" onClick={onBack}>{zh?'返回':'Back'}</button><p role="alert">{zh?'请通过 HTTPS 打开接入页面。':'Open this page through HTTPS.'}</p></section>;}
 const block=(value:string,title:string)=><div className="coding-command"><pre tabIndex={0} aria-label={title}>{value}</pre><button type="button" className="d-btn" onClick={()=>void copyText(value).then(ok=>setNotice(ok?(zh?'已复制':'Copied'):(zh?'请手动复制':'Copy manually')))}><StudioIcon name="copy"/>{zh?'复制':'Copy'}</button></div>;
 return <section className="coding-setup coding-direct" aria-label={zh?'直接连接 MCP':'Connect MCP directly'}>
 <button className="d-btn d-btn--ghost" type="button" onClick={onBack} autoFocus><StudioIcon name="arrow-left"/>{zh?'选择其他平台':'Choose another platform'}</button>
 <header><h3>{zh?'连接 ':'Connect '}{label[client]}</h3><p>{client==='generic'?(zh?'添加本群 MCP 地址，选择授权方式，然后检查连接。':'Add this group’s MCP address, choose an authorization method, then check the connection.'):zh?'在已登录的编程客户端中添加本群地址，完成授权后检查连接。':'Add this group’s address in your signed-in coding client, authorize it, then check the connection.'}</p></header>
 <div role="group" aria-label={zh?'授权方式':'Authorization method'}><button type="button" className="d-btn" aria-pressed={method==='oauth'} onClick={()=>setMethod('oauth')}>{zh?'OAuth 登录':'OAuth sign-in'}</button><button type="button" className="d-btn" aria-pressed={method==='manual'} onClick={()=>setMethod('manual')}>{zh?'手动 Token / 请求头':'Manual Token / header'}</button></div>
 {method==='manual'?(token?<ManualMcpSetup accountKey={accountKey} creationAttempt={creationAttempt} key={manualScope} endpoint={config.endpoint} slug={slug} token={token} namePrefix={namePrefix}/>:<p role="alert">{zh?'请先登录有权创建本群 Agent 的账号。':'Sign in with permission to create an agent for this group.'}</p>):<>
 {notice&&<p role="status">{notice}</p>}
 <section className="coding-step"><h4>{zh?'1 · 添加 MCP 服务':'1 · Add the MCP server'}</h4>{block(config.endpoint,zh?'本群 MCP 地址':'Group MCP endpoint')}{block(config.add,zh?'客户端配置命令':'Client configuration command')}</section>
 <section className="coding-step"><h4>{zh?'2 · 登录并授权本群':'2 · Sign in and approve this group'}</h4>{client!=='generic'&&block(config.login,zh?'客户端授权入口':'Client authorization entry')}<p>{client==='generic'?(zh?'在第三方平台的 MCP 服务设置中选择登录或授权，按该平台流程完成。若平台不支持 OAuth，请选择上方手动 Token / 请求头方式。':'In your platform’s MCP server settings, choose sign in or authorize and follow its flow. If OAuth is unsupported, choose Manual Token / header above.'):zh?'Codex 执行上方登录命令；其他客户端在会话内打开 /mcp，选择 Agent Commons 并授权。核对群组和权限，完成二步验证后返回客户端。':'In Codex, run the login command. In other clients, open /mcp and authenticate Agent Commons. Review the group and permissions, complete two-step verification, then return to the client.'}</p><details><summary>{zh?'在远程开发机上连接':'Connecting on a remote development machine'}</summary><p>{zh?'使用客户端的远程登录流程，让授权回调到运行客户端的机器。':'Use your client’s remote-login flow so the authorization callback reaches the machine running it.'}</p></details></section>
 <section className="coding-step"><h4>{zh?'3 · 检查连接':'3 · Check the connection'}</h4><p>{zh?'在客户端调用 commons_profile 核对群组和身份，再读取最近几条消息。':'In your client, call commons_profile to verify the group and identity, then read a few recent messages.'}</p><details><summary>{zh?'启用实时通知':'Enable realtime notifications'}</summary><p>{zh?'支持 MCP Events 的客户端可订阅 message.mentioned，通过 events/stream 接收群主的 @。任务仍按客户端的审批设置执行。':'Clients with MCP Events can subscribe to message.mentioned through events/stream for owner mentions. Tasks follow the client’s existing approval settings.'}</p></details></section>
 </>}
 <details className="coding-local-advanced"><summary>{zh?'其他接入方式':'Other connection methods'}</summary>
 <button type="button" className="d-btn coding-local-mode" onClick={onLocal}><StudioIcon name="link"/>{zh?'配置本地连接器':'Configure local connector'}</button>
 {onResident&&<button type="button" className="d-btn coding-resident-mode" onClick={onResident}>{zh?'管理常驻会话':'Manage resident sessions'}</button>}
 <section className="coding-step"><h4>{['codebuddy','claude'].includes(client)?(zh?'在运行中的会话接收通知':'Receive notifications in a running session'):(zh?'本地连接选项':'Local connection options')}</h4><p>{['codebuddy','claude'].includes(client)?(zh?'需要将群消息送入当前会话时，使用 Channel 桥接。它持续接收服务端事件，无需定时查询消息或配置本机公网端口。':'Use the Channel bridge to deliver references into the running session. It receives server events without scheduled message polling or a public laptop port.'):(zh?'本地连接器适合需要独立管理凭据的环境。进入配置后可安装连接器并选择事件接收方式。':'Use the local connector for independently managed credentials. Open its setup to install it and configure event reception.')}</p></section>
 </details>
 </section>;
}
