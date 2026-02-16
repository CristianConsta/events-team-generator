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
