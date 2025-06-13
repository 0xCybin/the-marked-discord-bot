// ========================================
// FILE: src/services/messageGeneration.js (FIXED VERSION)
// PURPOSE: Enhanced DM conversation responses with PROPER completion handling
// ========================================

const config = require("../config/environment");
const database = require("../config/database");
const logger = require("../utils/logger");
const deepseekService = require("./deepseek");
const messageLogger = require("./messageLogger");
const ValidationUtils = require("../utils/validation");

/**
 * Message generation service for ongoing ARG conversations with memory
 * Handles DM responses with progressive encoding degradation and conversation history
 * FIXED: Proper conversation completion and no restarts
 */
class MessageGenerationService {
  /**
   * Handles incoming DM responses from users in ARG conversations
   * @param {Object} message - Discord message object
   * @returns {Promise<void>}
   */
  async handleDMResponse(message) {
    logger.argEvent(
      "dm-received",
      `DM from ${message.author.username}: "${message.content.substring(
        0,
        50
      )}..."`
    );

    // Enhanced logging for debugging
    console.log(`\n📨 DM RECEIVED:`);
    console.log(`   From: ${message.author.username} (${message.author.id})`);
    console.log(`   Content: "${message.content}"`);
    console.log(`   Time: ${new Date().toLocaleString()}`);

    try {
      // Check if user has an active selection with ENHANCED LOGGING
      const activeSelection = await this.getActiveUserSelection(
        message.author.id
      );

      if (!activeSelection) {
        logger.debug(
          `No active selection found for ${message.author.username}, sending error response`
        );
        console.log(`   ❌ No active selection found for this user`);
        console.log(
          `   📨 Sending error response: User has completed conversations or no selection exists`
        );

        // Send the specific error message for completed users
        const errorMessage = "Error_60_No_API_Service";
        try {
          await message.author.send(errorMessage);

          console.log(`   ✅ Sent error response: "${errorMessage}"`);

          // Log this response for tracking
          await messageLogger.logBotMessage(
            message.author.id,
            message.author.username,
            "no-active-selection-error",
            errorMessage,
            "dm"
          );

          logger.argEvent(
            "no-selection-error",
            `Sent error response to ${message.author.username} - no active selection (completed conversations)`
          );
        } catch (sendError) {
          console.log(
            `   ❌ Failed to send error response: ${sendError.message}`
          );
        }

        return;
      }

      console.log(`   ✅ Found active selection (ID: ${activeSelection.id})`);
      console.log(
        `   📊 Current conversation count: ${activeSelection.conversation_count}`
      );
      console.log(`   🔒 Is complete: ${activeSelection.is_complete}`);

      // ENHANCED CHECK: Verify the selection isn't already marked as complete
      if (activeSelection.is_complete) {
        logger.debug(
          `Selection ${activeSelection.id} is already marked as complete, ignoring message`
        );
        console.log(
          `   🛑 Selection is already marked as COMPLETE - ignoring message`
        );
        return;
      }

      // Calculate next conversation count
      const nextConversationCount = activeSelection.conversation_count + 1;

      // ENHANCED LIMIT CHECK with detailed logging
      console.log(`   🧮 LIMIT CHECK:`);
      console.log(
        `     Current conversations: ${activeSelection.conversation_count}`
      );
      console.log(`     Max allowed: ${config.arg.maxConversationRounds}`);
      console.log(`     Next would be: ${nextConversationCount}`);
      console.log(
        `     Has reached limit: ${
          nextConversationCount > config.arg.maxConversationRounds
        }`
      );

      // Check if user has exceeded conversation limit
      if (nextConversationCount > config.arg.maxConversationRounds) {
        logger.debug(
          `User ${message.author.username} has exceeded conversation limit (${nextConversationCount}/${config.arg.maxConversationRounds}), sending error response`
        );
        console.log(
          `   ⛔ User has exceeded conversation limit (${nextConversationCount}/${config.arg.maxConversationRounds}) - SENDING ERROR RESPONSE`
        );

        // Send the specific error message
        const errorMessage = "Error_60_No_API_Service";
        await message.author.send(errorMessage);

        console.log(`   📨 Sent error response: "${errorMessage}"`);

        // Log this response for tracking
        await messageLogger.logBotMessage(
          message.author.id,
          message.author.username,
          "conversation-limit-error",
          errorMessage,
          "dm"
        );

        logger.argEvent(
          "limit-exceeded",
          `Sent error response to ${message.author.username} for exceeding conversation limit`
        );

        return; // EXIT after sending error message
      }

      console.log(`   ✅ User has not reached limit, processing normally`);

      // Get CURRENT CYCLE conversation history only (resets after 3 messages)
      console.log(`   🧠 Retrieving CURRENT cycle history only...`);
      const conversationHistory = await this.getCurrentCycleHistory(
        message.author.id,
        nextConversationCount
      );
      console.log(
        `   📚 Found ${conversationHistory.length} previous messages`
      );

      logger.argEvent(
        "conversation",
        `Processing conversation ${nextConversationCount}/${config.arg.maxConversationRounds} with ${message.author.username}`
      );
      console.log(
        `   📊 Processing conversation ${nextConversationCount}/${config.arg.maxConversationRounds}`
      );

      // Generate encoded response with memory
      const response = await this.generateEncodedResponseWithMemory(
        message.content,
        nextConversationCount,
        activeSelection,
        conversationHistory
      );

      console.log(
        `   🤖 Generated response: "${response.substring(0, 100)}..."`
      );
      console.log(`   📏 Response length: ${response.length} characters`);

      // CRITICAL: Update conversation state BEFORE sending response
      await this.updateConversationState(
        activeSelection.id,
        nextConversationCount,
        config.arg.maxConversationRounds
      );

      // Log the conversation exchange
      await this.logConversationExchange(
        message.author.id,
        message.content,
        response,
        nextConversationCount
      );

      // Send response as a NEW DM
      await message.author.send(response);

      console.log(`   ✅ Response sent successfully!`);
      console.log(`   📊 Updated conversation count: ${nextConversationCount}`);

      logger.argEvent(
        "response-sent",
        `Sent level ${nextConversationCount} response to ${message.author.username}`
      );

      // Check if conversation is now complete
      if (nextConversationCount >= config.arg.maxConversationRounds) {
        logger.argEvent(
          "conversation-complete",
          `Conversation cycle completed for ${message.author.username}`
        );
        console.log(
          `   🎯 Conversation cycle completed for ${message.author.username}`
        );
        console.log(`   🔇 Bot will no longer respond to this user's DMs`);
      }
    } catch (error) {
      logger.error("Error handling DM response:", error);
      console.error(`   ❌ Error handling DM: ${error.message}`);

      // Send a concise fallback response only if we haven't exceeded limits
      try {
        const activeSelection = await this.getActiveUserSelection(
          message.author.id
        );
        if (
          activeSelection &&
          !activeSelection.is_complete &&
          activeSelection.conversation_count + 1 <=
            config.arg.maxConversationRounds
        ) {
          await message.author.send("I'm losing the connection...");
          console.log(`   🔧 Sent fallback response due to error`);
        } else {
          console.log(
            `   🔇 Error occurred but user has reached limit - no fallback response`
          );
        }
      } catch (fallbackError) {
        logger.error("Failed to send fallback response:", fallbackError);
        console.error(
          `   ❌ Fallback response also failed: ${fallbackError.message}`
        );
      }
    }
  }

