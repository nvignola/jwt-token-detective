import type {
  JWTHeader,
  JWTPayload,
  JWTTokenGroup,
  RequestInfo,
} from "@/types/jwt";

export class JWTUtils {
  /**
   * Extract Bearer token from Authorization header
   */
  static extractBearerToken(authHeader: string): string | null {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    return bearerMatch ? bearerMatch[1] : null;
  }

  /**
   * Parse JWT token into its components
   */
  static parseJWT(
    token: string
  ): { header: JWTHeader; payload: JWTPayload; signature: string } | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      const header = JSON.parse(this.base64UrlDecode(parts[0]));
      const payload = JSON.parse(this.base64UrlDecode(parts[1]));
      const signature = parts[2];

      return { header, payload, signature };
    } catch (error) {
      console.error("Failed to parse JWT:", error);
      return null;
    }
  }

  /**
   * Get expiry date from JWT payload
   */
  static getExpiryDate(payload: JWTPayload): Date | null {
    if (!payload || typeof payload.exp !== "number") {
      console.log("No exp claim found or invalid:", payload?.exp);
      return null;
    }

    // JWT exp is in seconds, JavaScript Date expects milliseconds
    const expiryDate = new Date(payload.exp * 1000);

    // Validate the resulting date
    if (isNaN(expiryDate.getTime())) {
      console.error("Invalid expiry date calculated from exp:", payload.exp);
      return null;
    }

    console.log(
      "Expiry date calculated:",
      expiryDate,
      "from exp:",
      payload.exp
    );
    return expiryDate;
  }

  /**
   * Check if JWT is expired
   */
  static isTokenExpired(payload: JWTPayload): boolean {
    const expiryDate = this.getExpiryDate(payload);
    if (!expiryDate) {
      console.log("No expiry date, token does not expire");
      return false; // No expiry means it doesn't expire
    }

    const now = Date.now();
    const isExpired = expiryDate.getTime() < now;
    console.log("Token expiry check:", {
      expiryDate: expiryDate.toISOString(),
      now: new Date(now).toISOString(),
      isExpired,
    });

    return isExpired;
  }

  /**
   * Generate a unique ID for the token (for grouping)
   */
  static async generateTokenId(token: string): Promise<string> {
    // Use the payload + signature for the hash (excluding header as it might vary)
    const parts = token.split(".");
    if (parts.length !== 3) return token;

    const payloadAndSignature = `${parts[1]}.${parts[2]}`;

    // Use Web Crypto API for hashing in browser environment
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadAndSignature);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hashHex.substring(0, 16);
  }

  /**
   * Get abbreviated path from URL
   * Example: https://www.example.com/v1/foo/bar?test=1 -> v1/foo/bar
   */
  static getAbbreviatedPath(url: string): string {
    try {
      const urlObj = new URL(url);
      let path = urlObj.pathname;

      // Remove leading slash
      if (path.startsWith("/")) {
        path = path.substring(1);
      }

      // Remove trailing slash
      if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
      }

      return path || urlObj.hostname;
    } catch (error) {
      // If URL parsing fails, return the original URL
      return url;
    }
  }

  /**
   * Create a JWTTokenGroup from a token and request info
   */
  static async createTokenGroup(
    token: string,
    requestInfo: RequestInfo
  ): Promise<JWTTokenGroup | null> {
    const parsed = this.parseJWT(token);
    if (!parsed) return null;

    const tokenId = await this.generateTokenId(token);
    const expiryDate = this.getExpiryDate(parsed.payload);
    const isExpired = this.isTokenExpired(parsed.payload);

    return {
      tokenId,
      raw: token,
      header: parsed.header,
      payload: parsed.payload,
      signature: parsed.signature,
      expiryDate,
      isExpired,
      requests: [requestInfo],
      firstSeen: requestInfo.timestamp,
      lastSeen: requestInfo.timestamp,
      isValid: true,
    };
  }

  /**
   * Base64 URL decode
   */
  private static base64UrlDecode(str: string): string {
    // Add padding if needed
    str += "=".repeat((4 - (str.length % 4)) % 4);
    // Replace URL-safe characters
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    // Decode
    return atob(str);
  }

  /**
   * Generate unique request ID
   */
  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
