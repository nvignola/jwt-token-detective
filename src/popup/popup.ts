import { ExtensionStorage, JWTTokenGroup, RequestInfo } from "../types/jwt";

export class JWTPopup {
  private tokensContainer: HTMLElement | null;
  private emptyState: HTMLElement | null;
  private loading: HTMLElement | null;
  private statsText: HTMLElement | null;
  private refreshBtn: HTMLElement | null;

  constructor() {
    this.tokensContainer = document.getElementById("tokens-container");
    this.emptyState = document.getElementById("empty-state");
    this.loading = document.getElementById("loading");
    this.statsText = document.getElementById("stats-text");
    this.refreshBtn = document.getElementById("refresh-btn");

    this.init();
  }

  async init() {
    this.refreshBtn?.addEventListener("click", () => this.loadTokens());
    await this.loadTokens();
  }

  async loadTokens() {
    try {
      this.showLoading();
      const storage = await this.getStorage();
      this.renderTokens(storage.tokenGroups || []);
    } catch (error) {
      console.error("Error loading tokens:", error);
      this.showError();
    }
  }

  async getStorage(): Promise<ExtensionStorage> {
    return new Promise((resolve) => {
      chrome.storage.local.get(["jwt_detector_data"], (result) => {
        const data = result.jwt_detector_data as ExtensionStorage | undefined;

        if (data && data.tokenGroups && Array.isArray(data.tokenGroups)) {
          try {
            // Convert timestamp strings back to Date objects with validation
            const parsedData = {
              ...data,
              tokenGroups: data.tokenGroups.map((group) => {
                const parsedExpiryDate = this.parseDate(group.expiryDate);

                // Simple expiry check: if we have a valid expiry date, check if it's past
                let isExpired = group.isExpired; // Default to stored value
                if (parsedExpiryDate instanceof Date) {
                  isExpired = parsedExpiryDate.getTime() < Date.now();
                } else if (
                  group.payload &&
                  typeof group.payload.exp === "number"
                ) {
                  // Fallback: calculate from payload.exp
                  isExpired = group.payload.exp * 1000 < Date.now();
                }

                return {
                  ...group,
                  expiryDate: parsedExpiryDate,
                  isExpired,
                  firstSeen: this.parseDate(group.firstSeen) || new Date(),
                  lastSeen: this.parseDate(group.lastSeen) || new Date(),
                  requests: Array.isArray(group.requests)
                    ? group.requests.map((req) => ({
                        ...req,
                        timestamp: this.parseDate(req.timestamp) || new Date(),
                      })).filter(req => req && req.timestamp instanceof Date)
                    : [],
                };
              }),
            };

            resolve(parsedData);
          } catch (error) {
            console.error("Error parsing storage data:", error);
            resolve({ tokenGroups: [] });
          }
        } else {
          resolve({ tokenGroups: [] });
        }
      });
    });
  }

  parseDate(dateValue: Date | string | null) {
    if (!dateValue) {
      return null;
    }

    // If already a Date object, validate and return it
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }

