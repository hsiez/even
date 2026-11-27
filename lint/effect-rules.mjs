import { effectSite, reactHook, variable } from "./effects.mjs";

const functions = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);
const schedulers = new Set([
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "queueMicrotask",
]);

const hasReason = (review, field) =>
  typeof review?.[field] === "string" && review[field].trim().length > 0;

function valueOf(context, node, seen = new Set()) {
  if (node?.type === "ChainExpression")
    return valueOf(context, node.expression, seen);
  if (node?.type !== "Identifier") return node;
  const binding = variable(context, node);
  if (!binding || seen.has(binding)) return node;
  seen.add(binding);
  const definition = binding.defs[0]?.node;
  if (definition?.type === "FunctionDeclaration") return definition;
  if (
    definition?.type === "VariableDeclarator" &&
    definition.id.type === "Identifier"
  )
    return valueOf(context, definition.init, seen);
  return node;
}

function hookResult(context, node, hook, index) {
  let resolved = node;
  const seen = new Set();
  while (resolved?.type === "Identifier") {
    const binding = variable(context, resolved);
    if (!binding || seen.has(binding)) break;
    seen.add(binding);
    const declaration = binding.defs[0]?.node;
    if (
      declaration?.type !== "VariableDeclarator" ||
      declaration.id.type !== "Identifier" ||
      declaration.init?.type !== "Identifier"
    )
      break;
    resolved = declaration.init;
  }
  if (resolved?.type !== "Identifier") return false;
  const declaration = variable(context, resolved)?.defs[0]?.node;
  if (
    declaration?.type !== "VariableDeclarator" ||
    declaration.init?.type !== "CallExpression"
  )
    return false;
  if (!hook.includes(reactHook(context, declaration.init))) return false;
  return index === undefined
    ? declaration.id.type === "Identifier"
    : declaration.id.type === "ArrayPattern" &&
        declaration.id.elements[index]?.name === resolved.name;
}

function globalName(context, node) {
  const value = valueOf(context, node);
  if (value?.type === "Identifier" && !variable(context, value)?.defs.length)
    return value.name;
  if (
    value?.type === "MemberExpression" &&
    ["window", "globalThis"].includes(globalName(context, value.object))
  )
    return value.property.name ?? value.property.value;
}

function immediatePromise(context, node) {
  return (
    node?.type === "CallExpression" &&
    node.arguments.length === 0 &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.name === "resolve" &&
    globalName(context, node.callee.object) === "Promise"
  );
}

function scheduledCallback(context, node) {
  if (schedulers.has(globalName(context, node.callee)))
    return node.arguments[0];
  if (
    node.callee.type === "MemberExpression" &&
    (node.callee.property.name ?? node.callee.property.value) === "then" &&
    immediatePromise(context, node.callee.object)
  )
    return node.arguments[0];
}

function inspectSynchronous(context, fn, onCall) {
  let paused = false;
  function walk(node) {
    if (!node || paused || functions.has(node.type)) return;
    if (
      node.type === "AwaitExpression" &&
      !immediatePromise(context, node.argument)
    ) {
      paused = true;
      return;
    }
    if (node.type === "CallExpression") onCall(node);
    for (const key of context.sourceCode.visitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else walk(child);
    }
  }
  const statements =
    fn.body.type === "BlockStatement" ? fn.body.body : [fn.body];
  for (const statement of statements) {
    walk(statement);
    if (
      paused ||
      statement.type === "ReturnStatement" ||
      statement.type === "ThrowStatement"
    )
      break;
  }
}

function writesState(context, callback, seen = new Set()) {
  if (hookResult(context, callback, ["useState", "useReducer"], 1)) return true;
  const fn = valueOf(context, callback);
  if (!fn || !functions.has(fn.type) || seen.has(fn)) return false;
  seen.add(fn);
  let awaitsWork = false;
  function findAwait(node) {
    if (!node || functions.has(node.type)) return;
    if (
      node.type === "AwaitExpression" &&
      !immediatePromise(context, node.argument)
    )
      awaitsWork = true;
    for (const key of context.sourceCode.visitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(findAwait);
      else findAwait(child);
    }
  }
  if (fn.async) findAwait(fn.body);
  if (awaitsWork) return false;
  let writes = false;
  inspectSynchronous(context, fn, (call) => {
    if (
      hookResult(context, call.callee, ["useState", "useReducer"], 1) ||
      writesState(context, call.callee, seen) ||
      writesState(context, scheduledCallback(context, call), seen)
    )
      writes = true;
  });
  return writes;
}

