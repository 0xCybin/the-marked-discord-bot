// ========================================
// FILE: src/utils/validation.js
// PURPOSE: Input validation and data sanitization utilities
// ========================================

const logger = require("./logger");

/**
 * Validation utilities for ARG Discord bot
 * Ensures data integrity and prevents common security issues
 */
class ValidationUtils {
  /**
   * Validates Discord user ID format
   * @param {string} userId - Discord user ID to validate
   * @returns {boolean} Whether the user ID is valid
   */
  static isValidUserId(userId) {
    if (!userId || typeof userId !== "string") return false;

    // Discord snowflake IDs are 17-19 digits
    const snowflakeRegex = /^\d{17,19}$/;
    return snowflakeRegex.test(userId);
  }

  /**
   * Validates Discord guild ID format
   * @param {string} guildId - Discord guild ID to validate
   * @returns {boolean} Whether the guild ID is valid
   */
  static isValidGuildId(guildId) {
    return this.isValidUserId(guildId); // Same format as user IDs
  }

  /**
   * Sanitizes nickname input to prevent injection and ensure Discord compatibility
   * @param {string} nickname - Nickname to sanitize
   * @returns {string} Sanitized nickname
   */
  static sanitizeNickname(nickname) {
    if (!nickname || typeof nickname !== "string") return "";

    // Remove potential markdown and mentions
    let sanitized = nickname
      .replace(/[`*_~|\\]/g, "") // Remove markdown characters
      .replace(/@/g, "") // Remove @ symbols
      .replace(/\n/g, " ") // Replace newlines with spaces
      .trim();

    // Ensure nickname is within Discord's limits (1-32 characters)
    if (sanitized.length > 32) {
      sanitized = sanitized.substring(0, 32);
    }

    if (sanitized.length < 1) {
      return "Unknown Entity";
    }

    return sanitized;
  }

  /**
   * Validates message content for ARG conversations
   * @param {string} content - Message content to validate
   * @returns {Object} Validation result with isValid and sanitized content
   */
  static validateMessageContent(content) {
    if (!content || typeof content !== "string") {
      return {
        isValid: false,
        content: "",
        reason: "Empty or invalid content",
      };
    }

    // Check length limits (Discord's message limit is 2000 characters)
    if (content.length > 2000) {
      return {
        isValid: false,
        content: content.substring(0, 2000),
        reason: "Content too long",
      };
    }

    // Remove potentially dangerous content
    const sanitized = content
      .replace(/\x00/g, "") // Remove null bytes
      .trim();

    return {
      isValid: sanitized.length > 0,
      content: sanitized,
      reason: sanitized.length > 0 ? "Valid" : "Empty after sanitization",
    };
  }

  /**
   * Validates JSON data structure for activity data storage
   * @param {any} data - Data to validate for JSON storage
   * @returns {Object} Validation result
   */
  static validateActivityData(data) {
    try {
      // Ensure data can be JSON stringified and parsed
      const jsonString = JSON.stringify(data);
      const parsed = JSON.parse(jsonString);

      // Check size limits (PostgreSQL JSONB has practical limits)
      if (jsonString.length > 1000000) {
        // 1MB limit
        return {
          isValid: false,
          data: null,
          reason: "Data too large for storage",
        };
      }

      return {
        isValid: true,
        data: parsed,
        reason: "Valid JSON data",
      };
    } catch (error) {
      logger.error("JSON validation failed:", error.message);
      return {
        isValid: false,
        data: null,
        reason: "Invalid JSON structure",
      };
    }
  }

  /**
   * Validates conversation count for ARG progression
   * @param {number} count - Conversation count to validate
   * @param {number} maxCount - Maximum allowed conversation count
   * @returns {boolean} Whether the count is valid
   */
  static isValidConversationCount(count, maxCount = 3) {
    return Number.isInteger(count) && count >= 0 && count <= maxCount;
  }

  /**
   * Validates encoding level for degraded AI responses
   * @param {number} level - Encoding level to validate
   * @returns {boolean} Whether the encoding level is valid
   */
  static isValidEncodingLevel(level) {
    return Number.isInteger(level) && level >= 0 && level <= 3;
  }

  /**
   * Validates time-based constraints for ARG selections
   * @param {Date} timestamp - Timestamp to validate
   * @param {number} maxAgeHours - Maximum age in hours
   * @returns {boolean} Whether the timestamp is within valid range
   */
  static isWithinTimeConstraint(timestamp, maxAgeHours = 168) {
    // 168 hours = 1 week
    if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return false;
    }

    const now = new Date();
    const ageHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

    return ageHours >= 0 && ageHours <= maxAgeHours;
  }

  /**
   * Validates Discord permissions for bot operations
   * @param {Object} member - Discord member object
   * @param {Array<string>} requiredPermissions - Array of required permission names
   * @returns {Object} Validation result with missing permissions
   */
  static validateBotPermissions(member, requiredPermissions) {
    if (!member || !member.permissions) {
      return {
        isValid: false,
        missingPermissions: requiredPermissions,
        reason: "Invalid member or permissions object",
      };
    }

    const missingPermissions = requiredPermissions.filter(
      (permission) => !member.permissions.has(permission)
    );

    return {
      isValid: missingPermissions.length === 0,
      missingPermissions,
      reason:
        missingPermissions.length > 0
          ? `Missing permissions: ${missingPermissions.join(", ")}`
          : "All permissions present",
    };
  }
}

module.exports = ValidationUtils;
