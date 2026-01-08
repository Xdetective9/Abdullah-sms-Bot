#!/usr/bin/env node
require('dotenv').config();
const winston = require('winston');
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'abdullah-sms-bot' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Import and start the bot
const Bot = require('./bot');
const Server = require('./server');

async function start() {
  try {
    logger.info('Starting Abdullah SMS Bot...');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Create logs directory if it doesn't exist
    const fs = require('fs');
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize bot
    const bot = new Bot(logger);
    await bot.initialize();
    
    // Start server if in production with webhook
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
      const server = new Server(bot, logger);
      await server.start();
    }
    
    logger.info('Abdullah SMS Bot started successfully!');
    logger.info('Bot Name:', process.env.BOT_NAME || 'Abdullah SMS Bot');
    logger.info('Admin ID:', process.env.TELEGRAM_ADMIN_ID || 'Not set');
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  start();
}

module.exports = { start };