  /**
   * Gets active user selection from database with ENHANCED debugging and STRICT filtering
   * FIXED: Only gets the MOST RECENT selection and cleans up old ones
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object|null>} Active selection or null
   */
  async getActiveUserSelection(userId) {
    try {
      if (!ValidationUtils.isValidUserId(userId)) {
        throw new Error("Invalid user ID");
      }

      console.log(`   🔍 Searching for active selection for user: ${userId}`);

      // CRITICAL FIX: Get ALL selections for this user first
      const allSelections = await database.executeQuery(
        "SELECT * FROM user_selections WHERE user_id = $1 ORDER BY selected_at DESC",
        [userId]
      );

      console.log(
        `   📊 Found ${allSelections.rows.length} total selections for user`
      );

      if (allSelections.rows.length === 0) {
        return null;
      }

      // CLEANUP: Mark all but the most recent as complete if they're old
      if (allSelections.rows.length > 1) {
        console.log(
          `   🧹 CLEANUP: Found multiple selections, cleaning up old ones...`
        );

        const mostRecentSelection = allSelections.rows[0];
        const oldSelectionIds = allSelections.rows.slice(1).map((s) => s.id);

        if (oldSelectionIds.length > 0) {
          console.log(
            `   🗑️ Marking ${
              oldSelectionIds.length
            } old selections as complete: ${oldSelectionIds.join(", ")}`
          );

          await database.executeQuery(
            `UPDATE user_selections SET is_complete = TRUE 
             WHERE id = ANY($1) AND user_id = $2`,
            [oldSelectionIds, userId]
          );

          console.log(
            `   ✅ Cleaned up ${oldSelectionIds.length} old selections`
          );
        }
      }

      // Now get the most recent selection only
      const result = await database.executeQuery(
        "SELECT * FROM user_selections WHERE user_id = $1 ORDER BY selected_at DESC LIMIT 1",
        [userId]
      );

      console.log(`   📊 After cleanup, checking most recent selection...`);

      if (result.rows.length === 0) {
        console.log(`   ❌ No active selection found after cleanup`);
        return null;
      }

      const selection = result.rows[0];

      // STRICT VALIDATION: Check if this selection is actually usable
      console.log(`   🔍 Validating selection ${selection.id}:`, {
        conversation_count: selection.conversation_count,
        is_complete: selection.is_complete,
        selected_at: selection.selected_at,
      });

      // If already complete, return null
      if (selection.is_complete) {
        console.log(`   🔒 Selection ${selection.id} is marked as complete`);
        return null;
      }

      // If conversation count has reached max, mark as complete and return null
      if (selection.conversation_count >= config.arg.maxConversationRounds) {
        console.log(
          `   🔧 Selection ${selection.id} has reached max conversations (${selection.conversation_count}/${config.arg.maxConversationRounds}) - marking as complete`
        );

        await database.executeQuery(
          "UPDATE user_selections SET is_complete = TRUE WHERE id = $1",
          [selection.id]
        );

        console.log(`   ✅ Marked selection ${selection.id} as complete`);
        return null;
      }

      // Parse activity data
      try {
        selection.activity_data =
          typeof selection.activity_data === "string"
            ? JSON.parse(selection.activity_data)
            : selection.activity_data;
      } catch (parseError) {
        logger.warn("Failed to parse activity data for user selection");
        selection.activity_data = {};
      }

      console.log(`   ✅ Found valid active selection:`, {
        id: selection.id,
        selected_at: selection.selected_at,
        conversation_count: selection.conversation_count,
        is_complete: selection.is_complete,
      });

      return selection;
    } catch (error) {
      logger.error("Error getting active user selection:", error);
      console.error(`   ❌ Database error: ${error.message}`);
      return null;
    }
  }

