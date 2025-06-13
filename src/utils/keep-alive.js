// ========================================
// FILE: src/utils/keep-alive.js
// PURPOSE: Keep-alive server and self-ping functionality
// ========================================

const http = require("http");
const https = require("https");
const config = require("../config/environment");
const logger = require("./logger");

/**
 * Keep-alive service to prevent bot from sleeping on free hosting platforms
 * Provides a health check endpoint and self-ping functionality
 */
class KeepAliveService {
  constructor() {
    this.server = null;
    this.selfPingInterval = null;
  }

  /**
   * Starts the keep-alive HTTP server
   */
  start() {
    this.server = http.createServer(this.handleRequest.bind(this));

    this.server.listen(config.app.port, "0.0.0.0", () => {
      logger.info(`🌐 Keep-alive server running on port ${config.app.port}`);
    });

    // Start self-ping to prevent sleeping (every 14 minutes)
    this.startSelfPing();
  }

  /**
   * Handles incoming HTTP requests to the keep-alive server
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   */
  handleRequest(req, res) {
    logger.debug(`HTTP request received: ${req.method} ${req.url}`);

    res.writeHead(200, {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": "*",
    });

    const statusPage = this.generateStatusPage();
    res.end(statusPage);
  }

  /**
   * Generates HTML status page with bot information
   * @returns {string} HTML status page
   */
  generateStatusPage() {
    const client = require("../bot");
    const uptime = Math.floor(process.uptime());
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const uptimeSeconds = uptime % 60;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>ARG Discord Bot - Status</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            background: linear-gradient(135deg, #1a1a1a, #2d1b69); 
            color: #fff; 
            text-align: center; 
            padding: 50px;
            margin: 0;
            min-height: 100vh;
            box-sizing: border-box;
        }
        .container {
            background: rgba(42, 42, 42, 0.9);
            padding: 30px;
            border-radius: 15px;
            display: inline-block;
            min-width: 400px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            border: 1px solid #444;
        }
        .title {
            color: #9b59b6;
            font-size: 24px;
            margin-bottom: 20px;
            text-shadow: 0 0 10px #9b59b6;
        }
        .status {
            margin: 15px 0;
            padding: 10px;
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.3);
        }
        .online { color: #4CAF50; }
        .enhanced { color: #9b59b6; }
        .warning { color: #ff9800; }
        .info { color: #2196F3; }
        .metric {
            display: inline-block;
            margin: 5px 15px;
            padding: 5px 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #888;
        }
        .pulse {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="title">🔮 ARG DISCORD BOT</div>
        
        <div class="status">
            <div class="online ${client && client.isReady() ? "" : "pulse"}">
                ${
                  client && client.isReady()
                    ? "✅ ONLINE & OPERATIONAL"
                    : "⚠️ STARTING UP..."
                }
            </div>
        </div>

        <div class="status enhanced">
            🧠 Enhanced Data Collection: <strong>ACTIVE</strong>
        </div>

        <div class="status info">
            <div class="metric">⏱️ Uptime: ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s</div>
            <div class="metric">🕐 Server Time: ${new Date().toLocaleString()}</div>
        </div>

        <div class="status info">
            <div class="metric">📊 Servers: ${
              client && client.guilds ? client.guilds.cache.size : 0
            }</div>
            <div class="metric">👥 Users: ${
              client && client.users ? client.users.cache.size : 0
            }</div>
        </div>

        <div class="status ${config.app.testingMode ? "warning" : "info"}">
            🧪 Testing Mode: <strong>${
              config.app.testingMode ? "ENABLED" : "DISABLED"
            }</strong>
        </div>

        <div class="status enhanced">
            <div>🎮 Gaming Activity Detection: ENABLED</div>
            <div>🎵 Spotify Deep Analysis: ENABLED</div>
            <div>👥 Social Pattern Analysis: ENABLED</div>
            <div>🕰️ Behavioral Timing Analysis: ENABLED</div>
            <div>🤖 AI Message Generation: ENABLED</div>
            <div>🔤 Auto Nickname Assignment: ENABLED</div>
        </div>

        <div class="status info">
            <div>🌙 Night Hours: ${config.arg.nightHoursStart}:00 - ${
      config.arg.nightHoursEnd
    }:00</div>
            <div>👑 Special Role: "${config.arg.specialRoleName}"</div>
            <div>💬 Max Conversations: ${config.arg.maxConversationRounds}</div>
        </div>

        <div class="footer">
            <div>🔮 The pattern observes all</div>
            <div>Last restart: ${new Date().toISOString()}</div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Starts self-ping mechanism to prevent sleeping
   */
  startSelfPing() {
    if (process.env.NODE_ENV === "production") {
      this.selfPingInterval = setInterval(() => {
        this.performSelfPing();
      }, 14 * 60 * 1000); // 14 minutes

      logger.info("🔄 Self-ping mechanism started (14 min intervals)");
    } else {
      logger.debug("Self-ping disabled in development mode");
    }
  }

  /**
   * Performs self-ping to prevent the service from sleeping
   */
  performSelfPing() {
    const url =
      process.env.RENDER_EXTERNAL_URL || `http://localhost:${config.app.port}`;

    logger.debug("🔄 Performing self-ping to prevent sleeping...");

    https
      .get(url, (res) => {
        logger.debug(`Self-ping successful: ${res.statusCode}`);
      })
      .on("error", (err) => {
        // Try HTTP if HTTPS fails
        http
          .get(url.replace("https:", "http:"), (res) => {
            logger.debug(
              `Self-ping successful (HTTP fallback): ${res.statusCode}`
            );
          })
          .on("error", (httpErr) => {
            logger.debug("Self-ping failed:", httpErr.message);
          });
      });
  }

  /**
   * Stops the keep-alive server and self-ping
   */
  stop() {
    if (this.server) {
      this.server.close();
      logger.info("🌐 Keep-alive server stopped");
    }

    if (this.selfPingInterval) {
      clearInterval(this.selfPingInterval);
      logger.info("🔄 Self-ping mechanism stopped");
    }
  }
}

// Export singleton instance
module.exports = new KeepAliveService();
