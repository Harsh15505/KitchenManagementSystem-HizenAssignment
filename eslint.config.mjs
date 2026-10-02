// ESLint for shared/ and backend/ (frontend/ has its own Next.js config).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      'frontend/**',
      'vault/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // ADR-004/ADR-023: authorisation comes from permission codes, never role names.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^(admin|kitchen|dispatch|driver)$/]',
          message:
            'Do not branch on role names. Check a permission/CASL ability instead (ADR-023).',
        },
      ],
    },
  },
  {
    // NestJS resolves constructor dependencies from decorator metadata at runtime. An `import type`
    // would be erased and break DI, so this rule must not rewrite backend imports.
    files: ['backend/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  {
    // Seeds legitimately name the default roles they create.
    files: ['**/prisma/seed/**', '**/*.seed.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
