// ========================================
// FILE: src/services/dataCollection.js
// PURPOSE: Enhanced user data collection from Discord for ARG profiling (Modified)
// ========================================

const logger = require("../utils/logger");
const ValidationUtils = require("../utils/validation");

/**
 * Enhanced user data collection service for ARG profiling
 * Collects focused user activity and behavioral data from Discord
 */
class DataCollectionService {
  /**
   * Collects focused user data from Discord member
   * @param {Object} member - Discord member object
   * @param {Object} guild - Discord guild object
   * @returns {Promise<Object>} Focused user data structure
   */
  async collectEnhancedUserData(member, guild) {
    const startTime = Date.now();
    logger.argEvent(
      "data-collection",
      `Starting focused data collection for ${member.user.username}`
    );

    // Initialize focused data structure
    const userData = {
      basic: {},
      presence: {},
      profile: {},
      recentActivity: {
        games: [],
        spotify: null,
        streaming: null,
        applications: [],
      },
      behavioral: {},
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. BASIC USER INFORMATION (minimal)
      userData.basic = await this.collectBasicUserInfo(member);

      // 2. ENHANCED PRESENCE DATA
      userData.presence = await this.collectPresenceData(member);

      // 3. RECENT ACTIVITY ANALYSIS (main focus)
      userData.recentActivity = await this.analyzeRecentActivity(member);

      // 4. MINIMAL USER PROFILE
      userData.profile = await this.collectMinimalProfile(member);

      // 5. BEHAVIORAL ANALYSIS (focused on activity patterns)
      userData.behavioral = await this.performBehavioralAnalysis(
        member,
        userData
      );

      const duration = Date.now() - startTime;
      logger.performance("data-collection", duration);
      logger.argEvent(
        "data-collection",
        `Completed for ${member.user.username} - ${this.calculateDataRichness(
          userData
        )}% activity richness`
      );

      return userData;
    } catch (error) {
      logger.error("Enhanced data collection failed:", error);
      // Return partial data structure even on error
      return userData;
    }
  }

  /**
   * Collects minimal basic user information
   * @param {Object} member - Discord member object
   * @returns {Promise<Object>} Basic user information
   */
  async collectBasicUserInfo(member) {
    logger.debug("Collecting basic user information...");

    return {
      username: member.user.username,
      displayName: member.displayName,
      userId: member.user.id,
      isBot: member.user.bot,
      avatar: member.user.displayAvatarURL(),
    };
  }

  /**
   * Collects and analyzes user presence data including activities
   * @param {Object} member - Discord member object
   * @returns {Promise<Object>} Presence data with activities
   */
  async collectPresenceData(member) {
    logger.debug("Collecting presence data...");

    const presenceData = {
      status: member.presence?.status || "offline",
      activities: [],
      clientStatus: member.presence?.clientStatus || {},
    };

    if (member.presence?.activities) {
      presenceData.activities = member.presence.activities.map((activity) => ({
        name: activity.name,
        type: activity.type,
        details: activity.details || null,
        state: activity.state || null,
        timestamps: activity.timestamps || null,
        assets: activity.assets || null,
        party: activity.party || null,
        applicationId: activity.applicationId || null,
        url: activity.url || null,
      }));
    }

    return presenceData;
  }

  /**
   * Analyzes recent activity and categorizes by type (main data focus)
   * @param {Object} member - Discord member object
   * @returns {Promise<Object>} Categorized recent activity data
   */
  async analyzeRecentActivity(member) {
    logger.debug("Analyzing recent activity...");

    const activityData = {
      games: [],
      spotify: null,
      streaming: null,
      applications: [],
    };

    if (!member.presence?.activities) {
      return activityData;
    }

    for (const activity of member.presence.activities) {
      const activityInfo = {
        name: activity.name,
        type: activity.type,
        details: activity.details || null,
        state: activity.state || null,
        timestamps: activity.timestamps || null,
        assets: activity.assets || null,
        party: activity.party || null,
        applicationId: activity.applicationId || null,
        url: activity.url || null,
      };

      switch (activity.type) {
        case 0: // Playing
          activityData.games.push({
            ...activityInfo,
            startedAt: activity.timestamps?.start
              ? new Date(activity.timestamps.start)
              : null,
            largeImage: activity.assets?.largeImageURL() || null,
            smallImage: activity.assets?.smallImageURL() || null,
          });
          break;

        case 1: // Streaming
          activityData.streaming = {
            ...activityInfo,
            platform: this.identifyStreamingPlatform(activity.url),
          };
          break;

        case 2: // Listening (Spotify)
          if (activity.name === "Spotify") {
            activityData.spotify = {
              song: activity.details,
              artist: activity.state,
              album: activity.assets?.largeText,
              trackId: activity.syncId,
              startedAt: activity.timestamps?.start
                ? new Date(activity.timestamps.start)
                : null,
              endsAt: activity.timestamps?.end
                ? new Date(activity.timestamps.end)
                : null,
              albumArt: activity.assets?.largeImageURL(),
              duration:
                activity.timestamps?.end && activity.timestamps?.start
                  ? activity.timestamps.end - activity.timestamps.start
                  : null,
            };
          } else {
            activityData.applications.push({
              ...activityInfo,
              category: "listening",
            });
          }
          break;

        case 3: // Watching
          activityData.applications.push({
            ...activityInfo,
            category: "watching",
          });
          break;

        case 5: // Competing
          activityData.applications.push({
            ...activityInfo,
            category: "competing",
          });
          break;
      }
    }

    return activityData;
  }

