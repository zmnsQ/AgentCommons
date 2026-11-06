// @ts-expect-error Bun executes these tests.
import {afterEach, beforeEach, expect, test} from "bun:test";
import {act, create, type ReactTestRenderer} from "react-test-renderer";
import type {ReactElement} from "react";
import {ToolbarTooltip, ToolbarTooltipGroup} from "./ToolbarTooltip";

let renderer: ReactTestRenderer | null = null;
let now = 0;
let nextTimer = 0;
const timers = new Map<number, {at: number; run: () => void}>();
const originals = new Map<string, PropertyDescriptor | undefined>();
const windowEvents = new Map<string, Set<() => void>>();
const documentEvents = new Map<string, Set<(input: ReturnType<typeof event>) => void>>();
let anchor = {left: 100, top: 100, width: 44, height: 44};
let viewport = {width: 800, height: 600};
let connected = true;
const buttonNode = {
  get isConnected() {return connected;},
  getBoundingClientRect: () => ({...anchor, right: anchor.left + anchor.width, bottom: anchor.top + anchor.height}),
};
const tooltipNode = {style: {maxWidth: ""}, getBoundingClientRect: () => ({width: 120, height: 30})};
const install = (key: string, value: unknown) => {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
};
function event(fields: {pointerType?: string; key?: string} = {}) {
  return {...fields, defaultPrevented: false, stopped: false, preventDefault() {this.defaultPrevented = true;}, stopPropagation() {this.stopped = true;}};
}
function advance(ms: number) {
  act(() => {
    const until = now + ms;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].run();
    }
    now = until;
  });
}
function mount(children: ReactElement) {
  act(() => {
    renderer = create(children, {createNodeMock: element => element.type === "button" ? buttonNode : (element.props as {role?: string}).role === "tooltip" ? tooltipNode : null});
  });
}
const button = (id: string) => renderer!.root.findByProps({"data-test": id});
const tooltips = () => renderer!.root.findAllByProps({role: "tooltip"});
const enter = (id: string) => act(() => button(id).props.onPointerEnter(event({pointerType: "mouse"})));
const leave = (id: string) => act(() => button(id).props.onPointerLeave(event({pointerType: "mouse"})));

beforeEach(() => {
  now = 0; nextTimer = 0; timers.clear(); windowEvents.clear(); documentEvents.clear();
  anchor = {left: 100, top: 100, width: 44, height: 44};
  viewport = {width: 800, height: 600}; connected = true;
  install("IS_REACT_ACT_ENVIRONMENT", true);
  install("setTimeout", (run: () => void, delay = 0) => {const id = ++nextTimer; timers.set(id, {at: now + delay, run}); return id;});
  install("clearTimeout", (id: number) => {timers.delete(id);});
  install("ResizeObserver", undefined);
  install("window", {
    get innerWidth() {return viewport.width;}, get innerHeight() {return viewport.height;},
    addEventListener(type: string, callback: () => void) {if (!windowEvents.has(type)) windowEvents.set(type, new Set()); windowEvents.get(type)!.add(callback);},
    removeEventListener(type: string, callback: () => void) {windowEvents.get(type)?.delete(callback);},
    requestAnimationFrame(callback: () => void) {callback(); return 1;}, cancelAnimationFrame() {},
  });
  install("document", {
    addEventListener(type: string, callback: (e: ReturnType<typeof event>) => void) {if (!documentEvents.has(type)) documentEvents.set(type, new Set()); documentEvents.get(type)!.add(callback);},
    removeEventListener(type: string, callback: (e: ReturnType<typeof event>) => void) {documentEvents.get(type)?.delete(callback);},
  });
});
afterEach(() => {
  act(() => renderer?.unmount()); renderer = null;
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  originals.clear(); timers.clear();
});

test("first hover waits 500ms; a shown group is instant until 300ms after leaving", () => {
  mount(<ToolbarTooltipGroup>
    <ToolbarTooltip label="Tasks"><button data-test="tasks">A</button></ToolbarTooltip>
    <ToolbarTooltip label="Files"><button data-test="files">B</button></ToolbarTooltip>
  </ToolbarTooltipGroup>);
  expect(renderer!.toJSON()).toHaveLength(2);
  enter("tasks"); advance(499); expect(tooltips()).toHaveLength(0);
  advance(1); expect(tooltips()[0]!.children).toEqual(["Tasks"]);
  leave("tasks"); advance(100); enter("files");
  expect(tooltips()).toHaveLength(1); expect(tooltips()[0]!.children).toEqual(["Files"]);
  leave("files"); advance(299); enter("tasks");
  expect(tooltips()[0]!.children).toEqual(["Tasks"]);
  leave("tasks"); advance(300); enter("files");
  expect(tooltips()).toHaveLength(0);
  advance(499); expect(tooltips()).toHaveLength(0);
  advance(1); expect(tooltips()[0]!.children).toEqual(["Files"]);
});

test("passing over buttons does not show a stale tooltip or prematurely warm the group", () => {
  mount(<ToolbarTooltipGroup>
    <ToolbarTooltip label="Tasks"><button data-test="tasks"/></ToolbarTooltip>
    <ToolbarTooltip label="Files"><button data-test="files"/></ToolbarTooltip>
  </ToolbarTooltipGroup>);
  enter("tasks"); advance(200); leave("tasks"); enter("files");
  advance(499); expect(tooltips()).toHaveLength(0);
  leave("files"); advance(1000); expect(tooltips()).toHaveLength(0);
  enter("tasks"); advance(499); expect(tooltips()).toHaveLength(0);
  advance(1); expect(tooltips()[0]!.children).toEqual(["Tasks"]);
});

