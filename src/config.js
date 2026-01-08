module.exports = {
  // Bot configuration
  bot: {
    name: process.env.BOT_NAME || 'Abdullah SMS Bot',
    username: process.env.BOT_USERNAME || '',
    admin_id: process.env.TELEGRAM_ADMIN_ID ? parseInt(process.env.TELEGRAM_ADMIN_ID) : null,
    support_chat: process.env.SUPPORT_CHAT || '@AbdullahSMSBotSupport'
  },
  
  // Panel configuration
  panel: {
    url: process.env.PANEL_URL || 'http://135.125.222.224',
    username: process.env.PANEL_USERNAME || 'Adil_Abdullah0',
    password: process.env.PANEL_PASSWORD || 'Adil_Abdullah0',
    base_path: process.env.PANEL_BASE_PATH || '/ints/client/SMSCDRStats',
    timeout: parseInt(process.env.PANEL_TIMEOUT) || 30000,
    retries: parseInt(process.env.PANEL_RETRIES) || 3
  },
  
  // Database configuration
  database: {
    path: process.env.DB_PATH || './data/smsbot.db',
    dialect: process.env.DB_DIALECT || 'sqlite',
    logging: process.env.DB_LOGGING === 'true'
  },
  
  // Redis configuration (optional)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    ttl: parseInt(process.env.REDIS_TTL) || 3600
  },
  
  // Server configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    webhook_url: process.env.WEBHOOK_URL || '',
    webhook_secret: process.env.WEBHOOK_SECRET || ''
  },
  
  // Features configuration
  features: {
    auto_sync: process.env.AUTO_SYNC !== 'false',
    sync_interval: parseInt(process.env.SYNC_INTERVAL) || 300000, // 5 minutes
    otp_check_interval: parseInt(process.env.OTP_CHECK_INTERVAL) || 30000, // 30 seconds
    cleanup_interval: parseInt(process.env.CLEANUP_INTERVAL) || 60000, // 1 minute
    max_numbers_per_user: parseInt(process.env.MAX_NUMBERS_PER_USER) || 3,
    number_reservation_time: parseInt(process.env.NUMBER_RESERVATION_TIME) || 600000, // 10 minutes
    otp_retention_days: parseInt(process.env.OTP_RETENTION_DAYS) || 1
  },
  
  // UI/UX configuration
  ui: {
    default_language: process.env.DEFAULT_LANGUAGE || 'en',
    timezone: process.env.TIMEZONE || 'UTC',
    date_format: process.env.DATE_FORMAT || 'YYYY-MM-DD HH:mm:ss',
    per_page: parseInt(process.env.ITEMS_PER_PAGE) || 10
  },
  
  // Security configuration
  security: {
    captcha_timeout: parseInt(process.env.CAPTCHA_TIMEOUT) || 30000,
    max_login_attempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3,
    session_timeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000 // 1 hour
  },
  
  // Country configuration
  countries: {
    default_country: process.env.DEFAULT_COUNTRY || 'US',
    enabled_countries: process.env.ENABLED_COUNTRIES ? 
      process.env.ENABLED_COUNTRIES.split(',') : []
  }
};
