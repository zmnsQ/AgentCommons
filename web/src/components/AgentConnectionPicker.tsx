import {useState} from "react";
import {ProviderMark} from "./ProviderMark";
import {StudioIcon} from "./StudioIcon";
import "../i18n/strings/Studio";
import {useT} from "../i18n/useT";
import "../i18n/strings/AgentConnect";
import "../styles/agent-connect.css";
import "../styles/agent-picker.css";

export const CLOUD_AGENT_CHOICES=["dot","muse","cue","grok","hermes"] as const;
export type CloudAgentChoice=typeof CLOUD_AGENT_CHOICES[number];
export const CODING_AGENT_CHOICES=["codex","codebuddy","claude","other"] as const;
export type CodingAgentChoice=typeof CODING_AGENT_CHOICES[number];

/** Connection categories are complementary, not mutually exclusive roles.
 * Selecting a card does not mint credentials, authorize work or run a process. */
export function AgentConnectionPicker({onCloud,onLocal}:{
  onCloud:(provider:CloudAgentChoice)=>void;
  onLocal:(provider:CodingAgentChoice)=>void;
}) {
  const t=useT();
  const [selection,setSelection]=useState<{kind:"cloud";provider:CloudAgentChoice}|{kind:"coding";provider:CodingAgentChoice}|null>(null);
  const key=selection===null?null:selection.kind==="cloud"?`AgentConnect.${selection.provider}`:`AgentConnect.coding.${selection.provider}`;
  const category=(kind:"coding"|"cloud")=><section className="agent-platform-category" aria-label={t(kind==="coding"?"AgentConnect.coding":"AgentConnect.cloud")}>
    <div className="agent-platform-category-head">
      <h4>{t(kind==="coding"?"AgentConnect.coding":"AgentConnect.platformCloud")}</h4>
      <span className="ac-chip">{kind==="coding"?CODING_AGENT_CHOICES.length:CLOUD_AGENT_CHOICES.length}</span>
    </div>
    <div className="agent-platform-grid">
      {(kind==="coding"?CODING_AGENT_CHOICES:CLOUD_AGENT_CHOICES).map(provider=><button className="agent-platform-tile" type="button" key={provider} {...(kind==="coding"?{"data-coding-provider":provider}:{"data-provider":provider})} aria-pressed={selection?.kind===kind&&selection.provider===provider} onClick={()=>setSelection(kind==="coding"?{kind:"coding",provider:provider as CodingAgentChoice}:{kind:"cloud",provider:provider as CloudAgentChoice})}>
        <ProviderMark provider={provider}/>
        <span className="agent-platform-copy"><strong>{t(kind==="coding"?`AgentConnect.coding.${provider}`:`AgentConnect.${provider}`)}</strong><small>{t(`AgentConnect.short.${provider}`)}</small></span>
        <StudioIcon name="chevron-down"/>
      </button>)}
    </div>
  </section>;
  return <section className="agent-platform-picker" aria-label={t("AgentConnect.choose")}>
    <header className="agent-platform-heading"><h3>{t("AgentConnect.platformTitle")}</h3><p>{t("AgentConnect.platformHint")}</p></header>
    <div className="agent-platform-categories">{category("coding")}{category("cloud")}</div>
    {selection&&key&&<section className="agent-platform-next" aria-live="polite" aria-label={t("AgentConnect.nextStep")}>
      <div className="agent-platform-next-head">
        <span className="ac-step-index" aria-hidden="true">1</span>
        <div><h4>{t(key)}</h4><p>{t(`${key}Hint`)}</p></div>
      </div>
      <p className="agent-platform-requirement">{t(selection.kind==="coding"?(selection.provider==="other"?"AgentConnect.manualNeeds":"AgentConnect.codingNeeds"):`AgentConnect.${selection.provider}Needs`)}</p>
      <div className="agent-platform-next-actions">
        <button className="d-btn d-btn--primary" type="button" data-picker-continue onClick={()=>selection.kind==="cloud"?onCloud(selection.provider):onLocal(selection.provider)}>{t("AgentConnect.nextStep")}<StudioIcon name="arrow"/></button>
        <small>{t(selection.provider==="muse"?"AgentConnect.museChoice":"AgentConnect.unverified")}</small>
      </div>
    </section>}
    <p className="agent-platform-boundary">{t("AgentConnect.guideOnly")}</p>
    <details className="agent-team-flow"><summary>{t("AgentConnect.advancedFlow")}</summary><p>{t("AgentConnect.coexist")}</p><ol>{(["plan","execute","review"] as const).map((step,index)=><li key={step}><span aria-hidden="true">{index+1}</span><div><strong>{t(`AgentConnect.flow.${step}`)}</strong><p>{t(`AgentConnect.flow.${step}Hint`)}</p></div></li>)}</ol><p className="agent-team-boundary">{t("AgentConnect.executionBoundary")}</p></details>
  </section>;
}
