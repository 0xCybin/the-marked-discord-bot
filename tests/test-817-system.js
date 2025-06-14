// ========================================
// FILE: tests/test-817-system.js
// PURPOSE: Comprehensive testing for the 8:17 recruitment system
// ========================================

const timeBasedService = require("../src/services/timeBasedMessages");
const logger = require("../src/utils/logger");

/**
 * Mock Discord message object for testing
 */
function createMockMessage(authorUsername = "TestUser") {
  return {
    author: {
      username: authorUsername,
      send: async (content) => {
        console.log(`📨 DM SENT TO ${authorUsername}:`);
        console.log(
          `   Content: ${
            typeof content === "string"
              ? content
              : JSON.stringify(content, null, 2)
          }`
        );
        return { id: "mock_message_id" };
      },
    },
    reply: async (content) => {
      console.log(`💬 REPLY TO ${authorUsername}:`);
      console.log(
        `   Content: ${
          typeof content === "string"
            ? content
            : JSON.stringify(content, null, 2)
        }`
      );
      return { id: "mock_reply_id" };
    },
    channel: {
      type: 0, // Guild text channel
    },
  };
}

/**
 * Mock Discord interaction for button testing
 */
function createMockInteraction(userId = "123456789", username = "TestUser") {
  return {
    user: {
      id: userId,
      username: username,
    },
    customId: "join_the_marked",
    reply: async (options) => {
      console.log(`🔘 BUTTON INTERACTION RESPONSE TO ${username}:`);
      console.log(`   Content: ${options.content}`);
      console.log(`   Ephemeral: ${options.ephemeral}`);
      return { id: "mock_interaction_id" };
    },
    client: {
      guilds: {
        cache: {
          first: () => ({
            members: {
              fetch: async (userId) => ({
                user: { username: username },
                roles: {
                  cache: {
                    has: (roleId) => false, // User doesn't have role yet
                  },
                  add: async (role, reason) => {
                    console.log(
                      `✅ ROLE ADDED TO ${username}: ${role.name} (Reason: ${reason})`
                    );
                    return true;
                  },
                },
              }),
            },
            roles: {
              cache: {
                find: (predicate) => ({
                  id: "mock_role_id",
                  name: "The Marked",
                  members: { size: 5 },
                }),
              },
            },
          }),
        },
      },
    },
  };
}

/**
 * Test 8:17 message detection at different times
 */
async function test817Detection() {
  console.log("\n🕐 TESTING 8:17 DETECTION LOGIC");
  console.log("=" * 50);

  const testTimes = [
    { hour: 8, minute: 17, description: "8:17 AM" },
    { hour: 20, minute: 17, description: "8:17 PM" },
    { hour: 8, minute: 16, description: "8:16 AM (should not trigger)" },
    { hour: 8, minute: 18, description: "8:18 AM (should not trigger)" },
    { hour: 15, minute: 17, description: "3:17 PM (should not trigger)" },
  ];

  for (const testTime of testTimes) {
    console.log(`\n⏰ Testing ${testTime.description}...`);

    // Mock the current time
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
      }

      getHours() {
        return testTime.hour;
      }
      getMinutes() {
        return testTime.minute;
      }

      static now() {
        return originalDate.now();
      }
    };

    const mockMessage = createMockMessage(
      `User_${testTime.hour}_${testTime.minute}`
    );

    try {
      await timeBasedService.handle817Messages(mockMessage);
      console.log(`   ✅ Test completed for ${testTime.description}`);
    } catch (error) {
      console.log(
        `   ❌ Error during ${testTime.description}: ${error.message}`
      );
    }

    // Restore original Date
    global.Date = originalDate;
  }
}

/**
 * Test the join button interaction
 */
async function testJoinButton() {
  console.log("\n🔘 TESTING JOIN BUTTON INTERACTION");
  console.log("=" * 50);

  const testUsers = [
    { id: "111111111", username: "NewUser1" },
    { id: "222222222", username: "ExistingMarked" },
    { id: "333333333", username: "TestUser3" },
  ];

  for (const user of testUsers) {
    console.log(`\n👤 Testing button click for ${user.username}...`);

    const mockInteraction = createMockInteraction(user.id, user.username);

    // Simulate existing role for second user
    if (user.username === "ExistingMarked") {
      mockInteraction.client.guilds.cache.first = () => ({
        members: {
          fetch: async () => ({
            user: { username: user.username },
            roles: {
              cache: {
                has: () => true, // Already has the role
              },
            },
          }),
        },
        roles: {
          cache: {
            find: () => ({ id: "mock_role_id", name: "The Marked" }),
          },
        },
      });
    }

    try {
      await timeBasedService.handleJoinMarkedButton(mockInteraction);
      console.log(
        `   ✅ Button interaction test completed for ${user.username}`
      );
    } catch (error) {
      console.log(
        `   ❌ Button interaction error for ${user.username}: ${error.message}`
      );
    }
  }
}

