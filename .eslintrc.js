module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  },
  overrides: [
    {
      files: ['src/renderer/**/*.js'],
      env: {
        browser: true,
        node: false
      },
      globals: {
        electronAPI: 'readonly'
      }
    },
    {
      files: ['src/main/**/*.js', 'src/preload/**/*.js'],
      env: {
        browser: false,
        node: true
      }
    }
  ]
};