  /**
   * Identifies streaming platform from URL
   * @param {string} url - Streaming URL
   * @returns {string} Platform name
   */
  identifyStreamingPlatform(url) {
    if (!url) return "Unknown";

    if (url.includes("twitch")) return "Twitch";
    if (url.includes("youtube")) return "YouTube";
    if (url.includes("kick")) return "Kick";

    return "Unknown";
  }

  /**
   * Collects minimal user profile information
   * @param {Object} member - Discord member object
   * @returns {Promise<Object>} Minimal profile data
   */
  async collectMinimalProfile(member) {
    logger.debug("Collecting minimal profile...");

    const profileData = {
      customStatus: null,
      premiumType: member.user.premiumType,
      banner: null,
      accentColor: null,
    };

    try {
      const detailedUser = await member.user.fetch(true);

      if (detailedUser.banner) {
        profileData.banner = detailedUser.bannerURL({ size: 512 });
      }

      if (detailedUser.accentColor) {
        profileData.accentColor = detailedUser.accentColor;
      }

      // Extract custom status from activities
      const customActivity = member.presence?.activities?.find(
        (activity) => activity.type === 4
      );
      if (customActivity) {
        profileData.customStatus = {
          text: customActivity.state,
          emoji: customActivity.emoji,
        };
      }
    } catch (profileError) {
      logger.debug(`Could not fetch detailed profile: ${profileError.message}`);
    }

    return profileData;
  }

  /**
   * Performs focused behavioral analysis based on activity patterns
   * @param {Object} member - Discord member object
   * @param {Object} userData - Collected user data
   * @returns {Promise<Object>} Behavioral analysis data
   */
  async performBehavioralAnalysis(member, userData) {
    logger.debug("Performing behavioral analysis...");

    const behavioralData = {};

    // Time-based behavior analysis
    const currentHour = new Date().getHours();
    behavioralData.currentActiveHour = currentHour;
    behavioralData.isNightOwl = currentHour >= 22 || currentHour <= 6;
    behavioralData.isEarlyBird = currentHour >= 5 && currentHour <= 9;

    // Gaming analysis
    if (userData.recentActivity?.games?.length > 0) {
      behavioralData.gameGenres = this.analyzeGameGenres(
        userData.recentActivity.games
      );
      behavioralData.totalGamingTime = this.calculateGamingTime(
        userData.recentActivity.games
      );
      behavioralData.currentGame =
        userData.recentActivity.games[0]?.name || null;
    }

    // Music analysis
    if (userData.recentActivity?.spotify) {
      const spotify = userData.recentActivity.spotify;
      behavioralData.musicGenre = this.analyzeArtistGenre(spotify.artist);
      behavioralData.songMood = this.analyzeSongMood(
        spotify.song,
        spotify.artist
      );
      behavioralData.listeningDuration = spotify.duration;
      behavioralData.musicTiming = this.analyzeMusicTiming(
        currentHour,
        spotify.song
      );
      behavioralData.currentSong = spotify.song || null;
      behavioralData.currentArtist = spotify.artist || null;
    }

    // Activity type analysis
    behavioralData.activityTypes = this.categorizeUserActivity(
      userData.recentActivity
    );

    return behavioralData;
  }

  /**
   * Categorizes user activity into behavioral patterns
   * @param {Object} recentActivity - Recent activity data
   * @returns {Object} Activity categorization
   */
  categorizeUserActivity(recentActivity) {
    const categories = {
      gaming: recentActivity.games?.length > 0,
      music: !!recentActivity.spotify,
      streaming: !!recentActivity.streaming,
      productivity: false,
      social: false,
    };

    // Check for productivity apps
    if (recentActivity.applications?.length > 0) {
      const productivityApps = [
        "Visual Studio Code",
        "Photoshop",
        "Chrome",
        "Firefox",
        "Notion",
        "Discord",
      ];
      categories.productivity = recentActivity.applications.some((app) =>
        productivityApps.some((prodApp) => app.name?.includes(prodApp))
      );
    }

    // Check for social activity indicators
    categories.social =
      recentActivity.applications?.some(
        (app) =>
          app.name?.toLowerCase().includes("discord") ||
          app.name?.toLowerCase().includes("steam")
      ) || false;

    return categories;
  }

