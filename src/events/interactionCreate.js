// ========================================
// FILE: src/events/interactionCreate.js
// PURPOSE: Complete interaction handler with full Observer system support - FINAL VERSION
// ========================================

const timeBasedService = require("../services/timeBasedMessages");
const onboardingSystem = require("../services/onboardingSystem");
const logger = require("../utils/logger");

/**
 * Complete interaction create event handler
 * Handles all button clicks, modals, and Observer system interactions
 * @param {Object} interaction - Discord interaction object
 */
module.exports = async (interaction) => {
  try {
    // Handle button interactions
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }

    // Handle modal submissions (Observer system)
    else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }

    // Handle slash commands
    else if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    }

    // Handle other interaction types as needed
    else {
      logger.debug(`Unhandled interaction type: ${interaction.type}`);
    }
  } catch (error) {
    logger.error("Error handling interaction:", error);

    try {
      const errorMessage =
        "❌ *An error occurred while processing your interaction.*";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (replyError) {
      logger.error("Failed to send error message:", replyError);
    }
  }
};

/**
 * FIXED: Handles all button interaction events with complete Observer support
 * @param {Object} interaction - Discord button interaction
 */
async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  logger.debug(
    `Button interaction: ${customId} by ${interaction.user.username}`
  );
  console.log(`🔘 Button clicked: ${customId}`);

  try {
    // Handle 8:17 system "Join The Marked" button
    if (customId === "join_the_marked") {
      await timeBasedService.handleJoinMarkedButton(interaction);
    }

    // Handle onboarding assessment begin button
    else if (customId.startsWith("begin_assessment_")) {
      await onboardingSystem.handleBeginAssessment(interaction);
    }

    // Handle onboarding question response buttons
    else if (customId.startsWith("answer_")) {
      await onboardingSystem.handleQuestionResponse(interaction);
    }

    // Handle nickname acceptance button (for both regular and Observer users)
    else if (customId.startsWith("accept_nickname_")) {
      await onboardingSystem.handleNicknameAcceptance(interaction);
    }

    // Handle Observer choice buttons (use generated vs create custom)
    else if (
      customId.startsWith("accept_generated_") ||
      customId.startsWith("create_custom_")
    ) {
      console.log(`   Processing Observer choice button`);
      await onboardingSystem.handleObserverChoice(interaction);
    }

    // Handle Observer modal trigger button
    else if (customId.startsWith("show_observer_modal_")) {
      await onboardingSystem.handleObserverModalButton(interaction);
    }

    // Handle any other custom interactions
    else {
      console.log(`   Unhandled button interaction: ${customId}`);
      logger.debug(`Unhandled button interaction: ${customId}`);

      await interaction.reply({
        content: "Unknown button interaction. Please try again.",
        flags: 64,
      });
    }
  } catch (error) {
    logger.error("Error handling button interaction:", error);
    console.error("Button interaction error details:", {
      customId: interaction.customId,
      userId: interaction.user.id,
      username: interaction.user.username,
      error: error.message,
    });

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "An error occurred processing your interaction. Please try again.",
          flags: 64,
        });
      }
    } catch (replyError) {
      logger.error("Failed to send button error message:", replyError);
    }
  }
}

/**
 * FIXED: Handles all modal submission events with complete Observer support
 * @param {Object} interaction - Discord modal interaction
 */
async function handleModalSubmit(interaction) {
  const customId = interaction.customId;

  logger.debug(`Modal submission: ${customId} by ${interaction.user.username}`);
  console.log(`📝 Modal submitted: ${customId}`);

  try {
    // Handle Observer color detection modal
    if (customId.startsWith("observer_modal_")) {
      console.log(`   Processing Observer color modal`);
      await onboardingSystem.handleObserverModal(interaction);
    }

    // Handle custom Observer name creation modal
    else if (customId.startsWith("custom_observer_modal_")) {
      console.log(`   Processing custom Observer name modal`);
      await onboardingSystem.handleCustomObserverModal(interaction);
    }

    // Handle any other modal submissions
    else {
      console.log(`   Unhandled modal submission: ${customId}`);
      logger.debug(`Unhandled modal submission: ${customId}`);

      await interaction.reply({
        content: "Unknown modal submission. Please try again.",
        flags: 64,
      });
    }
  } catch (error) {
    logger.error("Error handling modal submission:", error);
    console.error("Modal submission error details:", {
      customId: interaction.customId,
      userId: interaction.user.id,
      username: interaction.user.username,
      error: error.message,
    });

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "An error occurred processing your submission. Please try again.",
          flags: 64,
        });
      }
    } catch (replyError) {
      logger.error("Failed to send modal error message:", replyError);
    }
  }
}

/**
 * Handles slash command interactions (placeholder for future expansion)
 * @param {Object} interaction - Discord slash command interaction
 */
async function handleSlashCommand(interaction) {
  logger.debug(
    `Slash command: ${interaction.commandName} by ${interaction.user.username}`
  );

  // Currently no slash commands implemented
  // This is here for future expansion
  await interaction.reply({
    content: "*This command is not yet implemented.*",
    ephemeral: true,
  });
}
