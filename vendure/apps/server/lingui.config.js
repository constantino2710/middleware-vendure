/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  locales: ['en'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
    },
  ],
  format: 'po',
};
