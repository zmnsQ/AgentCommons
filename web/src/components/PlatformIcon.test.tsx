// @ts-expect-error Bun test module not included in web tsconfig.
import { expect, test } from "bun:test";
// @ts-expect-error Bun provides Node fs; production web does not bundle this test.
import { readFileSync } from "node:fs";
import { declaredAgentPlatform, PlatformIcon } from "./PlatformIcon";

test("only explicit platform keys map, never nickname fragments", () => {
  expect(declaredAgentPlatform("chatgpt")).toBe("chatgpt");
  expect(declaredAgentPlatform("codex-sdk")).toBe("codex-sdk");
  expect(declaredAgentPlatform("manus")).toBe("manus");
  expect(PlatformIcon({ platform: "manus" }).props.children.props.children).toBe("M");
  expect(declaredAgentPlatform("My ChatGPT agent")).toBe(null);
  expect(declaredAgentPlatform("ac-oauth-muse")).toBe(null);
  expect(declaredAgentPlatform(undefined)).toBe(null);
});
test("declared platforms without artwork use neutral initials and retain accessible names", () => {
  for (const [platform, initials, label] of [["muse","M","Muse"],["manus","M","Manus"],["cue","C","Cue"],["grok","G","Grok"],["hermes","H","Hermes"],["codebuddy","CB","CodeBuddy"]]) {
    const icon = PlatformIcon({platform,size:24});
    expect(icon.props["aria-label"]).toBe(label);
    expect(icon.props.children.props.className).toBe("platform-icon-initials");
    expect(icon.props.children.props.children).toBe(initials);
    expect(icon.props.children.props.style).toBeUndefined();
    expect(icon.props.style["--platform-icon-size"]).toBe("24px");
    const decorative = PlatformIcon({platform,decorative:true});
    expect(decorative.props["aria-hidden"]).toBe(true);
    expect(decorative.props["aria-label"]).toBeUndefined();
  }
  expect(PlatformIcon({platform:"my-muse"}).props.children.props.name).toBe("agent");
});
test("known OpenAI service uses local mark and unknown remains neutral", () => {
  const icon = PlatformIcon({ platform: "chatgpt" });
  expect(icon.props["aria-label"]).toBe("ChatGPT · OpenAI");
  expect(icon.props.children.props.style.maskImage).toBe("url(/brand/platforms/openai.svg)");
  const fallback = PlatformIcon({ platform: "made-up" });
  expect(fallback.props["data-platform"]).toBe("unknown");
  expect(fallback.props.children.props.name).toBe("agent");
});
test("vendored vector marks contain geometry only and no external resources", () => {
  for (const name of ["openai", "anthropic"]) {
    const svg = readFileSync(new URL(`../../public/brand/platforms/${name}.svg`, import.meta.url), "utf8");
    expect(svg).toContain('<path d="');
    expect(svg).not.toMatch(/<script|<foreignObject|\bon\w+=|href=|<image|<animate|<style/i);
  }
});
