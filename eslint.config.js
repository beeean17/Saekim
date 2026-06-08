import tseslint from 'typescript-eslint';

const featureBoundaryMessage = 'feature 간 결합은 dependsOn 선언과 index 배럴을 통해서만.';
const coreBoundaryMessage = 'core는 features 또는 platform을 직접 import하지 않는다.';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    files: ['src/features/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./(?!\\.\\.)[^/]+/.+',
              message: featureBoundaryMessage,
            },
            {
              group: ['../../features/*/*', '../../../features/*/*', 'src/features/*/*'],
              message: featureBoundaryMessage,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../features/*',
                '../features/*/*',
                '../../features/*',
                '../../features/*/*',
                '../../../features/*',
                '../../../features/*/*',
                '../platform/*',
                '../platform/*/*',
                '../../platform/*',
                '../../platform/*/*',
                '../../../platform/*',
                '../../../platform/*/*',
                'src/features/*',
                'src/features/*/*',
                'src/platform/*',
                'src/platform/*/*',
              ],
              message: coreBoundaryMessage,
            },
          ],
        },
      ],
    },
  },
];
