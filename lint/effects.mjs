import { relative } from "node:path";

export function variable(context, node, name = node.name) {
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    if (scope.set.has(name)) return scope.set.get(name);
    scope = scope.upper;
  }
}

export function reactHook(context, node) {
  const callee = node.callee;
  let hook;
  if (callee.type === "Identifier") {
    const definition = variable(context, node, callee.name)?.defs[0];
    if (definition?.parent?.source?.value === "react")
      hook = definition.node.imported?.name;
  } else if (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier"
  ) {
    const definition = variable(context, node, callee.object.name)?.defs[0];
    if (definition?.parent?.source?.value === "react")
      hook = callee.property.name ?? callee.property.value;
  }
  return hook;
}

export function effectSite(context, node) {
  const hook = reactHook(context, node);
  if (!["useEffect", "useLayoutEffect", "useInsertionEffect"].includes(hook))
    return;
  let owner = "module";
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (/Function/.test(parent.type)) {
      owner =
        parent.id?.name ??
        (parent.parent.type === "VariableDeclarator"
          ? parent.parent.id.name
          : parent.parent.key?.name) ??
        "anonymous";
      break;
    }
  }
  return `${relative(context.cwd, context.filename).replaceAll("\\", "/")}#${owner}.${hook}`;
}
