import {PlatformIcon} from "./PlatformIcon";
import {useEffect,useRef,type RefObject} from 'react';
import {StudioIcon} from './StudioIcon';
import type {StudioIconName} from './StudioIcon';
import {useLocale} from '../i18n/locale';
import type {ConversationWidth} from '../lib/conversationWidth';
import '../styles/conversation-layout.css';
export interface ConversationMember {name:string;display:string;kind?:'agent'|'human';connector_type?:string}
export interface ConversationShortcut {key:string;label:string;icon:StudioIconName;onClick():void;count?:number}
export function ConversationHeader({title,members,onDetails,detailsButtonRef,onMembers,onAddAgent,shortcuts=[],attentionCount=0,onAttention,connectionStatus='open',readingWidth='standard',onReadingWidthChange}:{title:string;members:readonly ConversationMember[];onDetails():void;detailsButtonRef?:RefObject<HTMLButtonElement|null>;onMembers?:()=>void;onAddAgent?:()=>void;shortcuts?:readonly ConversationShortcut[];attentionCount?:number;onAttention?:()=>void;connectionStatus?:string;readingWidth?:ConversationWidth;onReadingWidthChange?:(width:ConversationWidth)=>void}){
 const {locale}=useLocale(),zh=locale==='zh';
 const menu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(typeof document==='undefined'||typeof document.addEventListener!=='function')return;const close=(event:PointerEvent)=>{if(menu.current&&event.target instanceof Node&&!menu.current.contains(event.target))menu.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 const runShortcut=(shortcut:ConversationShortcut)=>{if(menu.current?.open){menu.current.open=false;menu.current.querySelector('summary')?.focus();}shortcut.onClick();};
 return <header className="chat-header conversation-header">
  <div className="header-title">
   <span id="mobile-navigation-trigger-slot"/>
   <div className="conversation-heading"><button ref={detailsButtonRef} className="conversation-title" type="button" onClick={onDetails} aria-haspopup="dialog"><h1>{title}</h1><StudioIcon name="chevron-down"/></button><span className="conversation-subtitle">{zh?`${members.length} 位成员`:`${members.length} ${members.length===1?'member':'members'}`}</span></div>
   <span className="header-divider"/>
   <button type="button" className="avatar-stack" onClick={onMembers??onDetails} aria-label={zh?`查看群成员（${members.length}）`:`View group members (${members.length})`} aria-haspopup="dialog">
    {members.slice(0,4).map((m,i)=><span key={m.name} className={`agent-avatar conversation-avatar conversation-avatar--${m.kind??'unknown'} prototype-avatar-${i%4}`} title={m.display}>{m.kind==='agent'?<PlatformIcon platform={m.connector_type} size={18} decorative/>:Array.from(m.display||m.name)[0]}</span>)}
   </button>
   {attentionCount>0&&<button type="button" className="conversation-attention" onClick={onAttention??onDetails} aria-label={zh?`${attentionCount} 条提及通知`:`${attentionCount} mention notifications`}>@{attentionCount}</button>}
   {connectionStatus!=='open'&&<span className="conversation-connection" role="status" title={connectionStatus}>{connectionStatus==='connecting'?(zh?'连接中':'Connecting'):connectionStatus==='reconnecting'?(zh?'重连中':'Reconnecting'):(zh?'连接已断开':'Disconnected')}</span>}
  </div>
  <div className="conversation-header-actions">
   {shortcuts.length>0&&<><nav className="conversation-shortcut-actions" aria-label={zh?'群功能':'Group actions'}>{shortcuts.map(shortcut=><button key={shortcut.key} type="button" onClick={shortcut.onClick} aria-label={shortcut.label} title={shortcut.label}><StudioIcon name={shortcut.icon}/><span>{shortcut.label}</span>{shortcut.count!==undefined&&shortcut.count>0&&<small>{shortcut.count}</small>}</button>)}</nav><details ref={menu} className="conversation-shortcut-menu" onKeyDown={event=>{if(event.key==='Escape'&&event.currentTarget.open){event.preventDefault();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label={zh?'群功能':'Group actions'} title={zh?'群功能':'Group actions'}><StudioIcon name="tools"/></summary><div>{shortcuts.map(shortcut=><button key={shortcut.key} type="button" onClick={()=>runShortcut(shortcut)}><StudioIcon name={shortcut.icon}/><span>{shortcut.label}</span>{shortcut.count!==undefined&&shortcut.count>0&&<small>{shortcut.count}</small>}</button>)}</div></details></>}
   {onReadingWidthChange&&<select className="conversation-width-select" aria-label={zh?'阅读宽度':'Reading width'} title={zh?'阅读宽度':'Reading width'} value={readingWidth} onChange={event=>onReadingWidthChange(event.currentTarget.value as ConversationWidth)}><option value="standard">{zh?'标准宽度':'Standard width'}</option><option value="wide">{zh?'宽幅阅读':'Wide reading'}</option><option value="full">{zh?'铺满窗口':'Full width'}</option></select>}
   {onAddAgent&&<button type="button" className="invite-button" onClick={onAddAgent} aria-label={zh?'邀请 Agent':'Invite Agent'} title={zh?'邀请 Agent':'Invite Agent'}><StudioIcon name="plus"/><span>{zh?'邀请 Agent':'Invite Agent'}</span></button>}
  </div>
 </header>;
}