function pureValue(node) {
  if (!node) return true;
  if (["Literal", "Identifier"].includes(node.type)) return true;
  if (node.type === "MemberExpression")
    return (
      ![
        "document",
        "window",
        "globalThis",
        "navigator",
        "performance",
      ].includes(node.object.name) &&
      pureValue(node.object) &&
      (!node.computed || pureValue(node.property))
    );
  if (["BinaryExpression", "LogicalExpression"].includes(node.type))
    return pureValue(node.left) && pureValue(node.right);
  if (node.type === "ConditionalExpression")
    return (
      pureValue(node.test) &&
      pureValue(node.consequent) &&
      pureValue(node.alternate)
    );
  if (node.type === "ArrayExpression") return node.elements.every(pureValue);
  if (node.type === "ObjectExpression")
    return node.properties.every(
      (part) =>
        part.type === "Property" && !part.computed && pureValue(part.value),
    );
  return false;
}

function onlyMirrorsRefs(context, callback) {
  const fn = valueOf(context, callback);
  if (!fn || !functions.has(fn.type)) return false;
  const statements =
    fn.body.type === "BlockStatement"
      ? fn.body.body
      : [{ type: "ExpressionStatement", expression: fn.body }];
  let copies = 0;
  for (const statement of statements) {
    if (
      statement.type === "VariableDeclaration" &&
      statement.declarations.every((declaration) => pureValue(declaration.init))
    )
      continue;
    const expression =
      statement.type === "ExpressionStatement" ? statement.expression : null;
    if (
      expression?.type !== "AssignmentExpression" ||
      expression.operator !== "=" ||
      expression.left.type !== "MemberExpression" ||
      (expression.left.property.name ?? expression.left.property.value) !==
        "current" ||
      !hookResult(context, expression.left.object, ["useRef"]) ||
      !pureValue(expression.right)
    )
      return false;
    copies++;
  }
  return copies > 0;
}

export function effectRules(reviews = {}) {
  return {
    "no-deferred-state-effects": {
      meta: { type: "problem", schema: [] },
      create(context) {
        return {
          CallExpression(node) {
            const site = effectSite(context, node);
            if (!site || hasReason(reviews[site], "timedStateReason")) return;
            const seen = new Set();
            const reported = new Set();
            function inspect(callback) {
              const fn = valueOf(context, callback);
              if (!fn || !functions.has(fn.type) || seen.has(fn)) return;
              seen.add(fn);
              inspectSynchronous(context, fn, (call) => {
                const scheduled = scheduledCallback(context, call);
                if (
                  scheduled &&
                  writesState(context, scheduled) &&
                  !reported.has(call)
                ) {
                  reported.add(call);
                  context.report({
                    node: call,
                    message:
                      "Do not defer React state synchronization with a timer or microtask. Derive the value during render or handle its action directly. A genuine timed UI needs timedStateReason in its effect review.",
                  });
                }
                inspect(call.callee);
              });
            }
            inspect(node.arguments[0]);
          },
        };
      },
    },
    "no-ref-mirroring-effects": {
      meta: { type: "problem", schema: [] },
      create(context) {
        return {
          CallExpression(node) {
            const site = effectSite(context, node);
            if (
              site &&
              !hasReason(reviews[site], "refMirrorReason") &&
              onlyMirrorsRefs(context, node.arguments[0])
            )
              context.report({
                node,
                message:
                  "This effect only mirrors values into refs. Use one state owner or a committed Effect Event for an external callback. An imperative integration that requires this mirror needs refMirrorReason in its effect review.",
              });
          },
        };
      },
    },
  };
}
