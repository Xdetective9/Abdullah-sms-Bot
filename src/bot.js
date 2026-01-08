const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const PanelManager = require('./panel');
const Database = require('./database');
const CaptchaSolver = require('./captcha');
const winston = require('winston');
const express = require('express');

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Initialize bot
let bot;
if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  bot.setWebHook(`${process.env.WEBHOOK_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`);
} else {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
}

// Initialize components
const db = new Database(logger);
const panel = new PanelManager(logger);
const captchaSolver = new CaptchaSolver(bot, logger);

class AbdullahSMSBot {
  constructor() {
    this.userSessions = new Map();
    this.init();
  }

  async init() {
    try {
      // Initialize database
      await db.initialize();
      
      // Load panel data
      await this.loadPanelData();
      
      // Start background jobs
      this.startBackgroundJobs();
      
      // Setup bot commands
      this.setupCommands();
      
      logger.info('Abdullah SMS Bot initialized successfully');
      
      // Start Express server for webhook if in production
      if (process.env.NODE_ENV === 'production') {
        this.startExpressServer();
      }
      
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  async loadPanelData() {
    try {
      // Authenticate with panel
      const isAuthenticated = await panel.authenticate();
      
      if (isAuthenticated) {
        // Load countries and numbers
        await this.updateCountries();
        await this.updateNumbers();
        
        // Check for new OTPs
        await this.checkNewOTPs();
        
        logger.info('Panel data loaded successfully');
      } else {
        logger.warn('Failed to authenticate with panel');
      }
    } catch (error) {
      logger.error('Error loading panel data:', error);
    }
  }

  setupCommands() {
    // Start command
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Check if user is admin
      const isAdmin = userId.toString() === process.env.TELEGRAM_ADMIN_ID;
      
      const welcomeMessage = `
🌟 *Welcome to Abdullah SMS Bot* 🌟

*Your Personal SMS/OTP Management System*

📱 *Features:*
• Get SMS numbers by country
• Receive OTP notifications
• Copy OTP with one click
• Manage your numbers
• Real-time updates

🎯 *Available Commands:*
/getnumbers - Browse available numbers
/myotps - View received OTPs
/countries - Browse by country
/help - Show help menu
${isAdmin ? '/admin - Admin panel' : ''}

💡 *How to use:*
1. Select a country
2. Choose a number
3. Use it for OTP verification
4. Receive OTP instantly here
5. Copy with one click!

Developed with ❤️ for seamless OTP management.
      `;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🌍 Browse Countries', callback_data: 'browse_countries' },
            { text: '📱 My Numbers', callback_data: 'my_numbers' }
          ],
          [
            { text: '🔔 Recent OTPs', callback_data: 'recent_otps' },
            { text: '⚙️ Settings', callback_data: 'settings' }
          ],
          isAdmin ? [
            { text: '👨‍💼 Admin Panel', callback_data: 'admin_panel' }
          ] : []
        ]
      };
      
      bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    });

    // Get numbers command
    bot.onText(/\/getnumbers/, async (msg) => {
      await this.showCountriesMenu(msg.chat.id);
    });

    // My OTPs command
    bot.onText(/\/myotps/, async (msg) => {
      await this.showUserOTPs(msg.chat.id, msg.from.id);
    });

    // Countries command
    bot.onText(/\/countries/, async (msg) => {
      await this.showCountriesList(msg.chat.id);
    });

    // Admin command
    bot.onText(/\/admin/, async (msg) => {
      if (msg.from.id.toString() === process.env.TELEGRAM_ADMIN_ID) {
        await this.showAdminPanel(msg.chat.id);
      }
    });

    // Handle callback queries
    bot.on('callback_query', async (callbackQuery) => {
      const message = callbackQuery.message;
      const data = callbackQuery.data;
      const chatId = message.chat.id;
      const userId = callbackQuery.from.id;
      
      try {
        await this.handleCallbackQuery(chatId, userId, data, callbackQuery.id);
      } catch (error) {
        logger.error('Error handling callback query:', error);
        bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ An error occurred. Please try again.',
          show_alert: true
        });
      }
    });

    // Handle messages (for captcha solving)
    bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        await captchaSolver.handleMessage(msg);
      }
    });
  }

  async handleCallbackQuery(chatId, userId, data, callbackQueryId) {
    const parts = data.split(':');
    const action = parts[0];
    
    switch (action) {
      case 'browse_countries':
        await this.showCountriesMenu(chatId);
        break;
        
      case 'select_country':
        const countryCode = parts[1];
        await this.showCountryNumbers(chatId, countryCode);
        break;
        
      case 'select_number':
        const numberId = parts[1];
        await this.selectNumber(chatId, userId, numberId);
        break;
        
      case 'copy_otp':
        const otpId = parts[1];
        await this.copyOTP(chatId, otpId, callbackQueryId);
        break;
        
      case 'refresh_otps':
        await this.refreshOTPs(chatId, userId);
        break;
        
      case 'admin_panel':
        if (userId.toString() === process.env.TELEGRAM_ADMIN_ID) {
          await this.showAdminPanel(chatId);
        }
        break;
        
      case 'add_country':
        await this.addCountryPrompt(chatId);
        break;
        
      case 'view_stats':
        await this.showStats(chatId);
        break;
        
      default:
        bot.answerCallbackQuery(callbackQueryId, {
          text: 'Action not recognized',
          show_alert: false
        });
    }
    
    bot.answerCallbackQuery(callbackQueryId);
  }

  async showCountriesMenu(chatId) {
    const countries = await db.getCountries();
    
    if (!countries || countries.length === 0) {
      return bot.sendMessage(chatId, '🌍 *No countries available yet*\n\nPlease check back later or contact admin to add countries.', {
        parse_mode: 'Markdown'
      });
    }
    
    // Create inline keyboard with countries
    const keyboard = {
      inline_keyboard: []
    };
    
    // Group countries in rows of 2
    for (let i = 0; i < countries.length; i += 2) {
      const row = [];
      if (countries[i]) {
        row.push({
          text: `${countries[i].flag || '🇺🇸'} ${countries[i].name}`,
          callback_data: `select_country:${countries[i].code}`
        });
      }
      if (countries[i + 1]) {
        row.push({
          text: `${countries[i + 1].flag || '🇺🇸'} ${countries[i + 1].name}`,
          callback_data: `select_country:${countries[i + 1].code}`
        });
      }
      keyboard.inline_keyboard.push(row);
    }
    
    // Add back button
    keyboard.inline_keyboard.push([
      { text: '🔙 Back to Main', callback_data: 'main_menu' }
    ]);
    
    bot.sendMessage(chatId, '🌍 *Select a Country*\n\nChoose a country to browse available numbers:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async showCountryNumbers(chatId, countryCode) {
    const country = await db.getCountry(countryCode);
    const numbers = await db.getNumbersByCountry(countryCode);
    
    if (!numbers || numbers.length === 0) {
      return bot.sendMessage(chatId, `📱 *No numbers available for ${country.name}*\n\nPlease check back later or try another country.`, {
        parse_mode: 'Markdown'
      });
    }
    
    // Create message with country info
    let message = `*${country.flag || '🇺🇸'} ${country.name}*\n\n`;
    message += `📊 Total Numbers: ${numbers.length}\n`;
    message += `🎯 Available: ${numbers.filter(n => n.status === 'available').length}\n\n`;
    message += '*Available Numbers:*\n\n';
    
    // Create inline keyboard for numbers
    const keyboard = {
      inline_keyboard: []
    };
    
    numbers.forEach((number, index) => {
      if (number.status === 'available') {
        const buttonText = `📱 ${number.number} (${number.service || 'Unknown'})`;
        keyboard.inline_keyboard.push([
          {
            text: buttonText,
            callback_data: `select_number:${number.id}`
          }
        ]);
      }
    });
    
    // Add back button
    keyboard.inline_keyboard.push([
      { text: '🔙 Back to Countries', callback_data: 'browse_countries' }
    ]);
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async selectNumber(chatId, userId, numberId) {
    const number = await db.getNumber(numberId);
    
    if (!number) {
      return bot.sendMessage(chatId, '❌ Number not found.');
    }
    
    // Mark number as reserved for this user
    await db.reserveNumber(numberId, userId);
    
    const message = `
✅ *Number Selected Successfully!*

📱 *Number:* \`${number.number}\`
🌍 *Country:* ${number.country_name}
🔄 *Service:* ${number.service || 'Unknown'}
⏰ *Expires:* 10 minutes
📝 *Status:* Reserved for you

💡 *How to use:*
1. Use this number for OTP verification
2. OTP will appear here automatically
3. Click "Copy OTP" when it arrives

⚠️ *Note:* This number will be released after 10 minutes if not used.
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 Copy Number', callback_data: `copy_number:${number.id}` }
        ],
        [
          { text: '🔄 Get Another', callback_data: 'browse_countries' },
          { text: '📊 My Numbers', callback_data: 'my_numbers' }
        ]
      ]
    };
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async showUserOTPs(chatId, userId) {
    const otps = await db.getUserOTPs(userId);
    
    if (!otps || otps.length === 0) {
      return bot.sendMessage(chatId, '📭 *No OTPs Received Yet*\n\nUse a number to receive OTPs here.', {
        parse_mode: 'Markdown'
      });
    }
    
    let message = `📨 *Your Recent OTPs*\n\n`;
    
    otps.forEach((otp, index) => {
      const timeAgo = this.formatTimeAgo(otp.received_at);
      message += `*${index + 1}. ${otp.service || 'Unknown Service'}*\n`;
      message += `📱 From: \`${otp.number}\`\n`;
      message += `🔢 OTP: \`${otp.otp_code}\`\n`;
      message += `⏰ ${timeAgo}\n`;
      message += `━━━━━━━━━━━━━━\n`;
    });
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'refresh_otps' },
          { text: '🌍 Get New Number', callback_data: 'browse_countries' }
        ]
      ]
    };
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async copyOTP(chatId, otpId, callbackQueryId) {
    const otp = await db.getOTP(otpId);
    
    if (!otp) {
      return bot.answerCallbackQuery(callbackQueryId, {
        text: 'OTP not found',
        show_alert: true
      });
    }
    
    bot.answerCallbackQuery(callbackQueryId, {
      text: `OTP ${otp.otp_code} copied to clipboard!`,
      show_alert: true
    });
    
    // Send the OTP in a way that Telegram clients can easily copy
    bot.sendMessage(chatId, `📋 *OTP Copied!*\n\n\`${otp.otp_code}\`\n\nFrom: ${otp.service}\nNumber: \`${otp.number}\``, {
      parse_mode: 'Markdown'
    });
  }

  async showAdminPanel(chatId) {
    const stats = await db.getStatistics();
    
    const message = `
👨‍💼 *Admin Panel*

📊 *Statistics:*
• Total Countries: ${stats.totalCountries}
• Total Numbers: ${stats.totalNumbers}
• Available Numbers: ${stats.availableNumbers}
• Total OTPs: ${stats.totalOTPs}
• Active Users: ${stats.activeUsers}

⚙️ *Admin Actions:*
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Add Country', callback_data: 'add_country' },
          { text: '📊 View Stats', callback_data: 'view_stats' }
        ],
        [
          { text: '🔄 Sync Panel', callback_data: 'sync_panel' },
          { text: '📋 Export Data', callback_data: 'export_data' }
        ],
        [
          { text: '🔙 Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async checkNewOTPs() {
    try {
      const newOTPs = await panel.getNewOTPs();
      
      for (const otpData of newOTPs) {
        // Save OTP to database
        const otp = await db.saveOTP(otpData);
        
        // Find user who reserved this number
        const user = await db.getUserByReservedNumber(otpData.number);
        
        if (user) {
          // Notify user
          await this.notifyUserOfOTP(user.telegram_id, otp);
        }
        
        // Also notify admin
        if (process.env.TELEGRAM_ADMIN_ID) {
          await this.notifyAdminOfOTP(otp);
        }
      }
    } catch (error) {
      logger.error('Error checking new OTPs:', error);
    }
  }

  async notifyUserOfOTP(userId, otp) {
    const message = `
🔔 *New OTP Received!*

📱 *From:* ${otp.service || 'Unknown Service'}
🔢 *Number:* \`${otp.number}\`
💬 *Message:* ${otp.message || 'N/A'}
⏰ *Time:* ${new Date(otp.received_at).toLocaleTimeString()}

*OTP Code:*
\`${otp.otp_code}\`
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: '📋 Copy OTP', 
            callback_data: `copy_otp:${otp.id}`
          }
        ]
      ]
    };
    
    try {
      await bot.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      logger.error('Error notifying user:', error);
    }
  }

  async notifyAdminOfOTP(otp) {
    const message = `
👨‍💼 *Admin Notification: New OTP*

📱 Number: \`${otp.number}\`
🔢 OTP: \`${otp.otp_code}\`
🏢 Service: ${otp.service || 'Unknown'}
👤 User: ${otp.user_id ? 'Yes' : 'No'}
⏰ Time: ${new Date(otp.received_at).toLocaleString()}
    `;
    
    try {
      await bot.sendMessage(process.env.TELEGRAM_ADMIN_ID, message, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error notifying admin:', error);
    }
  }

  startBackgroundJobs() {
    // Check for new OTPs every 30 seconds
    setInterval(async () => {
      await this.checkNewOTPs();
    }, parseInt(process.env.UPDATE_INTERVAL) || 30000);
    
    // Update panel data every 5 minutes
    setInterval(async () => {
      await this.loadPanelData();
    }, 5 * 60 * 1000);
    
    // Clean up expired reservations every minute
    setInterval(async () => {
      await db.cleanupExpiredReservations();
    }, 60 * 1000);
  }

  startExpressServer() {
    const app = express();
    const port = process.env.PORT || 3000;
    
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Webhook endpoint
    app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
    
    app.listen(port, () => {
      logger.info(`Webhook server listening on port ${port}`);
    });
  }

  formatTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval} year${interval > 1 ? 's' : ''} ago`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval} month${interval > 1 ? 's' : ''} ago`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval} day${interval > 1 ? 's' : ''} ago`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval} hour${interval > 1 ? 's' : ''} ago`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval} minute${interval > 1 ? 's' : ''} ago`;
    
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  }

  async updateCountries() {
    try {
      const countriesData = await panel.getCountries();
      await db.updateCountries(countriesData);
    } catch (error) {
      logger.error('Error updating countries:', error);
    }
  }

  async updateNumbers() {
    try {
      const numbersData = await panel.getNumbers();
      await db.updateNumbers(numbersData);
    } catch (error) {
      logger.error('Error updating numbers:', error);
    }
  }
}

// Start the bot
const smsBot = new AbdullahSMSBot();

// Export for serverless deployments
module.exports = smsBot;
