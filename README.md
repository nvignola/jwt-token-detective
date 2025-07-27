# 🔍 JWT Token Detective

A Chrome extension that automatically detects and manages JWT tokens from network requests. Perfect for developers who work with authentication APIs and want to debug token flows without diving into network tabs.

![JWT Token Detective Screenshot](https://via.placeholder.com/600x300/2563eb/white?text=JWT+Token+Detective+UI)

## ✨ Why I Built This

As a developer working with JWT authentication daily, I got tired of:

- Digging through Chrome DevTools Network tab to find tokens
- Copy-pasting long JWT strings from request headers
- Manually checking token expiration times
- Losing track of which tokens were used for which API calls

So I built JWT Token Detective to make JWT debugging effortless. For fun and profit.

## 🚀 Features

- **🔄 Automatic Detection** - Monitors all HTTP requests for Bearer tokens in the background
- **📊 Smart Grouping** - Groups multiple API calls by the JWT token used (not by URL)
- **⏰ Expiry Tracking** - Shows when tokens expire and marks expired ones in red
- **📋 One-Click Copy** - Copy any JWT token to clipboard instantly
- **🔍 Request History** - See all API calls made with each token, with method badges and timestamps
- **🧹 Smart Cleanup** - Removes old request history after 2 hours, expired tokens after 1 hour grace period
- **🔒 Privacy First** - All data stays local, nothing sent to external servers

## 📦 Installation

### From Chrome Web Store (Coming Soon)

1. Visit the [Chrome Web Store page](#)
2. Click "Add to Chrome"
3. Pin the extension for easy access

### From Source

1. Clone this repository:

   ```bash
   git clone https://github.com/yourusername/jwt-token-detective.git
   cd jwt-token-detective
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build the extension:

   ```bash
   pnpm build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

## 🎮 How to Use

1. **Install the extension** and browse to any website with JWT authentication
2. **Make some API calls** (login, load data, etc.)
3. **Click the extension icon** to see detected tokens
4. **Expand token groups** to see individual requests
5. **Click "Copy"** to copy tokens to clipboard

The extension works completely in the background - no setup required.

### Development Workflow

```bash
# Start development mode (auto-rebuilds on changes)
pnpm dev

# Type checking
pnpm type-check

# Production build
pnpm build

# Clean dist folder
pnpm clean
```

### Project Structure

```
jwt-token-detective/
├── src/
│   ├── background/    # Service worker for token detection
│   ├── popup/         # Extension popup UI
│   ├── types/         # TypeScript definitions
│   └── utils/         # JWT parsing utilities
├── icons/             # Extension icons
└── manifest.json      # Extension configuration
```

## 🔐 Privacy & Security

- **Local Storage Only** - Tokens are stored in Chrome's local storage, never transmitted
- **No External Requests** - Extension doesn't make any network calls
- **Minimal Permissions** - Only requests necessary permissions for token detection
- **Smart Cleanup** - Request history cleaned after 2 hours, expired tokens removed 1 hour after expiry

## 🤝 Contributing

I'd love your help making this extension better! Here's how:

1. **Found a bug?** [Open an issue](https://github.com/yourusername/jwt-token-detective/issues)
2. **Have an idea?** [Start a discussion](https://github.com/yourusername/jwt-token-detective/discussions)
3. **Want to contribute code?** Check out the [contributing guide](CONTRIBUTING.md)

### Quick contribution setup:

```bash
# Fork the repo, then:
git clone https://github.com/nvignola/jwt-token-detective.git
cd jwt-token-detective
pnpm install
pnpm dev

# Make your changes, then:
git checkout -b feature/your-feature-name
git commit -m "Add your feature"
git push origin feature/your-feature-name
# Open a pull request!
```

## 🐛 Known Issues

- Some websites with very strict CSP might not work perfectly
- Token grouping relies on identical JWT payload, so rotated tokens with same permissions create separate groups
- Very large tokens (>8KB) might have display issues

## 🔮 Roadmap

- [ ] **Token Analysis** - Show decoded JWT claims and validation
- [ ] **Export/Import** - Save token collections for later analysis
- [ ] **Filtering** - Filter tokens by domain, status, or time range
- [ ] **Dark Mode** - Because every extension needs dark mode

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Star ⭐ this repo if JWT Token Detective helped you debug faster!**