/**
 * Test active time detection
 */
async function testActiveTimeDetection() {
  console.log("\n🌙 TESTING ARG ACTIVE TIME DETECTION");
  console.log("=" * 50);

  const testTimes = [
    { hour: 8, minute: 17, expected: true, description: "8:17 AM" },
    { hour: 20, minute: 17, expected: true, description: "8:17 PM" },
    {
      hour: 22,
      minute: 30,
      expected: true,
      description: "10:30 PM (night hours)",
    },
    {
      hour: 2,
      minute: 15,
      expected: true,
      description: "2:15 AM (night hours)",
    },
    {
      hour: 12,
      minute: 30,
      expected: false,
      description: "12:30 PM (day hours)",
    },
    {
      hour: 15,
      minute: 45,
      expected: false,
      description: "3:45 PM (day hours)",
    },
  ];

  for (const testTime of testTimes) {
    // Mock the current time
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
      }

      getHours() {
        return testTime.hour;
      }
      getMinutes() {
        return testTime.minute;
      }

      static now() {
        return originalDate.now();
      }
    };

    const isActive = timeBasedService.isARGActiveTime();
    const result = isActive === testTime.expected ? "✅ PASS" : "❌ FAIL";

    console.log(
      `   ${result} ${testTime.description}: Expected ${testTime.expected}, Got ${isActive}`
    );

    // Restore original Date
    global.Date = originalDate;
  }
}

/**
 * Test next 8:17 calculation
 */
async function testNext817Calculation() {
  console.log("\n🔮 TESTING NEXT 8:17 TIME CALCULATION");
  console.log("=" * 50);

  const testScenarios = [
    { hour: 7, minute: 30, description: "7:30 AM" },
    { hour: 8, minute: 30, description: "8:30 AM" },
    { hour: 15, minute: 45, description: "3:45 PM" },
    { hour: 21, minute: 30, description: "9:30 PM" },
  ];

  for (const scenario of testScenarios) {
    // Mock the current time
    const originalDate = global.Date;
    const mockNow = new originalDate();
    mockNow.setHours(scenario.hour, scenario.minute, 0, 0);

    global.Date = class extends originalDate {
      constructor() {
        super();
      }

      static now() {
        return mockNow.getTime();
      }
    };

    // Override the Date constructor to return our mock time
    global.Date.prototype.getHours = function () {
      return scenario.hour;
    };
    global.Date.prototype.getMinutes = function () {
      return scenario.minute;
    };

    const next817 = timeBasedService.getNext817Time();
    console.log(`   Current: ${scenario.description}`);
    console.log(
      `   Next 8:17: ${next817.getHours()}:${next817
        .getMinutes()
        .toString()
        .padStart(2, "0")} on ${next817.toDateString()}`
    );

    // Restore original Date
    global.Date = originalDate;
  }
}

/**
 * Interactive test mode for manual testing
 */
async function interactiveTest() {
  console.log("\n🎮 INTERACTIVE TEST MODE");
  console.log("=" * 50);
  console.log(
    "This will simulate a message at the CURRENT TIME to test real-time behavior."
  );

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  console.log(`Current time: ${currentTime}`);
  console.log(
    `Is 8:17? ${
      (now.getHours() === 8 || now.getHours() === 20) && now.getMinutes() === 17
    }`
  );
  console.log(`Is ARG active time? ${timeBasedService.isARGActiveTime()}`);

  const mockMessage = createMockMessage("InteractiveTestUser");

  console.log("\n🚀 Sending test message...");
  try {
    await timeBasedService.handle817Messages(mockMessage);
    console.log("✅ Interactive test completed");
  } catch (error) {
    console.log(`❌ Interactive test error: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log("🧪 STARTING 8:17 SYSTEM COMPREHENSIVE TESTS");
  console.log("=" * 60);

  try {
    await test817Detection();
    await testActiveTimeDetection();
    await testNext817Calculation();
    await testJoinButton();
    await interactiveTest();

    console.log("\n🎉 ALL TESTS COMPLETED");
    console.log("=" * 60);
  } catch (error) {
    console.error("❌ Test suite failed:", error);
  }
}

// Check if this file is being run directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  test817Detection,
  testJoinButton,
  testActiveTimeDetection,
  testNext817Calculation,
  interactiveTest,
};
