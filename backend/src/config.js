require('dotenv').config();

const config = {
  port: process.env.PORT || 4000,
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : "*",
  thawaniSecret: process.env.THAWANI_SECRET_KEY || "thawani_secret_key",
  thawaniPublishable:
    process.env.THAWANI_PUBLISHABLE_KEY || "thawani_publishable_key",
  jwtSecret: process.env.JWT_SECRET || "change_me",
  appDeepLink: process.env.APP_DEEP_LINK || "lavish://payment",
  publicUrl: process.env.PUBLIC_URL || "https://s6159rc7-4000.euw.devtunnels.ms",
  appWebReturn: process.env.APP_WEB_RETURN_URL || process.env.PUBLIC_URL || "https://s6159rc7-4000.euw.devtunnels.ms",
  appStoreAndroidUrl:
    process.env.APP_STORE_ANDROID_URL ||
    "https://play.google.com/store/apps/details?id=your.android.package",
  appStoreIosUrl:
    process.env.APP_STORE_IOS_URL ||
    "https://apps.apple.com/app/id000000000",
  resendApiKey: process.env.RESEND_API_KEY || "re_placeholder_key",
};

module.exports = config;
