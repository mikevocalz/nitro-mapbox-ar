import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// typescript-eslint needs the TypeScript 6 compiler API, which TypeScript 7
// does not ship, so the linter and its TypeScript live in tooling/lint.
const lintRequire = createRequire(new URL('./tooling/lint/package.json', import.meta.url));
const { default: tseslint } = await import(pathToFileURL(lintRequire.resolve('typescript-eslint')).href);

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/nitrogen/generated/**', '**/dist/**', '**/lib/**', 'examples/**', 'tooling/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      // Package code spells fallbacks and mutation out (Margelo api-design).
      'logical-assignment-operators': ['error', 'never'],
      // `void promise` marks a deliberate fire-and-forget; `void 0` as a value stays banned.
      'no-void': ['error', { allowAsStatement: true }],
      // Off: several type imports exist only so JSDoc {@linkcode} targets resolve,
      // which this rule cannot see. tsc already reports truly unused imports.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
