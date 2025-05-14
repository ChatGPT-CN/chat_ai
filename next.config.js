/** @type {import("next").NextConfig} */
const { i18n: i18nConfig } = require("./next-i18next.config.js"); // Rename to avoid conflict

const nextConfig = {
  // Pass only the i18n properties Next.js understands directly (defaultLocale, locales)
  // next-i18next handles localePath internally when serverSideTranslations is used.
  i18n: {
    defaultLocale: i18nConfig.defaultLocale,
    locales: i18nConfig.locales,
  },
  reactStrictMode: true,
  // Other configurations remain the same
};

module.exports = nextConfig;

