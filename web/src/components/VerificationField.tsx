import { useEffect, useRef } from "react";
import { useLocale } from "../i18n/locale";

export function completeVerification(code: string, recovery: boolean) {
  return recovery ? /^[a-f0-9]{32}$/i.test(code.replace(/[ -]/g, "")) : /^[0-9]{6}$/.test(code);
}

export function VerificationField({ recovery, code, onChange, busy, invalid }: {
  recovery: boolean;
  code: string;
  onChange(code: string): void;
  busy: boolean;
  invalid: boolean;
}) {
  const zh = useLocale().locale === "zh";
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (invalid && !busy) inputRef.current?.focus();
  }, [invalid, busy]);
  return (
    <label className="auth-field">
      {recovery ? (zh ? "恢复码" : "Recovery code") : (zh ? "6 位验证码" : "Six-digit code")}
      <input ref={inputRef} key={recovery ? "recovery" : "totp"} className={recovery ? "auth-recovery-input" : "auth-otp-input"}
        type="text" inputMode={recovery ? "text" : "numeric"} autoComplete="one-time-code" autoCapitalize="none"
        spellCheck={false} autoFocus required disabled={busy} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "auth-error" : undefined} placeholder={recovery ? undefined : "······"}
        value={code} onChange={e => {
          const next = e.target.value.normalize("NFKC");
          onChange(recovery ? next.slice(0, 39) : next.replace(/\s/g, "").slice(0, 6));
        }} />
    </label>
  );
}
