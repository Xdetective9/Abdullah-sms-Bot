const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

class Database {
  constructor(logger) {
    this.logger = logger;
    this.sequelize = null;
    this.models = {};
  }

  async initialize() {
    try {
      // Use SQLite for simplicity, can be switched to PostgreSQL for production
      this.sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DB_PATH || './data/smsbot.db',
        logging: this.logger.debug.bind(this.logger)
      });

      // Define models
      this.defineModels();
      
      // Sync database
      await this.sequelize.sync({ alter: true });
      
      this.logger.info('Database initialized successfully');
      
    } catch (error) {
      this.logger.error('Database initialization error:', error);
      throw error;
    }
  }

  defineModels() {
    // Countries model
    this.models.Country = this.sequelize.define('Country', {
      code: {
        type: DataTypes.STRING,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      flag: {
        type: DataTypes.STRING,
        defaultValue: '🏳️'
      },
      numbers_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      }
    });

    // Numbers model
    this.models.Number = this.sequelize.define('Number', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      country_code: {
        type: DataTypes.STRING,
        allowNull: false
      },
      country_name: {
        type: DataTypes.STRING
      },
      service: {
        type: DataTypes.STRING
      },
      range: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.ENUM('available', 'reserved', 'busy'),
        defaultValue: 'available'
      },
      reserved_by: {
        type: DataTypes.INTEGER // Telegram user ID
      },
      reserved_until: {
        type: DataTypes.DATE
      },
      added_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    // OTPs model
    this.models.OTP = this.sequelize.define('OTP', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      number: {
        type: DataTypes.STRING,
        allowNull: false
      },
      otp_code: {
        type: DataTypes.STRING,
        allowNull: false
      },
      service: {
        type: DataTypes.STRING
      },
      message: {
        type: DataTypes.TEXT
      },
      user_id: {
        type: DataTypes.INTEGER // Telegram user ID
      },
      received_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      source: {
        type: DataTypes.STRING
      },
      is_copied: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    });

    // Users model
    this.models.User = this.sequelize.define('User', {
      telegram_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING
      },
      first_name: {
        type: DataTypes.STRING
      },
      last_name: {
        type: DataTypes.STRING
      },
      is_admin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      otps_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      numbers_used: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      joined_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    // Define relationships
    this.models.Country.hasMany(this.models.Number, { foreignKey: 'country_code' });
    this.models.Number.belongsTo(this.models.Country, { foreignKey: 'country_code' });
    
    this.models.User.hasMany(this.models.OTP, { foreignKey: 'user_id' });
    this.models.OTP.belongsTo(this.models.User, { foreignKey: 'user_id' });
  }

  // Country methods
  async getCountries() {
    return await this.models.Country.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });
  }

  async getCountry(code) {
    return await this.models.Country.findByPk(code);
  }

  async updateCountries(countriesData) {
    for (const country of countriesData) {
      await this.models.Country.upsert(country);
    }
  }

  // Number methods
  async getNumbersByCountry(countryCode) {
    return await this.models.Number.findAll({
      where: { country_code: countryCode },
      include: [this.models.Country]
    });
  }

  async getNumber(id) {
    return await this.models.Number.findByPk(id, {
      include: [this.models.Country]
    });
  }

  async reserveNumber(numberId, userId) {
    const number = await this.models.Number.findByPk(numberId);
    
    if (number && number.status === 'available') {
      number.status = 'reserved';
      number.reserved_by = userId;
      number.reserved_until = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await number.save();
      return true;
    }
    
    return false;
  }

  async updateNumbers(numbersData) {
    for (const numberData of numbersData) {
      await this.models.Number.upsert(numberData);
    }
  }

  // OTP methods
  async saveOTP(otpData) {
    return await this.models.OTP.create(otpData);
  }

  async getOTP(id) {
    return await this.models.OTP.findByPk(id);
  }

  async getUserOTPs(userId, limit = 20) {
    return await this.models.OTP.findAll({
      where: { user_id: userId },
      order: [['received_at', 'DESC']],
      limit: limit
    });
  }

  // User methods
  async getOrCreateUser(telegramUser) {
    const [user] = await this.models.User.findOrCreate({
      where: { telegram_id: telegramUser.id },
      defaults: {
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        is_admin: telegramUser.id.toString() === process.env.TELEGRAM_ADMIN_ID
      }
    });
    
    return user;
  }

  async getUserByReservedNumber(number) {
    const numRecord = await this.models.Number.findOne({
      where: { number: number, status: 'reserved' }
    });
    
    if (numRecord && numRecord.reserved_by) {
      return await this.models.User.findByPk(numRecord.reserved_by);
    }
    
    return null;
  }

  // Statistics
  async getStatistics() {
    const totalCountries = await this.models.Country.count();
    const totalNumbers = await this.models.Number.count();
    const availableNumbers = await this.models.Number.count({ where: { status: 'available' } });
    const totalOTPs = await this.models.OTP.count();
    const activeUsers = await this.models.User.count();
    
    return {
      totalCountries,
      totalNumbers,
      availableNumbers,
      totalOTPs,
      activeUsers
    };
  }

  // Cleanup
  async cleanupExpiredReservations() {
    await this.models.Number.update(
      { status: 'available', reserved_by: null, reserved_until: null },
      { where: { reserved_until: { [Sequelize.Op.lt]: new Date() } } }
    );
  }
}

module.exports = Database;
