import { PlatformIcon } from './PlatformIcon';
/** Declared platforms use available artwork or neutral initials. */
export function ProviderMark({provider}:{provider:string}){
 return <span className="provider-mark" data-provider-mark={provider}><PlatformIcon platform={provider} size={20} decorative /></span>;
}