    // Try to parse string/number to Date
    try {
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      console.error("Failed to parse date:", dateValue, error);
      return null;
    }
  }

  renderTokens(tokenGroups: JWTTokenGroup[]) {
    this.hideLoading();

    if (tokenGroups.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();
    const fragment = document.createDocumentFragment();

    if (!this.tokensContainer) {
      console.error("Tokens container not found");
      return;
    }
    this.tokensContainer.innerHTML = "";

    // Sort by last seen (most recent first)
    const sortedGroups = tokenGroups.sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );

    sortedGroups.forEach((group) => {
      const tokenElement = this.createTokenElement(group);
      fragment.appendChild(tokenElement);
    });

    this.tokensContainer.appendChild(fragment);
    this.updateStats(tokenGroups);
  }

  createTokenElement(group: JWTTokenGroup): HTMLElement {
    const element = document.createElement("div");
    element.className = "token-group";

    // Defensive check: ensure group has valid requests array
    if (!group || !Array.isArray(group.requests)) {
      console.warn("Invalid group data:", group);
      group.requests = [];
    }

    // Determine expiry text
    let expiryText = "No expiry";

    // First try to use the parsed expiryDate
    if (
      group.expiryDate instanceof Date &&
      !isNaN(group.expiryDate.getTime())
    ) {
      expiryText = this.formatDate(group.expiryDate);
    }
    // Fallback: try to calculate from payload.exp
    else if (group.payload && typeof group.payload.exp === "number") {
      try {
        const expDate = new Date(group.payload.exp * 1000);
        if (!isNaN(expDate.getTime())) {
          expiryText = this.formatDate(expDate);
        }
      } catch (error) {
        console.error("Fallback expiry calculation failed:", error);
      }
    }

    // Safe status determination
    const statusClass = group.isExpired ? "expired" : "valid";
    const statusText = group.isExpired ? "Expired" : "Valid";

    // Safe token ID handling
    const tokenId = group.tokenId || "unknown";

    element.innerHTML = `
          <div class="token-header" data-token-id="${tokenId}">
            <div class="token-info">
              <div class="token-id">ID: ${tokenId}</div>
              <div class="token-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <span class="expiry-date">Expires: ${expiryText}</span>
              </div>
            </div>
            <div class="token-actions">
              <button class="copy-btn" data-token="${
                group.raw || ""
              }">Copy</button>
              <button class="toggle-btn" data-token-id="${tokenId}">
                ▼
              </button>
            </div>
          </div>
          <div class="requests-list" id="requests-${tokenId}">
            ${this.renderRequests(group.requests || [])}
          </div>
        `;

    // Add event listeners
    this.setupTokenEvents(element, group);

    return element;
  }

  renderRequests(requests: RequestInfo[]): string {
    console.log("Rendering requests:", requests.length, "requests");

    if (!requests || requests.length === 0) {
      return '<div style="text-align: center; padding: 8px; color: #6b7280;">No requests</div>';
    }

    // Sort by timestamp (most recent first)
    const sortedRequests = requests.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return sortedRequests
      .map(
        (request) => `
          <div class="request-item">
            <span class="request-method ${request.method}">${
          request.method
        }</span>
            <span class="request-path">${
              request.abbreviatedPath || request.url
            }</span>
            <div class="request-time">${this.formatDateTime(
              request.timestamp
            )}</div>
          </div>
        `
      )
      .join("");
  }

  setupTokenEvents(element: HTMLElement, group: JWTTokenGroup) {
    if (!element || !group) {
      console.error("Invalid element or group for token events");
      return;
    }

    // Copy button
    const copyBtn = element.querySelector(".copy-btn") as HTMLElement;

    if (!copyBtn) {
      console.error("Copy button not found in token element");
      return;
    }

    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.copyToClipboard(group.raw, copyBtn);
    });

    // Toggle requests
    const toggleBtn = element.querySelector(".toggle-btn");
    const header = element.querySelector(".token-header");

    const toggleRequests = () => {
      const requestsList = element.querySelector(".requests-list");
      const isExpanded = requestsList?.classList.contains("expanded");

      if (isExpanded) {
        requestsList?.classList.remove("expanded");
        toggleBtn && (toggleBtn.textContent = "▼");
      } else {
        requestsList?.classList.add("expanded");
        toggleBtn && (toggleBtn.textContent = "▲");
      }
    };

    toggleBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleRequests();
    });

    header?.addEventListener("click", toggleRequests);
  }

  async copyToClipboard(text: string, button: HTMLElement) {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = button.textContent;
      button.textContent = "Copied!";
      button.classList.add("copied");

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("copied");
      }, 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }

  formatDate(date: string | number | Date) {
    if (!date) return "Unknown";

    // Ensure we have a proper Date object
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return "Invalid date";
    }

    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dateObj);
    } catch (error) {
      console.error("Error formatting date:", error, "Date:", date);
      return "Format error";
    }
  }

  formatDateTime(date: string | number | Date): string {
    if (!date) return "Unknown";

    // Ensure we have a proper Date object
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return "Invalid date";
    }

    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(dateObj);
    } catch (error) {
      console.error("Error formatting datetime:", error, "Date:", date);
      return "Format error";
    }
  }

  updateStats(tokenGroups: JWTTokenGroup[]) {
    const validTokens = tokenGroups.filter((g) => !g.isExpired).length;
    const expiredTokens = tokenGroups.filter((g) => g.isExpired).length;

    let text = `${tokenGroups.length} token${
      tokenGroups.length !== 1 ? "s" : ""
    }`;
    if (expiredTokens > 0) {
      text += ` (${expiredTokens} expired)`;
    }

    if (this.statsText) {
      this.statsText.textContent = text;
    }
  }

  showLoading() {
    if (this.loading) this.loading.style.display = "block";
    if (this.emptyState) this.emptyState.style.display = "none";
    if (this.tokensContainer) this.tokensContainer.style.display = "none";
  }

  hideLoading() {
    if (this.loading) this.loading.style.display = "none";
  }

  showEmptyState() {
    if (this.emptyState) this.emptyState.style.display = "block";
    if (this.tokensContainer) this.tokensContainer.style.display = "none";
    if (this.statsText) this.statsText.textContent = "0 tokens detected";
  }

  hideEmptyState() {
    if (this.emptyState) this.emptyState.style.display = "none";
    if (this.tokensContainer) this.tokensContainer.style.display = "block";
  }

  showError() {
    this.hideLoading();
    if (this.tokensContainer) {
      this.tokensContainer.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #dc2626;">
            <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
            <div>Error loading tokens</div>
          </div>
        `;
    }
  }
}
