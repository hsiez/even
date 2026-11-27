import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { effectSite } from "../lint/effects.mjs";

const effects = {};
const comments = [];
const resources = [];
const reviewSignals = [];
const audit = {
  rules: {
    inventory: {
      create(context) {
        const location = (node) => ({
          file: context.filename.replace(`${context.cwd}/`, ""),
          line: node.loc.start.line,
        });
        return {
          Program() {
            for (const node of context.sourceCode.getAllComments())
              if (node.type !== "Shebang") comments.push(location(node));
          },
          CallExpression(node) {
            const site = effectSite(context, node);
            if (site) effects[site] = (effects[site] ?? 0) + 1;
            const name = node.callee.name ?? node.callee.property?.name;
            if (
              [
                "setTimeout",
                "setInterval",
                "requestAnimationFrame",
                "addEventListener",
                "animate",
              ].includes(name)
            )
              resources.push({ ...location(node), api: name });
            if (
              name === "catch" &&
              node.arguments[0]?.body?.type === "BlockStatement" &&
              node.arguments[0].body.body.length === 0
            )
              reviewSignals.push({
                ...location(node),
                reason:
                  "Empty rejection handler: verify that cancellation is intentionally ignored, not an operational error.",
              });
          },
          NewExpression(node) {
            if (/Observer$/.test(node.callee.name ?? ""))
              resources.push({ ...location(node), api: node.callee.name });
          },
          Identifier(node) {
            if (/hack|workaround|fixme|todo/i.test(node.name))
              reviewSignals.push({
                ...location(node),
                reason: `Review identifier ${node.name}.`,
              });
          },
        };
      },
    },
  },
};
const eslint = new ESLint({
  overrideConfig: [
    { plugins: { audit }, rules: { "audit/inventory": "error" } },
  ],
});
await eslint.lintFiles(["."]);
const reviews = JSON.parse(
  readFileSync(new URL("../lint/effects.json", import.meta.url), "utf8"),
);
const mismatches = [
  ...new Set([...Object.keys(effects), ...Object.keys(reviews)]),
].filter(
  (site) =>
    effects[site] !== reviews[site]?.count ||
    !reviews[site]?.system ||
    !reviews[site]?.cleanup,
);
if (process.argv.includes("--check")) {
  if (mismatches.length) {
    console.error(
      "Effect review inventory is out of date:\n" + mismatches.join("\n"),
    );
    process.exitCode = 1;
  } else
    console.log(
      `Reviewed ${Object.values(effects).reduce((a, b) => a + b, 0)} effect sites; no stale review entries.`,
    );
} else
  console.log(
    JSON.stringify({ comments, effects, resources, reviewSignals }, null, 2),
  );