  /**
   * Generates encoded response with memory and progressive degradation
   * @param {string} userMessage - User's message content
   * @param {number} conversationCount - Current conversation round
   * @param {Object} activeSelection - User's selection data
   * @param {Array} conversationHistory - Previous conversation messages
   * @returns {Promise<string>} Generated response
   */
  async generateEncodedResponseWithMemory(
    userMessage,
    conversationCount,
    activeSelection,
    conversationHistory
  ) {
    const startTime = Date.now();

    try {
      console.log(
        `   🧠 Generating AI response for conversation round ${conversationCount}`
      );
      console.log(
        `   📚 Using ${conversationHistory.length} messages from CURRENT cycle only`
      );

      // Validate message content
      const messageValidation =
        ValidationUtils.validateMessageContent(userMessage);
      if (!messageValidation.isValid) {
        throw new Error("Invalid message content");
      }

      // Use self-aware AI with CURRENT CYCLE MEMORY ONLY
      const response = await deepseekService.generateEncodedResponse(
        messageValidation.content,
        conversationCount,
        activeSelection.activity_data,
        conversationHistory // Only current cycle messages
      );

      const duration = Date.now() - startTime;
      logger.performance("enhanced-encoded-response-with-memory", duration);

      console.log(`   ✅ AI response generated in ${duration}ms`);
      console.log(`   📏 Response length: ${response.length} characters`);

      return response;
    } catch (error) {
      logger.error(
        "AI response generation with memory failed, using fallback:",
        error
      );
      console.log(`   ⚠️ AI failed, using enhanced fallback response`);
      return this.generateEnhancedFallbackResponseWithMemory(
        userMessage,
        conversationCount,
        activeSelection.activity_data,
        conversationHistory
      );
    }
  }

