// FILE: src/bot.js
// PURPOSE: Main bot entry point - simplified and modular
// ========================================

const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config/environment");
const database = require("./config/database");
const eventHandler = require("./events");
const logger = require("./utils/logger");
const keepAlive = require("./utils/keep-alive");
// ADDED: Import onboarding system for client reference
const onboardingSystem = require("./services/onboardingSystem");

/**
 * Main Discord bot class for ARG operations
 * Handles initialization, startup, and graceful shutdown
 */
class ARGDiscordBot {
  constructor() {
    this.client = null;
    this.isShuttingDown = false;
  }

  /**
   * Initializes the Discord client with required intents
   */
  initializeClient() {
    logger.info("🤖 Initializing Discord client...");

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences, // Required for enhanced data collection
      ],
    });

    // ADDED: Set up ready event to configure onboarding system
    this.client.once("ready", () => {
      logger.info(`✅ Bot logged in as ${this.client.user.tag}`);

      // CRITICAL: Set client reference for onboarding system
      onboardingSystem.setClient(this.client);
      logger.info("🔗 Client reference set for onboarding system");

      logger.info("🎮 ARG Discord Bot is fully operational");
    });

    logger.info("✅ Discord client initialized with required intents");
  }

  /**
   * Starts the bot with full initialization sequence
   */
  async start() {
    try {
      logger.info("🚀 Starting ARG Discord Bot...");

      // Initialize Discord client
      this.initializeClient();

      // Initialize database
      logger.info("🗄️ Initializing database...");
      await database.initialize();

      // Register event handlers
      logger.info("📡 Registering event handlers...");
      eventHandler.register(this.client);

      // Start keep-alive server
      logger.info("🌐 Starting keep-alive server...");
      keepAlive.start();

      // Setup graceful shutdown handlers
      this.setupGracefulShutdown();

      // Login to Discord
      logger.info("🔗 Connecting to Discord...");
      await this.client.login(config.discord.token);

      logger.info("✅ ARG Discord Bot started successfully");
    } catch (error) {
      logger.error("❌ Bot startup failed:", error);
      await this.shutdown(1);
    }
  }

  /**
   * Sets up graceful shutdown handlers for various signals
   */
  setupGracefulShutdown() {
    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => {
      logger.info("📴 Received SIGINT, shutting down gracefully...");
      this.shutdown(0);
    });

    // Handle SIGTERM (process termination)
    process.on("SIGTERM", () => {
      logger.info("📴 Received SIGTERM, shutting down gracefully...");
      this.shutdown(0);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("💥 Uncaught exception:", error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error(
        "💥 Unhandled promise rejection at:",
        promise,
        "reason:",
        reason
      );
      // Don't exit on unhandled rejections, just log them
    });
  }

  /**
   * Performs graceful shutdown of all bot services
   * @param {number} exitCode - Exit code for the process
   */
  async shutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress...");
      return;
    }

    this.isShuttingDown = true;
    logger.info("🛑 Beginning graceful shutdown...");

    try {
      // Destroy Discord client connection
      if (this.client) {
        logger.info("🔌 Disconnecting from Discord...");
        this.client.destroy();
      }

      // Close database connections
      logger.info("🗄️ Closing database connections...");
      await database.close();

      // Stop keep-alive server
      logger.info("🌐 Stopping keep-alive server...");
      keepAlive.stop();

      logger.info("✅ Graceful shutdown completed");
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
    } finally {
      process.exit(exitCode);
    }
  }

  /**
   * Gets the Discord client instance
   * @returns {Client} Discord client
   */
  getClient() {
    return this.client;
  }
}

// Create and start the bot
const bot = new ARGDiscordBot();
bot.start();

// Export the client for use in other modules
module.exports = bot.getClient();
