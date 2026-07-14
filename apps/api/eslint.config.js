import base from '@storyme/eslint-config';

export default [
  ...base,
  {
    rules: {
      // NestJS relies heavily on decorators + constructor injection.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
