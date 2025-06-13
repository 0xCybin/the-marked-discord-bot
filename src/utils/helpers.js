// ========================================
// FILE: src/utils/helpers.js
// PURPOSE: Common utility functions used across the application
// ========================================

const logger = require("./logger");

/**
 * Common utility functions for the ARG Discord bot
 * Provides reusable helper methods for various operations
 */
class HelperUtils {
  /**
   * Delays execution for a specified number of milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safely parses JSON with error handling
   * @param {string} jsonString - JSON string to parse
   * @param {any} defaultValue - Default value if parsing fails
   * @returns {any} Parsed object or default value
   */
  static safeJSONParse(jsonString, defaultValue = {}) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.debug("JSON parse failed, using default value");
      return defaultValue;
    }
  }

  /**
   * Safely stringifies an object with error handling
   * @param {any} obj - Object to stringify
   * @param {string} defaultValue - Default value if stringification fails
   * @returns {string} JSON string or default value
   */
  static safeJSONStringify(obj, defaultValue = "{}") {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      logger.debug("JSON stringify failed, using default value");
      return defaultValue;
    }
  }

  /**
   * Truncates text to a specified length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @param {string} suffix - Suffix to add when truncated
   * @returns {string} Truncated text
   */
  static truncateText(text, maxLength = 100, suffix = "...") {
    if (!text || typeof text !== "string") return "";

    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Formats a timestamp into a readable string
   * @param {Date|string|number} timestamp - Timestamp to format
   * @param {string} locale - Locale for formatting
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp, locale = "en-US") {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "Invalid Date";

      return date.toLocaleString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      logger.debug("Timestamp formatting failed");
      return "Invalid Date";
    }
  }

  /**
   * Calculates time difference in human-readable format
   * @param {Date|string|number} startTime - Start timestamp
   * @param {Date|string|number} endTime - End timestamp (default: now)
   * @returns {string} Human-readable time difference
   */
  static getTimeDifference(startTime, endTime = new Date()) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return "Invalid time";
      }

      const diffMs = Math.abs(end.getTime() - start.getTime());
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      if (diffHours > 0)
        return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffMinutes > 0)
        return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;

      return "Just now";
    } catch (error) {
      logger.debug("Time difference calculation failed");
      return "Unknown time";
    }
  }

  /**
   * Generates a random integer within a range
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @returns {number} Random integer
   */
  static randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Selects a random element from an array
   * @param {Array} array - Array to select from
   * @returns {any} Random element or undefined if array is empty
   */
  static randomChoice(array) {
    if (!Array.isArray(array) || array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Shuffles an array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle (creates a copy)
   * @returns {Array} Shuffled array copy
   */
  static shuffleArray(array) {
    if (!Array.isArray(array)) return [];

    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Removes duplicates from an array
   * @param {Array} array - Array to deduplicate
   * @param {Function} keyFn - Optional function to extract comparison key
   * @returns {Array} Array with duplicates removed
   */
  static removeDuplicates(array, keyFn = null) {
    if (!Array.isArray(array)) return [];

    if (keyFn && typeof keyFn === "function") {
      const seen = new Set();
      return array.filter((item) => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else {
      return [...new Set(array)];
    }
  }

  /**
   * Chunks an array into smaller arrays of specified size
   * @param {Array} array - Array to chunk
   * @param {number} size - Size of each chunk
   * @returns {Array} Array of chunked arrays
   */
  static chunkArray(array, size) {
    if (!Array.isArray(array) || size <= 0) return [];

    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Escapes special characters for Discord markdown
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeDiscordMarkdown(text) {
    if (!text || typeof text !== "string") return "";

    return text.replace(/([*_`~|\\])/g, "\\$1");
  }

  /**
   * Formats a number with appropriate units (K, M, B)
   * @param {number} num - Number to format
   * @param {number} precision - Decimal places
   * @returns {string} Formatted number string
   */
  static formatNumber(num, precision = 1) {
    if (typeof num !== "number" || isNaN(num)) return "0";

    const absNum = Math.abs(num);
    const sign = num < 0 ? "-" : "";

    if (absNum >= 1e9) {
      return sign + (absNum / 1e9).toFixed(precision) + "B";
    } else if (absNum >= 1e6) {
      return sign + (absNum / 1e6).toFixed(precision) + "M";
    } else if (absNum >= 1e3) {
      return sign + (absNum / 1e3).toFixed(precision) + "K";
    } else {
      return sign + absNum.toString();
    }
  }

  /**
   * Calculates percentage with safe division
   * @param {number} value - Numerator value
   * @param {number} total - Denominator value
   * @param {number} precision - Decimal places
   * @returns {number} Percentage (0-100)
   */
  static calculatePercentage(value, total, precision = 1) {
    if (typeof value !== "number" || typeof total !== "number" || total === 0) {
      return 0;
    }

    const percentage = (value / total) * 100;
    return (
      Math.round(percentage * Math.pow(10, precision)) / Math.pow(10, precision)
    );
  }

  /**
   * Retries an async operation with exponential backoff
   * @param {Function} operation - Async function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise} Result of the operation
   */
  static async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        logger.debug(
          `Operation failed (attempt ${attempt + 1}/${
            maxRetries + 1
          }), retrying in ${delay}ms...`
        );
        await this.delay(delay);
      }
    }
  }

  /**
   * Validates Discord snowflake ID format
   * @param {string} id - ID to validate
   * @returns {boolean} Whether the ID is a valid snowflake
   */
  static isValidSnowflake(id) {
    if (!id || typeof id !== "string") return false;
    return /^\d{17,19}$/.test(id);
  }

  /**
   * Creates a timeout promise that rejects after specified time
   * @param {number} ms - Timeout in milliseconds
   * @param {string} message - Timeout error message
   * @returns {Promise} Promise that rejects after timeout
   */
  static timeout(ms, message = "Operation timed out") {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Races a promise against a timeout
   * @param {Promise} promise - Promise to race
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} timeoutMessage - Timeout error message
   * @returns {Promise} Promise that resolves or rejects first
   */
  static async withTimeout(
    promise,
    timeoutMs,
    timeoutMessage = "Operation timed out"
  ) {
    return Promise.race([promise, this.timeout(timeoutMs, timeoutMessage)]);
  }
}

module.exports = HelperUtils;
