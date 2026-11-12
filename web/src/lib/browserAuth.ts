import { apiBase } from './base';
export type BrowserSessionState = {
  configured: boolean;
  status: 'signed_out' | 'mfa_required' | 'authenticated';
  access_token?: string;
  expires_at?: number;
  account?: string;
  login?: string;
  mfa_enabled?: boolean;
};
export function browserAuthOrigin(): string {
  const origin = location.origin;
  const base = apiBase();
  if (base && new URL(base, origin).origin !== origin) throw new Error('browser_server_mismatch');
  return origin;
}
export async function browserAuthRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const root = browserAuthOrigin();
  const response = await fetch(`${root}/api/auth/github${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-agentparty-browser': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json() as T & { error?: { code?: string } };
  if (!response.ok) throw new Error(result.error?.code ?? 'authentication_unavailable');
  return result;
}
export function githubLoginUrl(returnTo = location.pathname + location.search): string {
  return `${browserAuthOrigin()}/api/auth/github/start?${new URLSearchParams({ return_to: returnTo })}`;
}
export function securityError(error: unknown, zh = true): string {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, [string, string]> = {
    invalid_verification_code: ['验证码或恢复码无效，请输入新的验证码或未使用的恢复码。','This code is invalid or has been used. Try another code.'],
    too_many_attempts: ['尝试次数过多，请在五分钟后重试。','Too many attempts. Try again after five minutes.'],
    recent_login_required: ['请重新使用 GitHub 登录，再继续设置。','Please sign in with GitHub again before changing this setting.'],
    login_required: ['登录已过期，请重新使用 GitHub 登录。','Your session expired. Please sign in with GitHub again.'],
    setup_expired: ['设置已过期，请重新开始绑定验证器。','Setup expired. Please start authenticator enrollment again.'],
    setup_not_authorized: ['此初始化链接无效或已过期，需要部署管理员重新生成。','This setup link is invalid or expired. Ask the deployment administrator for a new link.'],
    already_configured: ['GitHub 登录已配置，可以返回登录页。','GitHub sign-in is already configured. Return to the sign-in page.'],
    browser_server_mismatch: ['请在该服务器自己的网页中登录，再配对桌面客户端。','Sign in on this server’s own website, then pair the desktop client.'],
    account_not_allowed: ['这个 GitHub 账号尚未获准访问此实例。','This GitHub account is not allowed on this instance.'],
  };
  return messages[code]?.[zh ? 0 : 1] ?? (zh ? '操作未完成，请重试。' : 'Couldn’t complete this action. Try again.');
}
