import { registerDict, type LocaleDict } from "../dict";

export const TokenGateStrings: LocaleDict = {
  en: {
    "TokenGate.title": "Sign in to your workspace",
    "TokenGate.github": "Continue with GitHub",
    "TokenGate.loading": "Loading sign-in options…",
    "TokenGate.tokenSignIn": "Use an access token",
    "TokenGate.tokenLabel": "Access token",
    "TokenGate.submit": "Enter workspace",
    "TokenGate.credit": "Authors & licenses",
  },
  zh: {
    "TokenGate.title": "登录工作区",
    "TokenGate.github": "使用 GitHub 登录",
    "TokenGate.loading": "正在加载登录方式…",
    "TokenGate.tokenSignIn": "使用访问令牌登录",
    "TokenGate.tokenLabel": "访问令牌",
    "TokenGate.submit": "进入工作区",
    "TokenGate.credit": "作者与许可",
  },
};

registerDict(TokenGateStrings);
