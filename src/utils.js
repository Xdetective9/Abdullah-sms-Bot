const crypto = require('crypto');
const moment = require('moment-timezone');

class Utils {
  static formatNumber(number) {
    if (!number) return '';
    // Format number for display
    return number.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }

  static extractOTP(text) {
    if (!text) return null;
    
    // Common OTP patterns
    const patterns = [
      /\b\d{4}\b/, // 4-digit OTP
      /\b\d{5}\b/, // 5-digit OTP
      /\b\d{6}\b/, // 6-digit OTP
      /\b\d{8}\b/, // 8-digit OTP
      /code[:\s]*(\d+)/i,
      /otp[:\s]*(\d+)/i,
      /verification[:\s]*(\d+)/i,
      /password[:\s]*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return null;
  }

  static formatTimeAgo(timestamp) {
    const now = moment();
    const time = moment(timestamp);
    const diff = now.diff(time, 'seconds');
    
    if (diff < 60) {
      return `${diff} seconds ago`;
    } else if (diff < 3600) {
      const minutes = Math.floor(diff / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < 604800) {
      const days = Math.floor(diff / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return time.format('YYYY-MM-DD HH:mm');
    }
  }

  static generateId(length = 8) {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 500);
  }

  static getCountryFlag(countryCode) {
    const flagMap = {
      'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪',
      'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'RU': '🇷🇺', 'CN': '🇨🇳',
      'JP': '🇯🇵', 'IN': '🇮🇳', 'BR': '🇧🇷', 'MX': '🇲🇽', 'KR': '🇰🇷',
      'MY': '🇲🇾', 'ID': '🇮🇩', 'PH': '🇵🇭', 'VN': '🇻🇳', 'TH': '🇹🇭',
      'SG': '🇸🇬', 'PK': '🇵🇰', 'BD': '🇧🇩', 'NG': '🇳🇬', 'ZA': '🇿🇦',
      'EG': '🇪🇬', 'TR': '🇹🇷', 'SA': '🇸🇦', 'AE': '🇦🇪', 'QA': '🇶🇦'
    };
    
    return flagMap[countryCode.toUpperCase()] || '🏳️';
  }

  static parsePhoneNumber(number) {
    // Remove all non-numeric characters
    const digits = number.replace(/\D/g, '');
    
    // Try to determine country
    if (digits.startsWith('1')) return { country: 'US', number: digits };
    if (digits.startsWith('44')) return { country: 'GB', number: digits };
    if (digits.startsWith('60')) return { country: 'MY', number: digits };
    if (digits.startsWith('62')) return { country: 'ID', number: digits };
    if (digits.startsWith('63')) return { country: 'PH', number: digits };
    if (digits.startsWith('65')) return { country: 'SG', number: digits };
    if (digits.startsWith('91')) return { country: 'IN', number: digits };
    
    return { country: 'Unknown', number: digits };
  }

  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  static paginate(array, page, perPage) {
    const offset = (page - 1) * perPage;
    return {
      data: array.slice(offset, offset + perPage),
      page,
      perPage,
      total: array.length,
      totalPages: Math.ceil(array.length / perPage)
    };
  }

  static generateKeyboard(buttons, columns = 2) {
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += columns) {
      keyboard.push(buttons.slice(i, i + columns));
    }
    return keyboard;
  }
}

module.exports = Utils;
