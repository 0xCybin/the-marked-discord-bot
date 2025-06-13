// ========================================
// FILE: src/utils/logger.js
// PURPOSE: Centralized logging system with different log levels and formatting
// ========================================

const config = require("../config/environment");

/**
 * Centralized logging utility for the ARG Discord bot
 * Provides consistent formatting and log level management
 */
class Logger {
  constructor() {
    this.logLevel = config.app.logLevel;

    // Define log levels with numeric priorities
    this.levels = {
      error: 0, // Critical errors that need immediate attention
      warn: 1, // Warning messages for potential issues
      info: 2, // General information about bot operations
      debug: 3, // Detailed debug information for development
    };

    // Emoji mapping for visual log distinction
    this.levelEmojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      debug: "🔍",
    };

    // Color codes for console output (if supported)
    this.levelColors = {
      error: "\x1b[31m", // Red
      warn: "\x1b[33m", // Yellow
      info: "\x1b[36m", // Cyan
      debug: "\x1b[37m", // White
    };

    this.resetColor = "\x1b[0m";
  }

  /**
   * Gets formatted timestamp for log entries
   * @returns {string} ISO timestamp string
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Determines if a log level should be output based on current log level setting
   * @param {string} level - Log level to check
   * @returns {boolean} Whether this level should be logged
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  /**
   * Formats and outputs a log message with appropriate styling
   * @param {string} level - Log level (error, warn, info, debug)
   * @param {string} message - Main log message
   * @param {...any} args - Additional arguments to log
   */
  log(level, message, ...args) {
    if (!this.shouldLog(level)) return;

    const timestamp = this.getTimestamp();
    const emoji = this.levelEmojis[level];
    const color = this.levelColors[level];

    // Format: [timestamp] emoji level: message
    const formattedMessage = `[${timestamp}] ${emoji} ${level.toUpperCase()}: ${message}`;

    // Apply color if supported and not in production
    if (config.app.nodeEnv !== "production" && color) {
      console.log(`${color}${formattedMessage}${this.resetColor}`, ...args);
    } else {
      console.log(formattedMessage, ...args);
    }
  }

  /**
   * Logs error messages - highest priority
   * @param {string} message - Error message
   * @param {...any} args - Additional error details
   */
  error(message, ...args) {
    this.log("error", message, ...args);
  }

  /**
   * Logs warning messages - for potential issues
   * @param {string} message - Warning message
   * @param {...any} args - Additional warning details
   */
  warn(message, ...args) {
    this.log("warn", message, ...args);
  }

  /**
   * Logs informational messages - general bot operations
   * @param {string} message - Info message
   * @param {...any} args - Additional info details
   */
  info(message, ...args) {
    this.log("info", message, ...args);
  }

  /**
   * Logs debug messages - detailed development information
   * @param {string} message - Debug message
   * @param {...any} args - Additional debug details
   */
  debug(message, ...args) {
    this.log("debug", message, ...args);
  }

  /**
   * Logs ARG-specific events with special formatting
   * @param {string} event - ARG event type (selection, conversation, etc.)
   * @param {string} message - Event message
   * @param {...any} args - Additional event details
   */
  argEvent(event, message, ...args) {
    const formattedMessage = `🔮 ARG[${event.toUpperCase()}]: ${message}`;
    this.info(formattedMessage, ...args);
  }

  /**
   * Logs performance metrics and timing information
   * @param {string} operation - Operation being timed
   * @param {number} duration - Duration in milliseconds
   * @param {...any} args - Additional performance details
   */
  performance(operation, duration, ...args) {
    const formattedMessage = `⏱️ PERF[${operation}]: ${duration}ms`;
    this.debug(formattedMessage, ...args);
  }

  /**
   * Logs database operations with special formatting
   * @param {string} operation - Database operation type
   * @param {string} message - Operation message
   * @param {...any} args - Additional database details
   */
  database(operation, message, ...args) {
    const formattedMessage = `🗄️ DB[${operation.toUpperCase()}]: ${message}`;
    this.debug(formattedMessage, ...args);
  }

  /**
   * Logs Discord API operations
   * @param {string} operation - Discord operation type
   * @param {string} message - Operation message
   * @param {...any} args - Additional Discord details
   */
  discord(operation, message, ...args) {
    const formattedMessage = `👥 DISCORD[${operation.toUpperCase()}]: ${message}`;
    this.debug(formattedMessage, ...args);
  }

  /**
   * Logs DeepSeek AI operations
   * @param {string} operation - AI operation type
   * @param {string} message - Operation message
   * @param {...any} args - Additional AI details
   */
  ai(operation, message, ...args) {
    const formattedMessage = `🧠 AI[${operation.toUpperCase()}]: ${message}`;
    this.debug(formattedMessage, ...args);
  }
}

// Export singleton instance
module.exports = new Logger();
