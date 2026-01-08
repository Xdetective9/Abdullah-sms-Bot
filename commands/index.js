const StartCommand = require('./start');
const NumbersCommand = require('./numbers');
const OTPCommand = require('./otp');
const AdminCommand = require('./admin');
const CountriesCommand = require('./countries');
const HelpCommand = require('./help');

class Commands {
  constructor(bot, db, panel, logger) {
    this.bot = bot;
    this.db = db;
    this.panel = panel;
    this.logger = logger;
    
    // Initialize command handlers
    this.startCommand = new StartCommand(bot, db, logger);
    this.numbersCommand = new NumbersCommand(bot, db, logger);
    this.otpCommand = new OTPCommand(bot, db, logger);
    this.adminCommand = new AdminCommand(bot, db, panel, logger);
    this.countriesCommand = new CountriesCommand(bot, db, logger);
    this.helpCommand = new HelpCommand(bot, db, logger);
  }

  setup() {
    // Setup all commands
    this.startCommand.setup();
    this.numbersCommand.setup();
    this.otpCommand.setup();
    this.adminCommand.setup();
    this.countriesCommand.setup();
    this.helpCommand.setup();
    
    // Setup common handlers
    this.setupCommonHandlers();
    
    this.logger.info('Commands setup completed');
  }

  setupCommonHandlers() {
    // Handle /ping command
    this.bot.onText(/\/ping/, (msg) => {
      const start = Date.now();
      this.bot.sendMessage(msg.chat.id, 'Pong!').then(() => {
        const latency = Date.now() - start;
        this.bot.sendMessage(msg.chat.id, `🏓 Pong! Latency: ${latency}ms`);
      });
    });

    // Handle /stats command
    this.bot.onText(/\/stats/, async (msg) => {
      const stats = await this.db.getStatistics();
      
      const message = `
📊 *Bot Statistics*

🌍 Countries: ${stats.totalCountries}
📱 Total Numbers: ${stats.totalNumbers}
✅ Available: ${stats.availableNumbers}
📨 Total OTPs: ${stats.totalOTPs}
👥 Active Users: ${stats.activeUsers}

🔄 Last Sync: ${stats.lastSync || 'Never'}
⏰ Uptime: ${Math.floor(process.uptime() / 60)} minutes
      `;
      
      this.bot.sendMessage(msg.chat.id, message, {
        parse_mode: 'Markdown'
      });
    });
  }

  async handleCallbackQuery(callbackQuery) {
    const data = callbackQuery.data;
    
    // Route callback query to appropriate handler
    if (data.startsWith('country_')) {
      await this.countriesCommand.handleCallback(callbackQuery);
    } else if (data.startsWith('number_')) {
      await this.numbersCommand.handleCallback(callbackQuery);
    } else if (data.startsWith('otp_')) {
      await this.otpCommand.handleCallback(callbackQuery);
    } else if (data.startsWith('admin_')) {
      await this.adminCommand.handleCallback(callbackQuery);
    } else {
      // Handle general callbacks
      await this.handleGeneralCallback(callbackQuery);
    }
  }

  async handleGeneralCallback(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    switch (data) {
      case 'main_menu':
        await this.startCommand.sendMainMenu(chatId);
        break;
        
      case 'refresh':
        await this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
        break;
        
      case 'close':
        await this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
        break;
        
      default:
        this.logger.warn(`Unhandled callback data: ${data}`);
    }
  }
}

module.exports = Commands;
