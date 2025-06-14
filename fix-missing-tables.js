// ========================================
// FILE: fix-missing-tables.js
// PURPOSE: Create all missing database tables for the ARG bot
// ========================================

require("dotenv").config();
const { Pool } = require("pg");

async function fixMissingTables() {
  console.log("🗄️ FIXING MISSING DATABASE TABLES...");
  console.log("=" * 50);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Test connection first
    console.log("🔌 Testing database connection...");
    const result = await pool.query("SELECT NOW() as current_time");
    console.log("✅ Database connection successful");
    console.log(`   Database time: ${result.rows[0].current_time}`);

    // Check what tables currently exist
    console.log("\n📋 Checking existing tables...");
    const existingTables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log("Current tables:");
    if (existingTables.rows.length === 0) {
      console.log("   (No tables found)");
    } else {
      existingTables.rows.forEach((row) => {
        console.log(`   ✓ ${row.tablename}`);
      });
    }

    // Create onboarding_sessions table
    console.log("\n🗄️ Creating onboarding_sessions table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS onboarding_sessions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        current_question INTEGER DEFAULT 0,
        responses JSONB DEFAULT '[]',
        personality_scores JSONB DEFAULT '{}',
        generated_nickname VARCHAR(255),
        completed BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        observer_response TEXT,
        is_observer BOOLEAN DEFAULT FALSE,
        dm_failed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ onboarding_sessions table created");

    // Create arg_name_assignments table
    console.log("\n🗄️ Creating arg_name_assignments table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arg_name_assignments (
        id SERIAL PRIMARY KEY,
        assigned_name VARCHAR(50) NOT NULL UNIQUE,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        psychological_profile JSONB,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ arg_name_assignments table created");

    // Create observer_assignments table
    console.log("\n🗄️ Creating observer_assignments table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS observer_assignments (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        observer_name VARCHAR(100) NOT NULL,
        color_response TEXT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        onboarding_session_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ observer_assignments table created");

    // Create user_selections table
    console.log("\n🗄️ Creating user_selections table...");
    await pool.query(`
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
    `);
    console.log("✅ user_selections table created");

    // Create conversation_logs table
    console.log("\n🗄️ Creating conversation_logs table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        message_content TEXT,
        is_user_message BOOLEAN NOT NULL,
        encoding_level INTEGER DEFAULT 1,
        conversation_round INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ conversation_logs table created");

    // Create nickname_assignments table
    console.log("\n🗄️ Creating nickname_assignments table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nickname_assignments (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        assigned_nickname VARCHAR(255) NOT NULL,
        nickname_type VARCHAR(50) NOT NULL,
        psychological_profile JSONB,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        onboarding_session_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ nickname_assignments table created");

    // Create activity_patterns table
    console.log("\n🗄️ Creating activity_patterns table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_patterns (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        pattern_data JSONB NOT NULL,
        pattern_type VARCHAR(100) NOT NULL,
        confidence_score FLOAT DEFAULT 0.0,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ activity_patterns table created");

    // Create message_logs table
    console.log("\n🗄️ Creating message_logs table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        interaction_type VARCHAR(100) NOT NULL,
        interaction_data JSONB,
        occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ message_logs table created");

    // Create all indexes
    console.log("\n📊 Creating indexes...");

    const indexes = [
      // onboarding_sessions indexes
      `CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON onboarding_sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_onboarding_guild_id ON onboarding_sessions(guild_id)`,
      `CREATE INDEX IF NOT EXISTS idx_onboarding_completed ON onboarding_sessions(completed)`,

      // arg_name_assignments indexes
      `CREATE INDEX IF NOT EXISTS idx_arg_names_name ON arg_name_assignments(assigned_name)`,
      `CREATE INDEX IF NOT EXISTS idx_arg_names_user ON arg_name_assignments(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_arg_names_guild ON arg_name_assignments(guild_id)`,

      // observer_assignments indexes
      `CREATE INDEX IF NOT EXISTS idx_observer_assignments_user_id ON observer_assignments(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_observer_assignments_guild_id ON observer_assignments(guild_id)`,

      // user_selections indexes
      `CREATE INDEX IF NOT EXISTS idx_user_selections_user_id ON user_selections(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_selections_guild_id ON user_selections(guild_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_selections_selected_at ON user_selections(selected_at)`,
      `CREATE INDEX IF NOT EXISTS idx_user_selections_complete ON user_selections(is_complete)`,

      // conversation_logs indexes
      `CREATE INDEX IF NOT EXISTS idx_conversation_user_id ON conversation_logs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_conversation_created_at ON conversation_logs(created_at)`,

      // nickname_assignments indexes
      `CREATE INDEX IF NOT EXISTS idx_nickname_user_id ON nickname_assignments(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nickname_guild_id ON nickname_assignments(guild_id)`,
      `CREATE INDEX IF NOT EXISTS idx_nickname_assigned_at ON nickname_assignments(assigned_at)`,

      // activity_patterns indexes
      `CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_patterns(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_guild_id ON activity_patterns(guild_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_patterns(pattern_type)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_detected_at ON activity_patterns(detected_at)`,

      // message_logs indexes
      `CREATE INDEX IF NOT EXISTS idx_message_logs_user_id ON message_logs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_message_logs_type ON message_logs(interaction_type)`,
      `CREATE INDEX IF NOT EXISTS idx_message_logs_occurred_at ON message_logs(occurred_at)`,
    ];

    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
      } catch (indexError) {
        // Indexes are nice to have but not critical
        console.log(`   ⚠️ Index creation skipped: ${indexError.message}`);
      }
    }
    console.log("✅ Indexes created");

    // Create helpful views
    console.log("\n📊 Creating views...");
    await pool.query(`
      CREATE OR REPLACE VIEW onboarding_stats AS
      SELECT 
        guild_id,
        COUNT(*) as total_assessments,
        COUNT(CASE WHEN completed = TRUE THEN 1 END) as completed_assessments,
        COUNT(CASE WHEN completed = FALSE THEN 1 END) as incomplete_assessments,
        COUNT(CASE WHEN is_observer = TRUE THEN 1 END) as observer_count,
        AVG(CASE WHEN completed = TRUE THEN current_question END) as avg_questions_completed,
        MAX(started_at) as last_assessment
      FROM onboarding_sessions
      GROUP BY guild_id
    `);
    console.log("✅ onboarding_stats view created");

    // Test each table with a simple query
    console.log("\n🧪 Testing all tables...");
    const tables = [
      "onboarding_sessions",
      "arg_name_assignments",
      "observer_assignments",
      "user_selections",
      "conversation_logs",
      "nickname_assignments",
      "activity_patterns",
      "message_logs",
    ];

    for (const table of tables) {
      try {
        await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ✅ ${table} - working`);
      } catch (testError) {
        console.log(`   ❌ ${table} - error: ${testError.message}`);
      }
    }

    // Show final table list
    console.log("\n📋 Final table verification...");
    const finalTables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log("All tables now in database:");
    finalTables.rows.forEach((row) => {
      console.log(`   ✓ ${row.tablename}`);
    });

    console.log("\n🎉 DATABASE FIX COMPLETE!");
    console.log("\nYour ARG bot should now work with commands like:");
    console.log("• !force-onboarding @user");
    console.log("• !onboarding-stats");
    console.log("• !recent-onboarding");
    console.log("• !observer-stats");
    console.log(
      "\nThe database has been fully initialized with all required tables."
    );
  } catch (error) {
    console.error("❌ Error fixing database:", error);
    console.error("Error details:", error.message);
  } finally {
    await pool.end();
  }
}

// Check environment and run
console.log("🌍 Environment:", process.env.NODE_ENV || "development");
console.log(
  "🔧 SSL Mode:",
  process.env.NODE_ENV === "production" ? "ENABLED" : "DISABLED"
);

fixMissingTables().catch(console.error);
