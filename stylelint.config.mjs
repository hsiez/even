export default {
  ignoreDisables: true,
  plugins: ["./lint/stylelint-plugin.mjs"],
  ignoreFiles: [
    "**/node_modules/**",
    "**/generated/**",
    "**/dist/**",
    "**/storybook-static/**",
  ],
  rules: {
    "even/decision-values": true,
    "color-no-invalid-hex": true,
    "declaration-block-no-duplicate-properties": true,
    "block-no-empty": true,
    "comment-no-empty": true,
  },
};
