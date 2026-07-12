require('dotenv').config();

const config = {
  port: process.env.PORT || 4000,
  corsOrigin: process.env.CORS_ORIGIN
    ? [
      ...process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
      "https://lavishlook.app",
      "https://www.lavishlook.app",
      "https://dashboard.lavishlook.app",
      "https://admin.lavishlook.app",
      "https://api.lavishlook.app"
    ]
    : "*",
  thawaniSecret: process.env.THAWANI_SECRET_KEY || "thawani_secret_key",
  thawaniPublishable:
    process.env.THAWANI_PUBLISHABLE_KEY || "thawani_publishable_key",
  jwtSecret: process.env.JWT_SECRET || "change_me",
  appDeepLink: process.env.APP_DEEP_LINK || "lavish://payment",
  // Public origin that serves uploaded media. Leave PUBLIC_URL unset to serve
  // media from whatever host the API is reached on (correct for local/LAN); set
  // it to your CDN/domain in production. No stale default.
  publicUrl: process.env.PUBLIC_URL || "",
  appWebReturn: process.env.APP_WEB_RETURN_URL || process.env.PUBLIC_URL || "",
  appStoreAndroidUrl:
    process.env.APP_STORE_ANDROID_URL ||
    "https://play.google.com/store/apps/details?id=your.android.package",
  appStoreIosUrl:
    process.env.APP_STORE_IOS_URL ||
    "https://apps.apple.com/app/id000000000",
  resendApiKey: process.env.RESEND_API_KEY || "re_placeholder_key",
};

module.exports = config;
