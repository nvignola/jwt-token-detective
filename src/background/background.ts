import { JWTUtils } from "@/utils/jwt";
import { ExtensionStorage, JWTTokenGroup, RequestInfo } from "@/types/jwt";

class JWTDetectorBackground {
  private static readonly STORAGE_KEY = "jwt_detector_data";
  private static readonly MAX_TOKEN_GROUPS = 100;
  private static readonly RETENTION_HOURS = 24;

  constructor() {
    this.setupWebRequestListener();
    this.setupStorageCleanup();
  }

  /**
   * Set up chrome.webRequest listener to monitor HTTP requests
   */
  private setupWebRequestListener(): void {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        this.handleRequest(details);
      },
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    );
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    details: chrome.webRequest.WebRequestHeadersDetails
  ): Promise<void> {
    try {
      // Look for Authorization header with Bearer token
      const authHeader = details.requestHeaders?.find(
        (header) => header.name.toLowerCase() === "authorization"
      );

      if (!authHeader?.value) return;

      const bearerToken = JWTUtils.extractBearerToken(authHeader.value);
      if (!bearerToken) return;

      // Create request info
      const requestInfo: RequestInfo = {
        id: JWTUtils.generateRequestId(),
        url: details.url,
        method: details.method,
        abbreviatedPath: JWTUtils.getAbbreviatedPath(details.url),
        timestamp: new Date(),
      };

      await this.storeTokenData(bearerToken, requestInfo);
    } catch (error) {
      console.error("Error handling request:", error);
    }
  }

  /**
   * Store or update token data in chrome storage
   */
  private async storeTokenData(
    token: string,
    requestInfo: RequestInfo
  ): Promise<void> {
    try {
      const storage = await this.getStorage();
      const tokenId = await JWTUtils.generateTokenId(token);

      console.log("Storing token data:", {
        tokenId,
        url: requestInfo.url,
        method: requestInfo.method,
        existingGroups: storage.tokenGroups.length,
      });

      // Find existing token group
      const existingGroupIndex = storage.tokenGroups.findIndex(
        (group) => group.tokenId === tokenId
      );

      console.log(
        "Looking for existing group with tokenId:",
        tokenId,
        "found at index:",
        existingGroupIndex
      );

      if (existingGroupIndex >= 0) {
        // Update existing group
        const existingGroup = storage.tokenGroups[existingGroupIndex];
        existingGroup.requests.push(requestInfo);
        existingGroup.lastSeen = requestInfo.timestamp;

        console.log("Updated existing group:", {
          tokenId,
          requestCount: existingGroup.requests.length,
        });

        // Recalculate expiry status in case time has passed
        const parsed = JWTUtils.parseJWT(token);
        if (parsed) {
          existingGroup.isExpired = JWTUtils.isTokenExpired(parsed.payload);
        }

        // Keep only recent requests (last 50 per token)
        if (existingGroup.requests.length > 50) {
          existingGroup.requests = existingGroup.requests
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 50);
        }
      } else {
        // Create new token group
        const newGroup = await JWTUtils.createTokenGroup(token, requestInfo);
        if (newGroup) {
          console.log("Created new token group:", {
            tokenId: newGroup.tokenId,
            expiryDate: newGroup.expiryDate?.toISOString(),
            isExpired: newGroup.isExpired,
          });

          storage.tokenGroups.unshift(newGroup); // Add to beginning
        } else {
          console.error("Failed to create token group for token");
        }
      }

      // Limit total number of token groups
      if (storage.tokenGroups.length > JWTDetectorBackground.MAX_TOKEN_GROUPS) {
        storage.tokenGroups = storage.tokenGroups.slice(
          0,
          JWTDetectorBackground.MAX_TOKEN_GROUPS
        );
      }

      console.log("Final storage state:", {
        totalGroups: storage.tokenGroups.length,
        groupsWithRequests: storage.tokenGroups.map((g) => ({
          tokenId: g.tokenId,
          requestCount: g.requests.length,
        })),
      });

      await this.saveStorage(storage);
    } catch (error) {
      console.error("Error storing token data:", error);
    }
  }

  /**
   * Get storage data
   */
  private async getStorage(): Promise<ExtensionStorage> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [JWTDetectorBackground.STORAGE_KEY],
        (result) => {
          const data = result[JWTDetectorBackground.STORAGE_KEY];
          if (data) {
            // Convert timestamp strings back to Date objects
            const parsedData: ExtensionStorage = {
              ...data,
              tokenGroups: data.tokenGroups.map((group: any) => ({
                ...group,
                expiryDate: group.expiryDate
                  ? new Date(group.expiryDate)
                  : null,
                firstSeen: new Date(group.firstSeen),
                lastSeen: new Date(group.lastSeen),
                requests: group.requests.map((req: any) => ({
                  ...req,
                  timestamp: new Date(req.timestamp),
                })),
              })),
            };
            resolve(parsedData);
          } else {
            resolve({
              tokenGroups: [],
              maxTokenGroups: JWTDetectorBackground.MAX_TOKEN_GROUPS,
              retentionHours: JWTDetectorBackground.RETENTION_HOURS,
            });
          }
        }
      );
    });
  }

  /**
   * Save storage data
   */
  private async saveStorage(data: ExtensionStorage): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [JWTDetectorBackground.STORAGE_KEY]: data,
        },
        () => {
          resolve();
        }
      );
    });
  }

  /**
   * Set up periodic cleanup of old data
   */
  private setupStorageCleanup(): void {
    // Clean up every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    // Also clean up on startup
    this.cleanupOldData();
  }

  /**
   * Remove old token groups and requests
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const storage = await this.getStorage();
      const cutoffTime =
        Date.now() - JWTDetectorBackground.RETENTION_HOURS * 60 * 60 * 1000;

      console.log(
        "Running cleanup, cutoff time:",
        new Date(cutoffTime).toISOString()
      );

      // Filter out old token groups and update expired status
      storage.tokenGroups = storage.tokenGroups
        .map((group) => {
          // Recalculate expiry status based on current time
          const updatedGroup = {
            ...group,
            isExpired: JWTUtils.isTokenExpired(group.payload),
            // Remove old requests within each group (but keep recent ones even if token is expired)
            requests: group.requests.filter(
              (req) => req.timestamp.getTime() > cutoffTime
            ),
          };

          return updatedGroup;
        })
        .filter((group) => {
          // Only remove groups if they have no recent requests AND are very old
          const hasRecentRequests = group.requests.length > 0;
          const groupIsVeryOld = group.lastSeen.getTime() < cutoffTime;

          // Keep the group if it has recent requests OR if it's not very old
          return hasRecentRequests || !groupIsVeryOld;
        });

      await this.saveStorage(storage);
      console.log(
        "Cleanup completed, remaining groups:",
        storage.tokenGroups.length
      );
    } catch (error) {
      console.error("Error cleaning up old data:", error);
    }
  }
}

// Initialize the background script
new JWTDetectorBackground();