test("keyboard focus is immediate, preserves descriptions and handlers, and Escape dismisses", () => {
  let focused = 0, keyed = 0;
  mount(<ToolbarTooltip label="Task list"><button data-test="tasks" title="Old native hint" className="existing" aria-label="Tasks" aria-describedby="permission-help" onFocus={() => focused++} onKeyDown={() => keyed++}/></ToolbarTooltip>);
  const target = button("tasks");
  expect(target.props.title).toBeUndefined();
  expect(target.props.className).toBe("existing");
  expect(target.props["aria-label"]).toBe("Tasks");
  expect(target.props["aria-describedby"]).toBe("permission-help");
  enter("tasks"); advance(100);
  act(() => target.props.onFocus(event()));
  expect(focused).toBe(1); expect(tooltips()).toHaveLength(1);
  const id = tooltips()[0]!.props.id;
  expect(target.props["aria-describedby"]).toBe(`permission-help ${id}`);
  const escape = event({key: "Escape"}); act(() => target.props.onKeyDown(escape));
  expect(keyed).toBe(1); expect(escape.defaultPrevented).toBe(true); expect(escape.stopped).toBe(true);
  expect(tooltips()).toHaveLength(0); expect(target.props["aria-describedby"]).toBe("permission-help");
  advance(1000); expect(tooltips()).toHaveLength(0);
  act(() => target.props.onBlur(event())); act(() => target.props.onFocus(event()));
  expect(tooltips()).toHaveLength(1);
});

test("touch taps preserve the first click and do not open a tooltip through synthetic focus", () => {
  let clicked = 0, pressed = 0;
  mount(<ToolbarTooltip label="Settings"><button data-test="settings" onClick={() => clicked++} onPointerDown={() => pressed++}/></ToolbarTooltip>);
  const target = button("settings"), touch = event({pointerType: "touch"});
  act(() => {target.props.onPointerEnter(touch); target.props.onPointerDown(touch); target.props.onFocus(event()); target.props.onClick();});
  advance(1000);
  expect(clicked).toBe(1); expect(pressed).toBe(1); expect(touch.defaultPrevented).toBe(false); expect(tooltips()).toHaveLength(0);
  act(() => target.props.onBlur(event())); act(() => target.props.onFocus(event()));
  expect(tooltips()).toHaveLength(1);
});

test("separate groups do not share warm state", () => {
  mount(<><ToolbarTooltipGroup><ToolbarTooltip label="A"><button data-test="a"/></ToolbarTooltip></ToolbarTooltipGroup><ToolbarTooltipGroup><ToolbarTooltip label="B"><button data-test="b"/></ToolbarTooltip></ToolbarTooltipGroup></>);
  enter("a"); advance(500); leave("a"); enter("b");
  expect(tooltips()).toHaveLength(0); advance(500); expect(tooltips()[0]!.children).toEqual(["B"]);
});

test("top and right edges flip and clamp; resize follows the anchor and offscreen scroll closes", () => {
  viewport = {width: 320, height: 200}; anchor = {left: 270, top: 4, width: 44, height: 44};
  mount(<ToolbarTooltip label="More actions"><button data-test="more"/></ToolbarTooltip>);
  act(() => button("more").props.onFocus(event()));
  expect(tooltips()[0]!.props["data-side"]).toBe("bottom");
  expect(tooltips()[0]!.props.style).toMatchObject({left: 192, top: 56, visibility: "visible"});
  anchor = {left: 2, top: 166, width: 44, height: 24};
  act(() => windowEvents.get("resize")!.forEach(callback => callback()));
  expect(tooltips()[0]!.props["data-side"]).toBe("top");
  expect(tooltips()[0]!.props.style).toMatchObject({left: 8, top: 128});
  anchor = {left: 2, top: -60, width: 44, height: 24};
  act(() => windowEvents.get("scroll")!.forEach(callback => callback()));
  expect(tooltips()).toHaveLength(0);
  expect(windowEvents.get("resize")!.size).toBe(0);
});

test("Escape also closes a hover tooltip when focus is elsewhere", () => {
  mount(<ToolbarTooltip label="Help"><button data-test="help"/></ToolbarTooltip>);
  enter("help"); advance(500);
  const escape = event({key: "Escape"});
  act(() => documentEvents.get("keydown")!.forEach(callback => callback(escape)));
  expect(tooltips()).toHaveLength(0); expect(escape.defaultPrevented).toBe(true);
  expect(documentEvents.get("keydown")!.size).toBe(0);
});

test("button refs retain React cleanup and unmount cancels delayed work", () => {
  let attached: unknown, cleaned = 0;
  mount(<ToolbarTooltipGroup><ToolbarTooltip label="Help"><button data-test="help" ref={node => {attached = node; return () => {cleaned++;};}}/></ToolbarTooltip></ToolbarTooltipGroup>);
  expect(attached).toBe(buttonNode); enter("help"); expect(timers.size).toBe(1);
  act(() => renderer!.unmount()); renderer = null;
  expect(cleaned).toBe(1); expect(timers.size).toBe(0); advance(1000);
});

test("disabled controls stay inert and an existing labelledby name is not replaced", () => {
  mount(<ToolbarTooltip label="Unavailable action"><button data-test="disabled" disabled aria-labelledby="action-name"/></ToolbarTooltip>);
  const target = button("disabled"); expect(target.props["aria-label"]).toBeUndefined();
  expect(target.props["aria-labelledby"]).toBe("action-name");
  enter("disabled"); act(() => target.props.onFocus(event())); advance(1000);
  expect(tooltips()).toHaveLength(0);
});
