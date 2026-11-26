import {ProviderMark} from "./ProviderMark";
import {StudioIcon} from "./StudioIcon";
import "../i18n/strings/Studio";
import {useLocale} from "../i18n/locale";
import {useT} from "../i18n/useT";
import "../i18n/strings/AgentConnect";
import "../styles/agent-connect.css";
import "../styles/agent-picker.css";

export const CLOUD_AGENT_CHOICES=["dot","muse","cue","grok","hermes"] as const;
export type CloudAgentChoice=typeof CLOUD_AGENT_CHOICES[number];
export const CODING_AGENT_CHOICES=["codex","codebuddy","claude","other"] as const;
export type CodingAgentChoice=typeof CODING_AGENT_CHOICES[number];

/** 1-click platform picker: selecting a tile opens its setup guide immediately
 * without minting credentials, authorizing accounts, or running a process. */
export function AgentConnectionPicker({onCloud,onLocal,cloudDisabled=false}:{
  onCloud:(provider:CloudAgentChoice)=>void;
  onLocal:(provider:CodingAgentChoice)=>void;
  /** Cloud agents need channel manage permission; keep them visible but honest. */
  cloudDisabled?: boolean;
}) {
  const t=useT();
  const {locale}=useLocale(),zh=locale==="zh";
  const category=(kind:"coding"|"cloud")=><section className="agent-platform-category" aria-label={t(kind==="coding"?"AgentConnect.coding":"AgentConnect.cloud")}>
    <div className="agent-platform-category-head">
      <h4>{t(kind==="coding"?"AgentConnect.coding":"AgentConnect.platformCloud")}</h4>
      {kind==="coding"&&<span className="ac-chip ac-chip--accent">{zh?"常用 · 终端 / MCP":"Popular · Terminal / MCP"}</span>}
      {kind==="cloud"&&cloudDisabled&&<span className="ac-chip">{zh?"需群主 / 管理员":"Owner / moderator"}</span>}
    </div>
    {kind==="cloud"&&cloudDisabled&&<p className="agent-platform-locked" role="status">{zh?"仅群主或管理员可以接入云端 Agent；请让群主开启或代为连接。":"Only a group owner or moderator can connect cloud agents. Ask an owner to enable or connect it."}</p>}
    <div className="agent-platform-grid">
      {(kind==="coding"?CODING_AGENT_CHOICES:CLOUD_AGENT_CHOICES).map(provider=><button
        className="agent-platform-tile"
        type="button"
        key={provider}
        disabled={kind==="cloud"&&cloudDisabled}
        {...(kind==="coding"?{"data-coding-provider":provider}:{"data-provider":provider})}
        onClick={()=>kind==="coding"?onLocal(provider as CodingAgentChoice):onCloud(provider as CloudAgentChoice)}
      >
        <ProviderMark provider={provider}/>
        <span className="agent-platform-copy">
          <strong>{t(kind==="coding"?`AgentConnect.coding.${provider}`:`AgentConnect.${provider}`)}</strong>
          <small>{t(`AgentConnect.short.${provider}`)}</small>
        </span>
        <StudioIcon name="arrow"/>
      </button>)}
    </div>
  </section>;
  return <section className="agent-platform-picker" aria-label={t("AgentConnect.choose")}>
    <header className="agent-platform-heading">
      <h3>{t("AgentConnect.platformTitle")}</h3>
      <p>{t("AgentConnect.platformHint")}</p>
    </header>
    <div className="agent-platform-categories">{category("coding")}{category("cloud")}</div>
    <details className="agent-team-flow">
      <summary>{t("AgentConnect.advancedFlow")}</summary>
      <p>{t("AgentConnect.coexist")}</p>
      <ol>{(["plan","execute","review"] as const).map((step,index)=><li key={step}><span aria-hidden="true">{index+1}</span><div><strong>{t(`AgentConnect.flow.${step}`)}</strong><p>{t(`AgentConnect.flow.${step}Hint`)}</p></div></li>)}</ol>
      <p className="agent-team-boundary">{t("AgentConnect.executionBoundary")}</p>
    </details>
  </section>;
}
