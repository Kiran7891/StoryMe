import base from '@storyme/eslint-config';

export default [
  ...base,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  { ignores: ['.expo/**', 'expo-env.d.ts', 'babel.config.js', 'metro.config.js'] },
];
