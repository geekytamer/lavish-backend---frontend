require('dotenv').config();

const config = {
  port: process.env.PORT || 4000,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  thawaniSecret: process.env.THAWANI_SECRET_KEY || "thawani_secret_key",
  thawaniPublishable:
    process.env.THAWANI_PUBLISHABLE_KEY || "thawani_publishable_key",
  jwtSecret: process.env.JWT_SECRET || "change_me",
  appDeepLink: process.env.APP_DEEP_LINK || "lavish://payment",
  publicUrl: process.env.PUBLIC_URL || "http://10.0.2.2:4000",
  appWebReturn: process.env.APP_WEB_RETURN_URL || process.env.PUBLIC_URL || "http://10.0.2.2:4000",
};

module.exports = config;
