module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { args: 'none' }],
  },
  overrides: [
    {
      files: ['app.js', 'firebase-module.js', 'js/app-init.js', 'js/core/i18n.js'],
      rules: {
        'no-undef': 'off',
        'no-inner-declarations': 'off',
      },
    },
    {
      files: ['*.mjs', 'js/**/*.mjs'],
      parserOptions: {
        sourceType: 'module',
      },
    },
    {
      files: ['tests/**/*.js'],
      env: {
        node: true,
        browser: false,
      },
    },
  ],
};