  /**
   * Generates enhanced fallback encoded response with memory when AI fails
   * @param {string} userMessage - User's message
   * @param {number} encodingLevel - Current encoding level
   * @param {Object} userData - User data for context
   * @param {Array} conversationHistory - Previous conversation messages
   * @returns {string} Enhanced fallback response
   */
  generateEnhancedFallbackResponseWithMemory(
    userMessage,
    encodingLevel,
    userData,
    conversationHistory
  ) {
    logger.debug(
      `Generating enhanced fallback response with memory for level ${encodingLevel}`
    );

    // Use the enhanced fallback from DeepSeek service with memory
    return deepseekService.generateEnhancedFallback(
      userMessage,
      encodingLevel,
      userData,
      conversationHistory
    );
  }

  /**
   * Updates conversation state in database with ENHANCED logging and STRICT completion
   * @param {number} selectionId - Selection ID
   * @param {number} conversationCount - New conversation count
   * @param {number} maxRounds - Maximum conversation rounds
   * @returns {Promise<void>}
   */
  async updateConversationState(selectionId, conversationCount, maxRounds) {
    try {
      const isComplete = conversationCount >= maxRounds;

      console.log(`   📝 Updating conversation state:`, {
        selectionId,
        conversationCount,
        maxRounds,
        isComplete,
      });

      // CRITICAL: Use proper boolean value for PostgreSQL
      const result = await database.executeQuery(
        "UPDATE user_selections SET conversation_count = $1, last_message_at = $2, is_complete = $3 WHERE id = $4 RETURNING *",
        [conversationCount, new Date(), isComplete, selectionId]
      );

      if (result.rows.length === 0) {
        throw new Error(`No selection found with ID ${selectionId}`);
      }

      const updatedSelection = result.rows[0];
      console.log(`   ✅ Database updated successfully`);
      console.log(`   📊 Updated selection state:`, {
        id: updatedSelection.id,
        conversation_count: updatedSelection.conversation_count,
        is_complete: updatedSelection.is_complete,
      });

      // VERIFICATION: Double-check the update worked
      if (isComplete && !updatedSelection.is_complete) {
        console.log(
          `   ⚠️ WARNING: Update may have failed - is_complete should be true but is ${updatedSelection.is_complete}`
        );

        // Force another update
        await database.executeQuery(
          "UPDATE user_selections SET is_complete = TRUE WHERE id = $1",
          [selectionId]
        );
        console.log(
          `   🔧 Forced completion update for selection ${selectionId}`
        );
      }

      logger.database(
        "update",
        `Updated conversation state for selection ${selectionId}: count=${conversationCount}, complete=${isComplete}`
      );
    } catch (error) {
      logger.error("Error updating conversation state:", error);
      console.error(`   ❌ Database update failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Logs conversation exchange to database (for memory system)
   * @param {string} userId - Discord user ID
   * @param {string} userMessage - User's message
   * @param {string} botResponse - Bot's response
   * @param {number} encodingLevel - Current encoding level
   * @returns {Promise<void>}
   */
  async logConversationExchange(
    userId,
    userMessage,
    botResponse,
    encodingLevel
  ) {
    try {
      if (!ValidationUtils.isValidUserId(userId)) {
        throw new Error("Invalid user ID for conversation logging");
      }

      if (!ValidationUtils.isValidEncodingLevel(encodingLevel)) {
        throw new Error("Invalid encoding level for conversation logging");
      }

      // Log user message
      await database.executeQuery(
        "INSERT INTO conversation_logs (user_id, message_content, is_user_message, encoding_level) VALUES ($1, $2, $3, $4)",
        [userId, userMessage, true, 0]
      );

      // Log bot response
      await database.executeQuery(
        "INSERT INTO conversation_logs (user_id, message_content, is_user_message, encoding_level) VALUES ($1, $2, $3, $4)",
        [userId, botResponse, false, encodingLevel]
      );

      logger.database(
        "insert",
        `Logged conversation exchange for user ${userId}`
      );
    } catch (error) {
      logger.error("Error logging conversation exchange:", error);
      // Don't throw here as logging failure shouldn't stop the conversation
    }
  }

  /**
   * Gets CURRENT conversation cycle history only (resets after 3 exchanges)
   * @param {string} userId - Discord user ID
   * @param {number} currentConversationCount - Current conversation round
   * @returns {Promise<Array>} Current cycle conversation history only
   */
  async getCurrentCycleHistory(userId, currentConversationCount) {
    try {
      if (!ValidationUtils.isValidUserId(userId)) {
        throw new Error("Invalid user ID");
      }

      // Only get messages from the current conversation cycle
      // We calculate how many messages should exist in this cycle
      const expectedMessagesInCycle = (currentConversationCount - 1) * 2; // Each round = user + bot message

      if (expectedMessagesInCycle <= 0) {
        console.log(`   📚 First message of cycle - no history to retrieve`);
        return [];
      }

      const result = await database.executeQuery(
        `SELECT message_content, is_user_message, encoding_level, created_at
         FROM conversation_logs 
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, expectedMessagesInCycle]
      );

      // Return in chronological order (oldest first) for proper context
      const history = result.rows.reverse();

      console.log(
        `   📚 Retrieved ${history.length} messages from CURRENT cycle only (round ${currentConversationCount})`
      );

      return history;
    } catch (error) {
      logger.error("Error getting current cycle history:", error);
      return [];
    }
  }

  /**
   * Gets conversation history for a user (FULL HISTORY - for admin/debug only)
   * @param {string} userId - Discord user ID
   * @param {number} limit - Maximum number of messages to retrieve
   * @returns {Promise<Array>} Full conversation history
   */
  async getConversationHistory(userId, limit = 20) {
    try {
      if (!ValidationUtils.isValidUserId(userId)) {
        throw new Error("Invalid user ID");
      }

      const result = await database.executeQuery(
        `SELECT message_content, is_user_message, encoding_level, created_at
         FROM conversation_logs 
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      // Return in chronological order (oldest first)
      const history = result.rows.reverse();

      return history;
    } catch (error) {
      logger.error("Error getting conversation history:", error);
      return [];
    }
  }

  /**
   * ENHANCED: Manual debug function to test DM handling with detailed state checking
   * @param {string} userId - User ID to test
   * @param {string} messageContent - Test message content
   * @returns {Promise<Object>} Detailed debug information
   */
  async debugDMHandling(userId, messageContent = "test message") {
    console.log(
      `\n🔧 DEBUG: Testing DM handling with memory for user ${userId}`
    );

    try {
      // Check for active selection with detailed logging
      console.log(`\n🔍 Step 1: Checking for active selection...`);
      const activeSelection = await this.getActiveUserSelection(userId);

      // Get conversation history
      console.log(`\n📚 Step 2: Checking conversation history...`);
      const conversationHistory = await this.getConversationHistory(userId, 10);

      // Check ALL selections for this user
      console.log(`\n📊 Step 3: Checking all user selections...`);
      const allSelections = await database.executeQuery(
        "SELECT id, selected_at, conversation_count, is_complete FROM user_selections WHERE user_id = $1 ORDER BY selected_at DESC",
        [userId]
      );

      const debugInfo = {
        userId,
        hasActiveSelection: !!activeSelection,
        activeSelection: activeSelection,
        allSelections: allSelections.rows,
        totalSelections: allSelections.rows.length,
        conversationCount: activeSelection?.conversation_count || 0,
        isComplete: activeSelection?.is_complete || false,
        canRespond: false,
        conversationHistory: conversationHistory,
        historyLength: conversationHistory.length,
        maxConversationRounds: config.arg.maxConversationRounds,
      };

      if (activeSelection) {
        const nextCount = activeSelection.conversation_count + 1;
        debugInfo.nextConversationCount = nextCount;
        debugInfo.canRespond =
          !activeSelection.is_complete &&
          ValidationUtils.isValidConversationCount(
            nextCount,
            config.arg.maxConversationRounds
          );
        debugInfo.wouldExceedLimit =
          nextCount > config.arg.maxConversationRounds;
      }

      console.log(`\n🔍 DETAILED DEBUG RESULTS:`);
      console.log(`   User ID: ${debugInfo.userId}`);
      console.log(`   Has Active Selection: ${debugInfo.hasActiveSelection}`);
      console.log(`   Total Selections in DB: ${debugInfo.totalSelections}`);

      if (debugInfo.activeSelection) {
        console.log(`   Active Selection ID: ${debugInfo.activeSelection.id}`);
        console.log(
          `   Current Count: ${debugInfo.activeSelection.conversation_count}`
        );
        console.log(`   Is Complete: ${debugInfo.activeSelection.is_complete}`);
        console.log(
          `   Next Count Would Be: ${debugInfo.nextConversationCount}`
        );
        console.log(`   Can Respond: ${debugInfo.canRespond}`);
        console.log(`   Would Exceed Limit: ${debugInfo.wouldExceedLimit}`);
      }

      console.log(`   History Length: ${debugInfo.historyLength}`);
      console.log(`   Max Rounds Allowed: ${debugInfo.maxConversationRounds}`);

      if (debugInfo.allSelections.length > 0) {
        console.log(`\n📋 All selections for this user:`);
        debugInfo.allSelections.forEach((sel, i) => {
          console.log(
            `     ${i + 1}. ID: ${sel.id}, Count: ${
              sel.conversation_count
            }, Complete: ${sel.is_complete}, Date: ${sel.selected_at}`
          );
        });
      }

      return debugInfo;
    } catch (error) {
      console.error(`❌ Debug failed: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * Gets recent conversation summary for a user (for admin commands)
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object>} Conversation summary
   */
  async getConversationSummary(userId) {
    try {
      const fullHistory = await this.getConversationHistory(userId, 20);
      const activeSelection = await this.getActiveUserSelection(userId);

      // Get current cycle history
      const currentCycleHistory = activeSelection
        ? await this.getCurrentCycleHistory(
            userId,
            activeSelection.conversation_count + 1
          )
        : [];

      const userMessages = fullHistory.filter((msg) => msg.is_user_message);
      const botMessages = fullHistory.filter((msg) => !msg.is_user_message);

      return {
        userId,
        hasActiveSelection: !!activeSelection,
        totalMessages: fullHistory.length,
        userMessages: userMessages.length,
        botMessages: botMessages.length,
        conversationCount: activeSelection?.conversation_count || 0,
        isComplete: activeSelection?.is_complete || false,
        lastActivity:
          fullHistory.length > 0
            ? fullHistory[fullHistory.length - 1].created_at
            : null,
        recentMessages: fullHistory.slice(-5), // Last 5 from full history
        currentCycleMessages: currentCycleHistory, // Current cycle only
        currentCycleLength: currentCycleHistory.length,
      };
    } catch (error) {
      logger.error("Error getting conversation summary:", error);
      return null;
    }
  }

  /**
   * Tests message generation with current cycle memory only
   * @param {string} userId - User ID to test
   * @param {string} testMessage - Test message content
   * @returns {Promise<string>} Generated response
   */
  async testMessageGenerationWithMemory(userId, testMessage) {
    try {
      const activeSelection = await this.getActiveUserSelection(userId);
      if (!activeSelection) {
        throw new Error("No active selection for user");
      }

      const nextCount = (activeSelection.conversation_count || 0) + 1;

      // Check if this would exceed the limit
      if (nextCount > config.arg.maxConversationRounds) {
        throw new Error(
          `Would exceed conversation limit (${nextCount}/${config.arg.maxConversationRounds})`
        );
      }

      // Get CURRENT CYCLE history only
      const conversationHistory = await this.getCurrentCycleHistory(
        userId,
        nextCount
      );

      console.log(
        `🧪 Testing message generation with ${conversationHistory.length} CURRENT CYCLE messages`
      );

      const response = await this.generateEncodedResponseWithMemory(
        testMessage,
        nextCount,
        activeSelection,
        conversationHistory
      );

      console.log(`✅ Test response generated: "${response}"`);
      console.log(`📏 Response length: ${response.length} characters`);
      console.log(
        `🔄 Using memory from current cycle only (round ${nextCount})`
      );

      return response;
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * DIAGNOSTIC: Checks for and fixes any corrupted selection data
   * @param {string} userId - User ID to check and fix
   * @returns {Promise<Object>} Diagnostic results
   */
  async diagnoseAndFixUserSelections(userId) {
    console.log(`\n🩺 DIAGNOSING USER SELECTIONS FOR ${userId}...`);

    try {
      // Get all selections for user
      const allSelections = await database.executeQuery(
        "SELECT * FROM user_selections WHERE user_id = $1 ORDER BY selected_at DESC",
        [userId]
      );

      console.log(`Found ${allSelections.rows.length} total selections`);

      const diagnostics = {
        totalSelections: allSelections.rows.length,
        incompleteSelections: 0,
        corruptedSelections: 0,
        fixedSelections: 0,
        activeSelections: 0,
      };

      for (const selection of allSelections.rows) {
        console.log(`\n📋 Checking selection ${selection.id}:`);
        console.log(
          `   Count: ${selection.conversation_count}, Complete: ${selection.is_complete}`
        );

        // Check if selection is corrupted (count >= max but not marked complete)
        if (
          selection.conversation_count >= config.arg.maxConversationRounds &&
          !selection.is_complete
        ) {
          console.log(
            `   🔧 CORRUPTED: Count >= max but not marked complete - fixing...`
          );

          await database.executeQuery(
            "UPDATE user_selections SET is_complete = TRUE WHERE id = $1",
            [selection.id]
          );

          diagnostics.corruptedSelections++;
          diagnostics.fixedSelections++;
          console.log(`   ✅ Fixed selection ${selection.id}`);
        } else if (!selection.is_complete) {
          diagnostics.incompleteSelections++;

          if (selection.conversation_count < config.arg.maxConversationRounds) {
            diagnostics.activeSelections++;
            console.log(`   ✅ Valid active selection`);
          }
        }
      }

      console.log(`\n🩺 DIAGNOSIS COMPLETE:`);
      console.log(`   Total selections: ${diagnostics.totalSelections}`);
      console.log(
        `   Incomplete selections: ${diagnostics.incompleteSelections}`
      );
      console.log(
        `   Active (valid) selections: ${diagnostics.activeSelections}`
      );
      console.log(
        `   Corrupted selections found: ${diagnostics.corruptedSelections}`
      );
      console.log(`   Selections fixed: ${diagnostics.fixedSelections}`);

      return diagnostics;
    } catch (error) {
      console.error(`❌ Diagnosis failed: ${error.message}`);
      return { error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new MessageGenerationService();
