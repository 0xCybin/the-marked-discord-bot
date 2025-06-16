// ========================================
// FILE: debug-env.js
// PURPOSE: Debug environment variable loading
// ========================================

console.log("🔍 DEBUGGING ENVIRONMENT VARIABLES");
console.log("=".repeat(50));

// Check if .env file exists and is readable
const fs = require("fs");
const path = require("path");

console.log("📁 Current working directory:", process.cwd());

// Check for .env file
const envPath = path.join(process.cwd(), ".env");
console.log("🔍 Looking for .env file at:", envPath);

try {
  if (fs.existsSync(envPath)) {
    console.log("✅ .env file exists");

    // Read the file content
    const envContent = fs.readFileSync(envPath, "utf8");
    console.log(
      "📋 .env file content length:",
      envContent.length,
      "characters"
    );

    // Show first few lines (safely)
    const lines = envContent.split("\n").slice(0, 5);
    console.log("📄 First few lines:");
    lines.forEach((line, i) => {
      if (line.trim()) {
        const [key] = line.split("=");
        console.log(`   ${i + 1}. ${key}=***`);
      }
    });
  } else {
    console.log("❌ .env file does NOT exist at expected location");
    console.log("🔍 Files in current directory:");
    fs.readdirSync(process.cwd()).forEach((file) => {
      if (file.startsWith(".env")) {
        console.log(`   Found: ${file}`);
      }
    });
  }
} catch (error) {
  console.log("❌ Error reading .env file:", error.message);
}

console.log("\n🔧 Testing dotenv loading...");

// Test 1: Load dotenv manually
try {
  const result = require("dotenv").config();

  if (result.error) {
    console.log("❌ Dotenv error:", result.error.message);
  } else {
    console.log("✅ Dotenv loaded successfully");
    console.log(
      "📊 Loaded",
      Object.keys(result.parsed || {}).length,
      "variables"
    );
  }
} catch (error) {
  console.log("❌ Failed to load dotenv:", error.message);
}

// Test 2: Check environment variables
console.log("\n📊 ENVIRONMENT VARIABLE CHECK:");
console.log("-".repeat(30));

const requiredVars = [
  "DISCORD_TOKEN",
  "DEEPSEEK_API_KEY",
  "DATABASE_URL",
  "TARGET_GUILD_ID",
];

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: Found (${value.length} chars)`);
  } else {
    console.log(`❌ ${varName}: NOT FOUND`);
  }
});

// Test 3: Show all environment variables that might be related
console.log("\n🔍 All environment variables containing common keywords:");
Object.keys(process.env)
  .filter(
    (key) =>
      key.includes("DISCORD") ||
      key.includes("DEEPSEEK") ||
      key.includes("DATABASE") ||
      key.includes("TOKEN") ||
      key.includes("API")
  )
  .forEach((key) => {
    console.log(`   ${key}=***`);
  });

console.log("\n" + "=".repeat(50));
console.log("🎯 DIAGNOSIS:");

if (!fs.existsSync(envPath)) {
  console.log("❌ ISSUE: .env file not found in project root");
  console.log("💡 SOLUTION: Create .env file in", process.cwd());
} else if (!process.env.DISCORD_TOKEN) {
  console.log("❌ ISSUE: .env file exists but variables not loaded");
  console.log(
    "💡 SOLUTION: Check file format and run dotenv.config() before using variables"
  );
} else {
  console.log("✅ Environment variables are loaded correctly");
}
