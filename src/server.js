const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

class Server {
  constructor(bot, logger) {
    this.bot = bot;
    this.logger = logger;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    
    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => this.logger.http(message.trim())
      }
    }));
    
    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'abdullah-sms-bot',
        version: process.env.npm_package_version || '1.0.0'
      });
    });
    
    // Webhook endpoint for Telegram
    this.app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
      this.bot.bot.processUpdate(req.body);
      res.sendStatus(200);
    });
    
    // API endpoints
    this.app.get('/api/status', async (req, res) => {
      try {
        const stats = await this.bot.db.getStatistics();
        res.json({
          success: true,
          data: {
            ...stats,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        this.logger.error('Error getting status:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });
    
    // Static files (for admin panel if needed)
    this.app.use('/static', express.static(path.join(__dirname, '../public')));
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
    
    // Error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Server error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  async start() {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, () => {
        this.logger.info(`Server running on http://${host}:${port}`);
        resolve();
      });
      
      this.server.on('error', (error) => {
        this.logger.error('Server failed to start:', error);
        reject(error);
      });
    });
  }

  async stop() {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error) => {
          if (error) {
            this.logger.error('Error stopping server:', error);
            reject(error);
          } else {
            this.logger.info('Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Server;
