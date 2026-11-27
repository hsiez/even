import test from "node:test";
import assert from "node:assert/strict";
import { Linter, ESLint } from "eslint";
import stylelint from "stylelint";
import hooks from "eslint-plugin-react-hooks";
import web from "eslint-plugin-react-web-api";
import even from "../lint/eslint-plugin.mjs";
import { designProblems } from "../lint/design-policy.mjs";
import { effectRules } from "../lint/effect-rules.mjs";

const lint = (code, rules) =>
  new Linter().verify(code, [
    {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: { even, hooks, web },
      rules,
    },
  ]);

test("design values allow decisions and measured geometry, reject literals, options and unknown aliases", () => {
  for (const value of [
    "var(--even-space-inset-default)",
    "calc(100% - var(--even-size-border-control))",
    "0",
    "min(100%, 70vw)",
  ])
    assert.deepEqual(designProblems("width", value), []);
  for (const [property, value] of [
    ["padding", "12px"],
    ["border", "1px solid var(--even-border-default)"],
    ["color", "rebeccapurple"],
    ["color", "rgb(0 0 0)"],
    ["color", "#123456"],
    ["color", "var(--even-color-blue-6)"],
    ["gap", "var(--even-space-inset-typo)"],
    ["padding", "calc(var(--even-space-inset-default) + 3px)"],
    ["font-family", '"Arial"'],
    ["transition", "transform 250ms ease-out"],
  ])
    assert.ok(designProblems(property, value).length, `${property}: ${value}`);
});

test("JavaScript token lint follows conditional objects, identifiers, spreads and DOM style writes", () => {
  const rules = { "even/decision-values": "error" };
  const bad = `const base = { padding: 12 }; const style = { ...base, color: "red" }; const View = () => <div style={true ? style : {gap: "5px"}} />; document.body.style.borderRadius = "3px"; document.body.style.setProperty("color", "hotpink"); document.body.style.cssText = "padding: 9px";`;
  assert.equal(lint(bad, rules).length, 6);
  assert.deepEqual(
    lint(
      `const View = ({width}) => <div style={{width, padding: "var(--even-space-inset-default)", opacity: 0.5, gridRow: 1}} />`,
      rules,
    ),
    [],
  );
});

test("comment lint distinguishes comments from strings, URLs, payloads and the CLI shebang", () => {
  const rules = { "even/no-comments": "error" };
  assert.equal(
    lint("// explanation\nconst x = 1; /* explanation */", rules).length,
    2,
  );
  assert.deepEqual(
    lint(
      '#!/usr/bin/env node\nconst url = "https://example.com"; const payload = "/* recorded code */";',
      rules,
    ),
    [],
  );
  const linter = new Linter();
  const result = linter.verifyAndFix("const x = 1/* explain */+2;", [
    { plugins: { even }, rules },
  ]);
  assert.equal(result.messages.length, 0);
  assert.match(result.output, /1\s+\+2/);
});

test("React lint catches dependency omissions, state-reset effects and leaked timers", () => {
  const rules = {
    "hooks/exhaustive-deps": "error",
    "hooks/set-state-in-effect": "error",
    "web/no-leaked-timeout": "error",
  };
  const messages = lint(
    'import {useEffect, useState} from "react"; function View({value}) { const [state,setState]=useState(); useEffect(()=>{setState(value); setTimeout(()=>setState(1),200);},[]); return state; }',
    rules,
  );
  for (const rule of Object.keys(rules))
    assert.ok(
      messages.some((message) => message.ruleId === rule),
      rule,
    );
  assert.deepEqual(
    lint(
      'import {useEffect} from "react"; function View({notify}) { useEffect(()=>{const timer=setTimeout(notify,200); return ()=>clearTimeout(timer);},[notify]); }',
      rules,
    ),
    [],
  );
});

test("new effects require review even when the React import is aliased or namespaced", () => {
  const rules = { "even/reviewed-effects": "error" };
  for (const code of [
    'import {useEffect as effect} from "react"; function View(){effect(()=>{},[])}',
    'import * as R from "react"; function View(){R.useLayoutEffect(()=>{},[])}',
  ])
    assert.equal(lint(code, rules).length, 1);
});

test("deferred-state lint rejects timers, microtasks, frame callbacks and local aliases inside effects", () => {
  const rules = { "even/no-deferred-state-effects": "error" };
  const setup = (body) =>
    `import React, {useEffect as effect, useLayoutEffect, useState, useReducer} from "react"; function View({value}) { const [state,setState]=useState(0); const [other,dispatch]=useReducer((s)=>s,0); ${body} return state; }`;
  for (const body of [
    "effect(()=>{const timer=setTimeout(()=>setState(value),1);return()=>clearTimeout(timer)},[value]);",
    "useLayoutEffect(()=>{const id=requestAnimationFrame(()=>setState(value));return()=>cancelAnimationFrame(id)},[value]);",
    "React.useEffect(()=>queueMicrotask(()=>setState(value)),[value]);",
    "effect(()=>Promise.resolve().then(()=>setState(value)),[value]);",
    "const update=setState; function reset(){update(value)} const later=window.setTimeout; effect(()=>{const id=later(reset,1);return()=>clearTimeout(id)},[value]);",
    "const reset=()=>setState(value); function begin(){return setTimeout(reset,1)} effect(()=>{const id=begin();return()=>clearTimeout(id)},[value]);",
    "effect(()=>{const id=setInterval(()=>dispatch(value),100);return()=>clearInterval(id)},[value]);",
    "effect(()=>queueMicrotask(async()=>{await Promise.resolve();setState(value)}),[value]);",
    "effect(()=>setTimeout(()=>queueMicrotask(()=>setState(value)),1),[value]);",
  ])
    assert.ok(
      lint(setup(body), rules).some(
        (message) => message.ruleId === "even/no-deferred-state-effects",
      ),
      body,
    );
});

