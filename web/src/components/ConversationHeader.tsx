import {PlatformIcon} from "./PlatformIcon";
import {StudioIcon} from './StudioIcon';
import {useLocale} from '../i18n/locale';
import type {ConversationWidth} from '../lib/conversationWidth';
import '../styles/conversation-layout.css';
export interface ConversationMember {name:string;display:string;kind?:'agent'|'human';connector_type?:string}
export function ConversationHeader({title,members,onDetails,onAddAgent,attentionCount=0,onAttention,connectionStatus='open',readingWidth='standard',onReadingWidthChange}:{title:string;members:readonly ConversationMember[];onDetails():void;onAddAgent?:()=>void;attentionCount?:number;onAttention?:()=>void;connectionStatus?:string;readingWidth?:ConversationWidth;onReadingWidthChange?:(width:ConversationWidth)=>void}){
 const {locale}=useLocale(),zh=locale==='zh';
 return <header className="chat-header conversation-header">
  <div className="header-title">
   <span id="mobile-navigation-trigger-slot"/>
   <div className="conversation-heading"><button className="conversation-title" type="button" onClick={onDetails} aria-haspopup="dialog"><h1>{title}</h1><StudioIcon name="chevron-down"/></button><span className="conversation-subtitle">{zh?`${members.length} 位成员`:`${members.length} ${members.length===1?'member':'members'}`}</span></div>
   <span className="header-divider"/>
   <button type="button" className="avatar-stack" onClick={onDetails} aria-label={zh?`查看群成员（${members.length}）`:`View group members (${members.length})`} aria-haspopup="dialog">
    {members.slice(0,4).map((m,i)=><span key={m.name} className={`agent-avatar conversation-avatar conversation-avatar--${m.kind??'unknown'} prototype-avatar-${i%4}`} title={m.display}>{m.kind==='agent'?<PlatformIcon platform={m.connector_type} size={18} decorative/>:Array.from(m.display||m.name)[0]}</span>)}
   </button>
   {attentionCount>0&&<button type="button" className="conversation-attention" onClick={onAttention??onDetails} aria-label={zh?`${attentionCount} 条提及通知`:`${attentionCount} mention notifications`}>@{attentionCount}</button>}
   {connectionStatus!=='open'&&<span className="conversation-connection" role="status" title={connectionStatus}>{connectionStatus==='connecting'?(zh?'连接中':'Connecting'):connectionStatus==='reconnecting'?(zh?'重连中':'Reconnecting'):(zh?'连接已断开':'Disconnected')}</span>}
  </div>
  <div className="conversation-header-actions">
   {onReadingWidthChange&&<select className="conversation-width-select" aria-label={zh?'阅读宽度':'Reading width'} title={zh?'阅读宽度':'Reading width'} value={readingWidth} onChange={event=>onReadingWidthChange(event.currentTarget.value as ConversationWidth)}><option value="standard">{zh?'标准宽度':'Standard width'}</option><option value="wide">{zh?'宽幅阅读':'Wide reading'}</option><option value="full">{zh?'铺满窗口':'Full width'}</option></select>}
   {onAddAgent&&<button type="button" className="invite-button" onClick={onAddAgent} aria-label={zh?'邀请 Agent':'Invite Agent'} title={zh?'邀请 Agent':'Invite Agent'}><StudioIcon name="plus"/><span>{zh?'邀请 Agent':'Invite Agent'}</span></button>}
  </div>
 </header>;
}
