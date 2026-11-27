import js from "@eslint/js";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";
import web from "eslint-plugin-react-web-api";
import even from "./lint/eslint-plugin.mjs";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/storybook-static/**",
      "**/generated/**",
      "**/.even/**",
      "**/coverage/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.node,
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
    plugins: { even },
    rules: {
      ...js.configs.recommended.rules,
      "even/no-comments": "error",
      "even/jsx-uses-vars": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^React$",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["frontend/**/*.{js,jsx,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["frontend/src/**/*.{js,jsx}", "frontend/.storybook/**/*.{js,jsx}"],
    plugins: { "react-hooks": hooks, "react-web-api": web },
    rules: {
      "even/decision-values": "error",
      "even/reviewed-effects": "error",
      "even/no-deferred-state-effects": "error",
      "even/no-ref-mirroring-effects": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "no-implied-eval": "error",
      "react-web-api/no-leaked-timeout": "error",
      "react-web-api/no-leaked-interval": "error",
      "react-web-api/no-leaked-event-listener": "error",
      "react-web-api/no-leaked-resize-observer": "error",
      "react-web-api/no-leaked-intersection-observer": "error",
      "react-web-api/no-leaked-fetch": "error",
    },
  },
];
