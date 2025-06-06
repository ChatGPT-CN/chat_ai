const path = require('path');

module.exports = {
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en', 'ko', 'ja', 'fr', 'de', 'ru'],
    localePath: path.resolve('./public/locales'),
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};
