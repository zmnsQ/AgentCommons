import {useEffect,useState} from "react";
import {useLocale} from "../i18n/locale";
import {isStandaloneDisplay} from "../lib/standalone";

/** A user-controlled WebClip guide; never mimics a system install prompt. */
export function HomeScreenGuide(){
 const {locale}=useLocale(),zh=locale==="zh";
 const [standalone,setStandalone]=useState(isStandaloneDisplay);
 useEffect(()=>{
  if(typeof window.matchMedia!=="function")return;
  const media=window.matchMedia("(display-mode: standalone)"),update=()=>setStandalone(isStandaloneDisplay());
  update();media.addEventListener?.("change",update);return()=>media.removeEventListener?.("change",update);
 },[]);
 return <section className="settings-section home-screen-guide">
  <div className="settings-label">{zh?"添加到 iPhone 主屏幕":"Add to iPhone Home Screen"}</div>
  {standalone&&<p className="settings-hint" role="status">{zh?"当前已在独立窗口中打开。":"Currently open in a standalone window."}</p>}
  <details>
   <summary className="d-btn">{zh?"查看添加步骤":"Show setup steps"}</summary>
   <ol>
    <li>{zh?"在 iPhone 的 Safari 中打开本站。":"Open this site in Safari on your iPhone."}</li>
    <li>{zh?"打开 Safari 分享菜单，选择「添加到主屏幕」；未看到时可在「编辑操作」中查找。":"Open Safari’s Share menu and choose Add to Home Screen; if missing, check Edit Actions."}</li>
    <li>{zh?"如果出现「作为网页 App 打开」，保持开启，确认名称后点「添加」。":"If Open as Web App is shown, leave it on, confirm the name, then tap Add."}</li>
   </ol>
   <p className="settings-hint">{zh?"添加后可从主屏幕直接打开。使用时保持联网并登录。":"Open it directly from the Home Screen. Stay connected to the internet and signed in."}</p>
   <a href="https://support.apple.com/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer">{zh?"Apple 官方操作说明":"Apple’s official instructions"}</a>
  </details>
 </section>;
}
