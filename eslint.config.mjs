import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  rules: {
    "@typescript-eslint/no-dynamic-delete": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-require-imports": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "import/first": "warn",
    "no-control-regex": "warn",
    "no-empty": "warn",
    "vue/no-deprecated-filter": "warn",
  },
});
