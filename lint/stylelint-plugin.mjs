import stylelint from "stylelint";
import { designProblems, isDesignPreview } from "./design-policy.mjs";

const name = "even/decision-values";
export default stylelint.createPlugin(name, (enabled) => (root, result) => {
  if (!enabled) return;
  const file = root.source?.input.file ?? "";
  root.walkComments((node) => {
    stylelint.utils.report({
      ruleName: name,
      result,
      node,
      message: "Move code explanations into documentation.",
    });
  });
  root.walkDecls((node) => {
    const selector = node.parent.selector;
    const hidden =
      file.endsWith("/pages/HomePage/HomePage.css") &&
      [
        ".even-home .even-trace-table caption",
        ".even-home-results-status",
      ].includes(selector);
    const tableCell =
      file.endsWith("/components/components.css") &&
      selector === ":where(.even-trace-table .even-trace-operation)";
    if (
      node.value === "1px" &&
      ((hidden && /^(width|height)$/.test(node.prop)) ||
        (tableCell && node.prop === "height"))
    )
      return;
    for (const message of designProblems(node.prop, node.value, {
      preview: isDesignPreview(file),
    }))
      stylelint.utils.report({
        ruleName: name,
        result,
        node,
        word: node.value,
        message: `${node.prop}: ${message}`,
      });
  });
});
