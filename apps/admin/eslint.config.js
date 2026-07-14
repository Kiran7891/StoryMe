import base from '@storyme/eslint-config';

export default [
  ...base,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  { ignores: ['.next/**', 'next-env.d.ts'] },
];
