// @ts-expect-error Bun test runner; browser tsconfig intentionally excludes Bun globals.
import {afterEach,beforeEach,describe,expect,test} from "bun:test";
import {act,create,type ReactTestRenderer} from "react-test-renderer";
import {LocaleProvider} from "../i18n/locale";
import {AgentConnectionPicker,CLOUD_AGENT_CHOICES,CODING_AGENT_CHOICES,type CloudAgentChoice} from "./AgentConnectionPicker";
import {AgentConnectStrings} from "../i18n/strings/AgentConnect";
import {McpSecurityPanel} from "./McpSecurityPanel";
let renderer:ReactTestRenderer|null=null;
const originalFetch=globalThis.fetch,storage=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
const locationDescriptor=Object.getOwnPropertyDescriptor(globalThis,"location");
beforeEach(()=>{Object.defineProperty(globalThis,"location",{configurable:true,value:{origin:"https://commons.test"}});});
function text(node:any):string{return typeof node==="string"?node:(node?.children??[]).map(text).join("");}
afterEach(()=>{if(locationDescriptor)Object.defineProperty(globalThis,"location",locationDescriptor);else Reflect.deleteProperty(globalThis,"location");act(()=>renderer?.unmount());renderer=null;globalThis.fetch=originalFetch;if(storage)Object.defineProperty(globalThis,"localStorage",storage);else Reflect.deleteProperty(globalThis,"localStorage");});
async function mount(element:React.ReactElement){await act(async()=>{renderer=create(<LocaleProvider>{element}</LocaleProvider>);});return renderer!.root;}
describe("personal cloud agent onboarding is not a local harness form",()=>{
  test("platform tiles open their setup directly without creating credentials",async()=>{
    const cloud:string[]=[],coding:string[]=[];let network=0;
    globalThis.fetch=(async()=>{network++;throw Error("unexpected network");}) as typeof fetch;
    const root=await mount(<AgentConnectionPicker onCloud={p=>cloud.push(p)} onLocal={p=>coding.push(p)}/>);
    for(const provider of CLOUD_AGENT_CHOICES)await act(async()=>root.findByProps({"data-provider":provider}).props.onClick());
    for(const provider of CODING_AGENT_CHOICES)await act(async()=>root.findByProps({"data-coding-provider":provider}).props.onClick());
    expect(cloud).toEqual([...CLOUD_AGENT_CHOICES]);expect(coding).toEqual([...CODING_AGENT_CHOICES]);
    expect(network).toBe(0);expect(root.findAllByType("input")).toHaveLength(0);
    expect(root.findAllByProps({"data-picker-continue":true})).toHaveLength(0);
  });
  test("all platforms remain discoverable while optional team guidance is collapsed",async()=>{
    const root=await mount(<AgentConnectionPicker onCloud={()=>{}} onLocal={()=>{}}/>);
    expect(root.findAllByProps({className:"agent-platform-category"})).toHaveLength(2);
    expect(root.findAllByProps({className:"agent-platform-tile"})).toHaveLength(9);
    expect(root.findByType("details").props.open).toBeUndefined();
    expect(text(root.findByProps({"data-coding-provider":"other"}))).toContain("Other MCP platforms");
    expect(text(root)).toContain("ChatGPT dot");expect(text(root)).toContain("Meta Muse");
    expect(text(root)).not.toContain("AgentConnect.");
  });
  test("platform choices and labels remain bilingual",async()=>{
    expect(Object.keys(AgentConnectStrings.en).sort()).toEqual(Object.keys(AgentConnectStrings.zh).sort());
    Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>"zh",setItem:()=>{}}});
    const root=await mount(<AgentConnectionPicker onCloud={()=>{}} onLocal={()=>{}}/>);
    expect(text(root)).toContain("个人 Agent 与服务");expect(text(root)).toContain("MCP 客户端与编程 Agent");
    expect(text(root)).toContain("Codex");expect(text(root)).toContain("Claude Code");
    expect(text(root)).not.toContain("AgentConnect.");
  });
  test("MCP address contains no token and no policy changes happen until the human saves",async()=>{
    const calls:Array<{url:string;method:string;body:any}>=[];
    const policy={enabled:false,allow_write:false,allow_events:false,owner_mfa_enabled:true,require_mfa:true,updated_at:null};
    globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
      calls.push({url:String(input),method:init?.method??"GET",body:init?.body?JSON.parse(String(init.body)):null});
      return Response.json({policy: init?.method==="PUT"?{...policy,...JSON.parse(String(init.body))}:policy,can_manage:true});
    }) as typeof fetch;
    const root=await mount(<McpSecurityPanel token="apb_private_never_in_url" slug="test-group" canManage/>);
    expect(calls).toHaveLength(1);expect(calls[0]!.url).not.toContain("private_never");
    const address=root.findByProps({type:"url"});expect(address.props.value).toContain("/api/channels/test-group/mcp");
    expect(address.props.value).not.toContain("token");expect(address.props.value).not.toContain("apb_");
    const enabled=root.findAllByProps({type:"checkbox"})[0]!;
    await act(async()=>enabled.props.onChange({target:{checked:true}}));
    expect(text(root)).toContain("Closed");expect(calls).toHaveLength(1);
    const save=root.findAllByType("button").find(b=>text(b)==="Save access policy")!;
    await act(async()=>save.props.onClick());
    expect(calls[1]?.body).toEqual({enabled:true,allow_write:false,allow_events:false});
    expect(text(root)).toContain("Enabled — read-only");
  });
  test("without owner MFA the UI points to account security and refuses to enable the switch",async()=>{
    globalThis.fetch=(async()=>Response.json({policy:{enabled:false,allow_write:false,allow_events:false,owner_mfa_enabled:false,require_mfa:true},can_manage:true})) as typeof fetch;
    const root=await mount(<McpSecurityPanel token="test" slug="demo" canManage/>);
    expect(root.findByProps({href:"/auth/security"})).toBeTruthy();
    expect(root.findAllByProps({type:"checkbox"})[0]!.props.disabled).toBe(true);
    expect(text(root)).toContain("authenticator");
  });
});