  /**
   * Analyzes game genres from gaming activity
   * @param {Array} games - Array of game objects
   * @returns {Array} Genre analysis results
   */
  analyzeGameGenres(games) {
    const genreMap = {
      Valorant: "FPS/Competitive",
      "League of Legends": "MOBA/Competitive",
      "Counter-Strike": "FPS/Competitive",
      CS2: "FPS/Competitive",
      Minecraft: "Sandbox/Creative",
      "Among Us": "Social/Party",
      Discord: "Social/Communication",
      Spotify: "Music/Entertainment",
      Chrome: "Web/Productivity",
      "Visual Studio Code": "Development/Programming",
      Photoshop: "Creative/Design",
      Steam: "Gaming Platform",
      Overwatch: "FPS/Team",
      Fortnite: "Battle Royale",
      "Apex Legends": "Battle Royale",
      "World of Warcraft": "MMORPG",
      "Genshin Impact": "RPG/Gacha",
    };

    return games.map((game) => ({
      name: game.name,
      genre: genreMap[game.name] || "Unknown",
      details: game.details,
    }));
  }

  /**
   * Calculates total gaming time from timestamps
   * @param {Array} games - Array of game objects
   * @returns {number} Total gaming time in milliseconds
   */
  calculateGamingTime(games) {
    return games.reduce((total, game) => {
      if (game.timestamps?.start) {
        const duration = Date.now() - game.timestamps.start;
        return total + duration;
      }
      return total;
    }, 0);
  }

  /**
   * Analyzes artist genre from Spotify data
   * @param {string} artist - Artist name
   * @returns {string} Detected genre
   */
  analyzeArtistGenre(artist) {
    const genreMap = {
      "Taylor Swift": "Pop",
      Drake: "Hip-Hop/Rap",
      "The Weeknd": "R&B/Pop",
      "Billie Eilish": "Alternative Pop",
      "Post Malone": "Hip-Hop/Pop Rock",
      "Ariana Grande": "Pop/R&B",
      "Travis Scott": "Hip-Hop/Rap",
      "Olivia Rodrigo": "Pop/Rock",
      "Dua Lipa": "Pop/Dance",
      "Bad Bunny": "Reggaeton/Latin",
      "Ed Sheeran": "Pop/Folk",
      "Harry Styles": "Pop/Rock",
      "Lil Nas X": "Hip-Hop/Pop",
      "Juice WRLD": "Hip-Hop/Emo Rap",
      XXXTentacion: "Hip-Hop/Alternative",
    };

    return genreMap[artist] || "Unknown Genre";
  }

  /**
   * Analyzes song mood from title and artist
   * @param {string} song - Song title
   * @param {string} artist - Artist name
   * @returns {string} Detected mood
   */
  analyzeSongMood(song, artist) {
    const sadKeywords = [
      "sad",
      "cry",
      "alone",
      "heart",
      "break",
      "hurt",
      "pain",
      "miss",
      "lost",
      "empty",
      "tears",
      "goodbye",
      "sorry",
    ];
    const happyKeywords = [
      "happy",
      "good",
      "love",
      "dance",
      "party",
      "fun",
      "celebrate",
      "joy",
      "smile",
      "sunshine",
      "beautiful",
    ];
    const darkKeywords = [
      "dark",
      "death",
      "kill",
      "hate",
      "angry",
      "rage",
      "destroy",
      "blood",
      "nightmare",
      "demon",
      "hell",
    ];
    const energeticKeywords = [
      "energy",
      "power",
      "strong",
      "fight",
      "battle",
      "rise",
      "fire",
      "beast",
      "wild",
      "loud",
    ];

    const songLower = song.toLowerCase();

    if (sadKeywords.some((keyword) => songLower.includes(keyword)))
      return "Melancholy";
    if (darkKeywords.some((keyword) => songLower.includes(keyword)))
      return "Dark";
    if (energeticKeywords.some((keyword) => songLower.includes(keyword)))
      return "Energetic";
    if (happyKeywords.some((keyword) => songLower.includes(keyword)))
      return "Upbeat";

    return "Neutral";
  }

  /**
   * Analyzes music listening timing context
   * @param {number} hour - Current hour (0-23)
   * @param {string} song - Song title
   * @returns {string} Timing context
   */
  analyzeMusicTiming(hour, song) {
    if (hour >= 22 || hour <= 6) {
      return "Late Night Listening";
    } else if (hour >= 6 && hour <= 10) {
      return "Morning Motivation";
    } else if (hour >= 17 && hour <= 21) {
      return "Evening Wind Down";
    } else {
      return "Daytime Background";
    }
  }

  /**
   * Calculates data richness percentage for logging purposes
   * @param {Object} userData - Collected user data
   * @returns {number} Data richness percentage (0-100)
   */
  calculateDataRichness(userData) {
    let score = 0;
    let maxScore = 100;

    // Basic info (10 points)
    if (userData.basic?.username) score += 10;

    // Gaming activity (40 points - main focus)
    if (userData.recentActivity?.games?.length > 0) score += 40;

    // Spotify data (30 points - main focus)
    if (userData.recentActivity?.spotify) score += 30;

    // Behavioral patterns (15 points)
    if (userData.behavioral?.currentActiveHour !== undefined) score += 15;

    // Custom status (5 points)
    if (userData.profile?.customStatus) score += 5;

    return Math.round((score / maxScore) * 100);
  }
}

// Export singleton instance
module.exports = new DataCollectionService();
