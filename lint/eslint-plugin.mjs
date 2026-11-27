import {
  designProblems,
  cssProperty,
  isDesignPreview,
} from "./design-policy.mjs";
import { parse } from "postcss";
import { readFileSync } from "node:fs";
import { effectSite } from "./effects.mjs";
import { effectRules } from "./effect-rules.mjs";

const reviewedEffects = JSON.parse(
  readFileSync(new URL("./effects.json", import.meta.url), "utf8"),
);

export default {
  rules: {
    ...effectRules(reviewedEffects),
    "reviewed-effects": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const counts = new Map();
        return {
          CallExpression(node) {
            const site = effectSite(context, node);
            if (!site) return;
            const count = (counts.get(site) ?? 0) + 1;
            counts.set(site, count);
            const review = reviewedEffects[site];
            if (!review?.system || !review?.cleanup || count > review.count)
              context.report({
                node,
                message: `Review this effect before adding it: document its external system and resource cleanup in lint/effects.json (${site}).`,
              });
          },
        };
      },
    },
    "decision-values": {
      meta: { type: "problem", schema: [] },
      create(context) {
        if (/\.test\.|\/test\/|\/tokens\//.test(context.filename)) return {};
        function check(node, property, value) {
          if (property === "cssText") {
            try {
              parse(String(value)).walkDecls((declaration) =>
                check(node, declaration.prop, declaration.value),
              );
            } catch {
              context.report({
                node,
                message: "Cannot inspect malformed inline CSS.",
              });
            }
            return;
          }
          for (const message of designProblems(property, value, {
            preview: isDesignPreview(context.filename),
          }))
            context.report({ node, message: `${property}: ${message}` });
        }
        function object(node, seen = new Set()) {
          if (!node || seen.has(node)) return;
          seen.add(node);
          if (node.type === "Identifier") {
            let scope = context.sourceCode.getScope(node);
            while (scope) {
              const variable = scope.set.get(node.name);
              if (variable) {
                for (const definition of variable.defs)
                  object(definition.node.init, seen);
                break;
              }
              scope = scope.upper;
            }
            return;
          }
          if (node.type === "ConditionalExpression") {
            object(node.consequent, seen);
            object(node.alternate, seen);
            return;
          }
          if (node.type === "LogicalExpression") {
            object(node.left, seen);
            object(node.right, seen);
            return;
          }
          if (node.type === "ArrayExpression") {
            for (const item of node.elements) object(item, seen);
            return;
          }
          if (node?.type !== "ObjectExpression") return;
          for (const part of node.properties) {
            if (part.type === "SpreadElement") {
              object(part.argument, seen);
              continue;
            }
            if (part.type !== "Property" || part.computed) continue;
            const property = part.key.name ?? part.key.value;
            if (part.value.type === "Literal") {
              if (
                typeof part.value.value === "number" &&
                part.value.value !== 0 &&
                /^(duration|padding|margin|gap|(?:min-|max-)?(?:width|height)|border.*(?:width|radius)|top|left|right|bottom|inset)/.test(
                  cssProperty(property),
                )
              )
                context.report({
                  node: part.value,
                  message: `${property}: Use a spacing or sizing decision instead of an inline pixel value.`,
                });
              else check(part.value, property, part.value.value);
            } else if (part.value.type === "TemplateLiteral") {
              for (const quasi of part.value.quasis)
                check(quasi, property, quasi.value.cooked);
            }
          }
        }
        return {
          JSXAttribute(node) {
            if (
              node.name.name === "style" &&
              node.value?.type === "JSXExpressionContainer"
            )
              object(node.value.expression);
          },
          CallExpression(node) {
            const callee = node.callee;
            if (
              callee.type === "MemberExpression" &&
              (callee.property.name ?? callee.property.value) === "animate"
            ) {
              for (const argument of node.arguments) object(argument);
            }
            if (
              callee.type !== "MemberExpression" ||
              (callee.property.name ?? callee.property.value) !==
                "setProperty" ||
              callee.object.type !== "MemberExpression" ||
              (callee.object.property.name ?? callee.object.property.value) !==
                "style"
            )
              return;
            const property = node.arguments[0]?.value;
            const value = node.arguments[1];
            if (typeof property === "string" && value?.type === "Literal")
              check(value, property, value.value);
          },
          AssignmentExpression(node) {
            const target = node.left;
            if (
              target.type !== "MemberExpression" ||
              target.object.type !== "MemberExpression" ||
              (target.object.property.name ?? target.object.property.value) !==
                "style"
            )
              return;
            if (node.right.type === "Literal")
              check(
                node.right,
                target.property.name ?? target.property.value,
                node.right.value,
              );
          },
        };
      },
    },
    "no-comments": {
      meta: { type: "suggestion", fixable: "code", schema: [] },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (comment.type === "Shebang") continue;
              context.report({
                loc: comment.loc,
                message:
                  "Move explanations into documentation; express behavior in names and tests.",
                fix: (fixer) =>
                  fixer.replaceTextRange(
                    comment.range,
                    context.sourceCode.text
                      .slice(...comment.range)
                      .replace(/[^\r\n]/g, " "),
                  ),
              });
            }
          },
        };
      },
    },
    "jsx-uses-vars": {
      meta: { schema: [] },
      create(context) {
        return {
          JSXOpeningElement(node) {
            let name = node.name;
            while (name.type === "JSXMemberExpression") name = name.object;
            if (name.type === "JSXIdentifier" && /^[A-Z]/.test(name.name))
              context.sourceCode.markVariableAsUsed(name.name, node);
          },
        };
      },
    },
  },
};
