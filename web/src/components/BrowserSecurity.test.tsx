// @ts-expect-error Bun executes this test.
import {afterEach,beforeEach,expect,mock,test} from 'bun:test';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {LocaleProvider} from '../i18n/locale';
let error: Error | null = null;
let reads = 0;
mock.module('../lib/browserAuth',()=>({
 browserAuthRequest:async(path:string)=>{if(error)throw error;if(path==='/security'){reads++;return {enabled:true,recovery_remaining:8,recent_login:true,login:'test'};}if(path==='/security/recovery-codes')return {recovery_codes:['one-time-fixture']};throw Error('unexpected');},
 githubLoginUrl:(returnTo:string)=>'/auth/start?'+new URLSearchParams({return_to:returnTo}),
 securityError:(e:unknown)=>e instanceof Error?e.message:'error',
}));
const {BrowserSecurity,safeWorkspaceReturn}=await import('./BrowserSecurity');
let renderer:ReactTestRenderer|null=null;
const originals=new Map<string,PropertyDescriptor|undefined>();
beforeEach(()=>{
 error=null;reads=0;
 for(const key of ['window','location','localStorage','IS_REACT_ACT_ENVIRONMENT'])originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,value:true});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?return_to=%2Fc%2Fdemo%3Ftab%3Dtasks'}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:Object.assign(new EventTarget(),{confirm:()=>false})});
});
afterEach(async()=>{await act(async()=>renderer?.unmount());renderer=null;for(const [key,value] of originals){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}});
async function render(){await act(async()=>{renderer=create(<LocaleProvider><BrowserSecurity/></LocaleProvider>);});return renderer!.root;}
test('return paths stay on the workspace origin',()=>{
 for(const path of ['//evil.test','https://evil.test','/\\evil.test','/auth/security',null])expect(safeWorkspaceReturn(path)).toBe('/');
 expect(safeWorkspaceReturn('/c/demo?tab=tasks#42')).toBe('/c/demo?tab=tasks#42');
});
test('initial read failure can retry without losing its workspace return path',async()=>{
 error=Error('offline');const root=await render();expect(root.findByProps({href:'/c/demo?tab=tasks'})).toBeDefined();
 error=null;await act(async()=>root.findAllByType('button').find(button=>button.children.includes('Retry'))!.props.onClick());
 expect(reads).toBe(1);expect(root.findAllByProps({role:'alert'})).toHaveLength(0);
});
test('expired login offers reauthentication returning to the security page',async()=>{
 error=Error('login_required');const root=await render();const link=root.findAllByType('a').find(a=>a.children.includes('Sign in again'))!;
 expect(decodeURIComponent(link.props.href)).toContain('/auth/security?return_to=');
});
test('unsaved recovery codes guard leaving and replacement until acknowledged',async()=>{
 const root=await render();
 await act(async()=>root.findAllByType('button').find(button=>button.children.includes('Regenerate recovery codes'))!.props.onClick());
 await act(async()=>root.findByProps({'aria-label':'Verification code'}).props.onChange({target:{value:'123456'}}));
 await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(root.findByType('pre').children.join('')).toBe('one-time-fixture');
 let prevented=false;root.findByProps({href:'/c/demo?tab=tasks'}).props.onClick({preventDefault(){prevented=true;}});expect(prevented).toBe(true);
 await act(async()=>root.findAllByType('button').find(button=>button.children.includes('Regenerate recovery codes'))!.props.onClick());expect(root.findAllByType('form')).toHaveLength(0);
 await act(async()=>root.findAllByType('button').find(button=>button.children.includes('I have saved them securely'))!.props.onClick());expect(root.findAllByType('pre')).toHaveLength(0);
});
