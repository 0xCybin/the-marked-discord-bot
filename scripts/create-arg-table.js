// ========================================
// FILE: create-arg-table.js
// PURPOSE: Create missing arg_name_assignments table
// ========================================

require("dotenv").config();
const { Pool } = require("pg");

async function createARGTable() {
  console.log("🗄️ Creating arg_name_assignments table...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Create arg_name_assignments table
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

    // Create indexes
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_arg_names_name ON arg_name_assignments(assigned_name)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_arg_names_user ON arg_name_assignments(user_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_arg_names_guild ON arg_name_assignments(guild_id)`
    );

    console.log("✅ Indexes created");

    // Test the table
    const testResult = await pool.query(
      `
      INSERT INTO arg_name_assignments 
      (assigned_name, guild_id, user_id, psychological_profile, assigned_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
      [
        "TEST-A1-SAMPLE-∀",
        "test_guild",
        "test_user",
        '{"test": true}',
        new Date(),
      ]
    );

    console.log(`✅ Test record created with ID: ${testResult.rows[0].id}`);

    // Clean up test record
    await pool.query(`DELETE FROM arg_name_assignments WHERE id = $1`, [
      testResult.rows[0].id,
    ]);
    console.log("✅ Test record removed");

    console.log("\n🎉 ARG name assignments table ready!");
    console.log("The systematic naming system should now work properly.");
  } catch (error) {
    console.error("❌ Error creating table:", error);
  } finally {
    await pool.end();
  }
}

createARGTable();
