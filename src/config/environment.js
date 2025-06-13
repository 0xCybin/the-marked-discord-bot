// ========================================
// FILE: src/config/environment.js
// PURPOSE: Centralized environment variable management and validation
// ========================================

const { config } = require("dotenv");

// Load environment variables in development
if (process.env.NODE_ENV !== "production") {
  config();
}

/**
 * Validates that all required environment variables are present
 * Exits the process if any required variables are missing
 */
function validateRequiredEnvVars() {
  const requiredEnvVars = ["DISCORD_TOKEN", "DEEPSEEK_API_KEY", "DATABASE_URL"];

  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missingVars.join(", ")}`
    );
    console.error("Please check your .env file or environment configuration.");
    process.exit(1);
  }

  // Validate API key format
  if (!process.env.DEEPSEEK_API_KEY.startsWith("sk-")) {
    console.error(
      '❌ Invalid DeepSeek API key format. Should start with "sk-"'
    );
    process.exit(1);
  }

  console.log("✅ Environment variables validated");
}

// Run validation immediately
validateRequiredEnvVars();

/**
 * Centralized configuration object containing all environment-based settings
 * Organized by service/component for easy access
 */
module.exports = {
  // Discord-related configuration
  discord: {
    token: process.env.DISCORD_TOKEN,
    targetGuildId: process.env.TARGET_GUILD_ID,
    specialRoleName: process.env.SPECIAL_ROLE_NAME || "The Marked",
  },

  // DeepSeek AI API configuration
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    timeout: 30000, // 30 seconds
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  },

  // Application-wide settings
  app: {
    port: process.env.PORT || 3000,
    testingMode: process.env.TESTING_MODE === "true" || false,
    logLevel: process.env.LOG_LEVEL || "info",
    nodeEnv: process.env.NODE_ENV || "development",
  },

  // ARG-specific settings
  arg: {
    specialRoleName: process.env.SPECIAL_ROLE_NAME || "The Marked",
    selectionIntervalHours: 24, // How often to check for new selections
    maxConversationRounds: 3, // Maximum conversation rounds per selection
    nightHoursStart: 21, // 9 PM
    nightHoursEnd: 6, // 6 AM
    testingModeSelectionDelay: 10000, // 10 seconds in testing mode
  },
};