test("deferred-state lint preserves browser subscriptions, request debounce, event handlers and shadowed functions", () => {
  const rules = { "even/no-deferred-state-effects": "error" };
  for (const code of [
    'import {useEffect,useState} from "react"; function View(){const [state,setState]=useState(0); useEffect(()=>{const observer=new ResizeObserver(([entry])=>setState(entry.contentRect.width));observer.observe(document.body);return()=>observer.disconnect()},[]);return state}',
    'import {useEffect,useState} from "react"; function View({url}){const [state,setState]=useState(); useEffect(()=>{const controller=new AbortController(); async function load(){setState({loading:true});const response=await fetch(url,{signal:controller.signal});setState(await response.json())} const timer=setTimeout(load,200);return()=>{clearTimeout(timer);controller.abort()}},[url]);return state}',
    'import {useEffect} from "react"; function View({notify}){useEffect(()=>{const timer=setTimeout(notify,100);return()=>clearTimeout(timer)},[notify])}',
    'import {useState} from "react"; function View(){const [state,setState]=useState(false);return <button onClick={()=>setTimeout(()=>setState(true),100)}>{String(state)}</button>}',
    'import {useEffect,useState} from "react"; function View(){const [state,setState]=useState(0); const setTimeout=(fn)=>fn; useEffect(()=>setTimeout(()=>setState(1)),[]);return state}',
  ])
    assert.deepEqual(lint(code, rules), [], code);
});

test("ref-mirroring lint rejects internal copies while preserving DOM work and resource setup", () => {
  const rules = { "even/no-ref-mirroring-effects": "error" };
  const bad =
    'import {useEffect,useRef} from "react"; function View({value}){const latest=useRef(value);useEffect(()=>{latest.current=value},[value]);return null}';
  assert.equal(lint(bad, rules).length, 1);
  for (const code of [
    'import {useEffect,useRef} from "react"; function View({value}){const element=useRef(null);useEffect(()=>{element.current.scrollTop=value},[value]);return <div ref={element}/>}',
    'import {useEffect,useRef} from "react"; function View({url}){const socket=useRef(null);useEffect(()=>{socket.current=new WebSocket(url);return()=>socket.current.close()},[url]);return null}',
  ])
    assert.deepEqual(lint(code, rules), [], code);
});

test("genuine timed state and imperative mirrors require explicit, site-scoped review reasons", () => {
  const site = "fixture.jsx#View.useEffect";
  const plugin = {
    rules: effectRules({
      [site]: {
        timedStateReason: "Reveal a hint only after the requested dwell time.",
        refMirrorReason:
          "The existing imperative SDK reads the committed pointer.",
      },
    }),
  };
  const messages = new Linter().verify(
    'import {useEffect,useState,useRef} from "react"; function View({value}) {const [state,setState]=useState(false); const latest=useRef(value);useEffect(()=>setTimeout(()=>setState(true),200),[]);useEffect(()=>{latest.current=value},[value]);return state}',
    [
      {
        files: ["**/*.jsx"],
        plugins: { review: plugin },
        rules: {
          "review/no-deferred-state-effects": "error",
          "review/no-ref-mirroring-effects": "error",
        },
      },
    ],
    { filename: "fixture.jsx" },
  );
  assert.deepEqual(messages, []);
});

test("CSS gate cannot be disabled by a source comment", async () => {
  const result = await stylelint.lint({
    code: "/* stylelint-disable */ .fixture {padding: 13px; color: red}",
    codeFilename: "frontend/src/components/fixture.css",
  });
  assert.equal(result.errored, true);
  assert.ok(
    result.results[0].warnings.some((message) =>
      message.text.startsWith("padding:"),
    ),
  );
});

test("actual lint configuration covers JSX, scripts, backend and comments without linting generated assets", async () => {
  const eslint = new ESLint();
  for (const filePath of [
    "src/lint-fixture.js",
    "frontend/src/components/LintFixture.jsx",
    "frontend/scripts/lint-fixture.mjs",
  ]) {
    const [result] = await eslint.lintText("// forbidden\nconst x = missing;", {
      filePath,
    });
    assert.ok(
      result.messages.some((message) => message.ruleId === "even/no-comments"),
    );
    assert.ok(result.messages.some((message) => message.ruleId === "no-undef"));
  }
  assert.equal(
    await eslint.isPathIgnored("frontend/src/tokens/generated/tokens.css"),
    true,
  );
});

test("the actual gate catches a deferred state reset even in an existing reviewed effect", async () => {
  const [result] = await new ESLint().lintText(
    'import {useState,useEffect} from "react"; export function useTraceDetail(value){const [state,setState]=useState(0);useEffect(()=>{const timer=setTimeout(()=>setState(value),1);return()=>clearTimeout(timer)},[value]);return state}',
    { filePath: "frontend/src/pages/HomePage/useTraceData.js" },
  );
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === "even/no-deferred-state-effects",
    ),
  );
  assert.ok(
    !result.messages.some(
      (message) => message.ruleId === "even/reviewed-effects",
    ),
  );
});

test("render-time ref access is rejected by the actual React configuration", async () => {
  const [result] = await new ESLint().lintText(
    'import {useRef} from "react"; export function View({value}){const latest=useRef(value);latest.current=value;return <div>{latest.current}</div>}',
    { filePath: "frontend/src/components/LintFixture.jsx" },
  );
  assert.ok(
    result.messages.some((message) => message.ruleId === "react-hooks/refs"),
  );
});
