// ========================================
// FILE: setup-onboarding-tables.js
// PURPOSE: Create missing onboarding database tables
// ========================================

require("dotenv").config();
const database = require("./src/config/database");

async function createOnboardingTables() {
  console.log("🗄️ Creating onboarding database tables...");

  try {
    await database.initialize();

    // Create onboarding_sessions table
    await database.executeQuery(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ onboarding_sessions table created");

    // Create ARG name assignments table
    await database.executeQuery(`
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

    // Update nickname_assignments table to include onboarding_session_id
    await database.executeQuery(`
      ALTER TABLE nickname_assignments 
      ADD COLUMN IF NOT EXISTS onboarding_session_id INTEGER
    `);

    console.log("✅ nickname_assignments table updated");

    // Create indexes
    await database.executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON onboarding_sessions(user_id)
    `);

    await database.executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_onboarding_guild_id ON onboarding_sessions(guild_id)
    `);

    await database.executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_onboarding_completed ON onboarding_sessions(completed)
    `);

    await database.executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_arg_names_name ON arg_name_assignments(assigned_name)
    `);

    console.log("✅ Indexes created");

    // Create views for statistics
    await database.executeQuery(`
      CREATE OR REPLACE VIEW onboarding_stats AS
      SELECT 
        guild_id,
        COUNT(*) as total_assessments,
        COUNT(CASE WHEN completed = TRUE THEN 1 END) as completed_assessments,
        COUNT(CASE WHEN completed = FALSE THEN 1 END) as incomplete_assessments,
        AVG(CASE WHEN completed = TRUE THEN current_question END) as avg_questions_completed,
        MAX(started_at) as last_assessment
      FROM onboarding_sessions
      GROUP BY guild_id
    `);

    console.log("✅ onboarding_stats view created");

    console.log("\n🎉 All onboarding tables created successfully!");
    console.log("\nYou can now use:");
    console.log("• !force-onboarding @user");
    console.log("• !onboarding-stats");
    console.log("• !recent-onboarding");
  } catch (error) {
    console.error("❌ Error creating tables:", error);
  } finally {
    await database.close();
  }
}

createOnboardingTables();
