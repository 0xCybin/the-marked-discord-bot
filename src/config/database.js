// ========================================
// FILE: src/config/database.js
// PURPOSE: Database connection management and table initialization
// ========================================

const { Pool } = require("pg");
const config = require("./environment");

/**
 * PostgreSQL connection pool
 * Configured with environment-based settings
 */
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
});

/**
 * Tests the database connection
 * @returns {Promise<void>}
 */
async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW() as current_time");
    console.log("✅ Database connection established");
    console.log(`   Database time: ${result.rows[0].current_time}`);
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    throw error;
  }
}

/**
 * Creates all required database tables for the ARG bot
 * Includes tables for selections, conversations, nicknames, activity patterns, and message logging
 * @returns {Promise<void>}
 */
async function createTables() {
  console.log("🗄️ Creating/verifying database tables...");

  const tableQueries = [
    // User selections table - stores weekly selection data with enhanced user info
    {
      name: "user_selections",
      query: `
        CREATE TABLE IF NOT EXISTS user_selections (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          guild_id VARCHAR(255) NOT NULL,
          selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          activity_data JSONB,
          conversation_count INTEGER DEFAULT 0,
          last_message_at TIMESTAMP,
          is_complete BOOLEAN DEFAULT FALSE
        )
      `,
    },

    // Conversation logs table - tracks all DM conversations with encoding levels
    {
      name: "conversation_logs",
      query: `
        CREATE TABLE IF NOT EXISTS conversation_logs (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          message_content TEXT,
          is_user_message BOOLEAN NOT NULL,
          encoding_level INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },

    // Nickname assignments table - tracks all nickname assignments and changes
    {
      name: "nickname_assignments",
      query: `
        CREATE TABLE IF NOT EXISTS nickname_assignments (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          guild_id VARCHAR(255) NOT NULL,
          old_nickname VARCHAR(255),
          new_nickname VARCHAR(255) NOT NULL,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assignment_reason VARCHAR(500),
          assigned_by VARCHAR(255) DEFAULT 'bot'
        )
      `,
    },

    // User activity patterns table - stores detected behavioral patterns
    {
      name: "user_activity_patterns",
      query: `
        CREATE TABLE IF NOT EXISTS user_activity_patterns (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          guild_id VARCHAR(255) NOT NULL,
          activity_type VARCHAR(100) NOT NULL,
          activity_data JSONB,
          detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          confidence_score INTEGER DEFAULT 0
        )
      `,
    },

    // Bot message logs table - tracks all messages sent by the bot
    {
      name: "bot_message_logs",
      query: `
        CREATE TABLE IF NOT EXISTS bot_message_logs (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          username VARCHAR(255) NOT NULL,
          message_type VARCHAR(100) NOT NULL,
          content TEXT,
          channel_type VARCHAR(50) DEFAULT 'dm',
          guild_id VARCHAR(255),
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },

    // User interaction logs table - tracks button clicks and other interactions
    {
      name: "user_interaction_logs",
      query: `
        CREATE TABLE IF NOT EXISTS user_interaction_logs (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          username VARCHAR(255) NOT NULL,
          interaction_type VARCHAR(100) NOT NULL,
          interaction_data JSONB,
          occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
  ];

  // Execute each table creation query
  for (const table of tableQueries) {
    try {
      await pool.query(table.query);
      console.log(`   ✅ Table '${table.name}' verified`);
    } catch (error) {
      console.error(
        `   ❌ Failed to create table '${table.name}':`,
        error.message
      );
      throw error;
    }
  }

  // Create indexes separately after tables are created
  await createIndexes();

  console.log("✅ All database tables verified");
}

/**
 * Creates database indexes for performance optimization
 * @returns {Promise<void>}
 */
async function createIndexes() {
  console.log("🗄️ Creating/verifying database indexes...");

  const indexQueries = [
    // User selections indexes
    {
      name: "idx_user_selections_user_id",
      query: `CREATE INDEX IF NOT EXISTS idx_user_selections_user_id ON user_selections(user_id)`,
    },
    {
      name: "idx_user_selections_guild_id",
      query: `CREATE INDEX IF NOT EXISTS idx_user_selections_guild_id ON user_selections(guild_id)`,
    },
    {
      name: "idx_user_selections_selected_at",
      query: `CREATE INDEX IF NOT EXISTS idx_user_selections_selected_at ON user_selections(selected_at)`,
    },
    {
      name: "idx_user_selections_complete",
      query: `CREATE INDEX IF NOT EXISTS idx_user_selections_complete ON user_selections(is_complete)`,
    },

    // Conversation logs indexes
    {
      name: "idx_conversation_user_id",
      query: `CREATE INDEX IF NOT EXISTS idx_conversation_user_id ON conversation_logs(user_id)`,
    },
    {
      name: "idx_conversation_created_at",
      query: `CREATE INDEX IF NOT EXISTS idx_conversation_created_at ON conversation_logs(created_at)`,
    },

    // Nickname assignments indexes
    {
      name: "idx_nickname_user_id",
      query: `CREATE INDEX IF NOT EXISTS idx_nickname_user_id ON nickname_assignments(user_id)`,
    },
    {
      name: "idx_nickname_guild_id",
      query: `CREATE INDEX IF NOT EXISTS idx_nickname_guild_id ON nickname_assignments(guild_id)`,
    },

    // Activity patterns indexes
    {
      name: "idx_activity_type",
      query: `CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_patterns(activity_type)`,
    },
    {
      name: "idx_activity_detected_at",
      query: `CREATE INDEX IF NOT EXISTS idx_activity_detected_at ON user_activity_patterns(detected_at)`,
    },
    {
      name: "idx_activity_confidence",
      query: `CREATE INDEX IF NOT EXISTS idx_activity_confidence ON user_activity_patterns(confidence_score)`,
    },

    // Bot message logs indexes
    {
      name: "idx_bot_message_logs_user_id",
      query: `CREATE INDEX IF NOT EXISTS idx_bot_message_logs_user_id ON bot_message_logs(user_id)`,
    },
    {
      name: "idx_bot_message_logs_sent_at",
      query: `CREATE INDEX IF NOT EXISTS idx_bot_message_logs_sent_at ON bot_message_logs(sent_at)`,
    },
    {
      name: "idx_bot_message_logs_type",
      query: `CREATE INDEX IF NOT EXISTS idx_bot_message_logs_type ON bot_message_logs(message_type)`,
    },
    {
      name: "idx_bot_message_logs_guild_id",
      query: `CREATE INDEX IF NOT EXISTS idx_bot_message_logs_guild_id ON bot_message_logs(guild_id)`,
    },

    // User interaction logs indexes
    {
      name: "idx_user_interaction_logs_user_id",
      query: `CREATE INDEX IF NOT EXISTS idx_user_interaction_logs_user_id ON user_interaction_logs(user_id)`,
    },
    {
      name: "idx_user_interaction_logs_type",
      query: `CREATE INDEX IF NOT EXISTS idx_user_interaction_logs_type ON user_interaction_logs(interaction_type)`,
    },
    {
      name: "idx_user_interaction_logs_occurred_at",
      query: `CREATE INDEX IF NOT EXISTS idx_user_interaction_logs_occurred_at ON user_interaction_logs(occurred_at)`,
    },
  ];

  // Execute each index creation query
  for (const index of indexQueries) {
    try {
      await pool.query(index.query);
      console.log(`   ✅ Index '${index.name}' verified`);
    } catch (error) {
      console.warn(
        `   ⚠️ Index '${index.name}' creation skipped: ${error.message}`
      );
      // Don't throw here - indexes are nice to have but not critical
    }
  }

  console.log("✅ Database indexes processed");
}

/**
 * Initializes the database connection and creates all required tables
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    console.log("🗄️ Initializing database...");

    // Test the connection
    await testConnection();

    // Create/verify all tables
    await createTables();

    // Initialize message logging system
    const messageLogger = require("../services/messageLogger");
    await messageLogger.initialize();

    console.log("✅ Database initialization complete");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

/**
 * Closes the database connection pool
 * Should be called during graceful shutdown
 * @returns {Promise<void>}
 */
async function close() {
  try {
    await pool.end();
    console.log("🔌 Database connection closed");
  } catch (error) {
    console.error("❌ Error closing database connection:", error);
  }
}

/**
 * Executes a database query with error handling and logging
 * @param {string} query - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function executeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error("❌ Database query failed:", error.message);
    console.error("Query:", query);
    console.error("Params:", params);
    throw error;
  }
}

module.exports = {
  pool,
  initialize,
  close,
  executeQuery,
  testConnection,
  createTables,
  createIndexes,
};
