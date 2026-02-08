# DiscordLLMBot Improvement Plan (2026)

This document outlines the strategic roadmap for improving the DiscordLLMBot ecosystem (Bot, API, Dashboard). It builds upon previous MVPs and aims for a production-ready, secure, and feature-rich application.

## 1. Reliability & Security (Priority: High)

The current system works well in a controlled dev environment but needs hardening for production.

- [ ] **API Authentication**:
    - Implement a simple JWT-based or API Key authentication for the internal API.
    - Protect sensitive endpoints (`POST /api/config`, `POST /api/relationships`) to prevent unauthorized changes from the dashboard if exposed.
    - Add a login page to the Dashboard.
- [ ] **Rate Limiting (API)**:
    - Add `express-rate-limit` to the API to prevent abuse.
- [ ] **Input Validation**:
    - Use `zod` or `joi` to validate incoming configuration updates and relationship edits in the API.
    - Prevent injection attacks or corrupted config files.
- [ ] **Secure Headers**:
    - Implement `helmet` in the Express API.

## 2. Developer Experience & Code Quality (Priority: Medium)

To maintain velocity as the codebase grows, we need better tooling.

- [ ] **Linting & Formatting**:
    - Set up `ESLint` and `Prettier` across the monorepo.
    - Create a root-level configuration to ensure consistency between `bot`, `api`, and `dashboard`.
- [ ] **Testing Strategy**:
    - **Unit Tests**: Add `Vitest` or `Jest` for core logic (`shared/utils`, `bot/src/core/prompt.js`, `bot/src/llm/gemini.js`).
    - **Integration Tests**: Test the database layer (`shared/storage`).
    - **E2E Tests**: Optional, but Cypress/Playwright for the Dashboard would be nice.
- [ ] **CI/CD Pipelines**:
    - Create GitHub Actions to run linting and tests on PRs.
    - Automate Docker image building and pushing to a registry.

## 3. Feature Expansion (Priority: Medium)

Enhance the bot's capabilities to be more than just a text replier.

- [ ] **Slash Commands**:
    - Implement a command handler for `/` commands.
    - Ideas: `/reset-memory`, `/configure`, `/ask` (private ephemeral reply).
- [ ] **Multi-Modal Support**:
    - Update `gemini.js` to handle image inputs (users posting images).
    - Allow the bot to "see" attachments using Gemini Vision capabilities.
- [ ] **Multi-Provider Support**:
    - Abstract the LLM layer to support OpenAI, Anthropic, or local models (Ollama) in addition to Gemini.
    - Make this configurable via `bot.json`.
- [ ] **Voice Support**:
    - (Advanced) Integration with Discord voice channels for speech-to-text and text-to-speech interaction.

## 4. Dashboard Enhancements (Priority: Low)

The dashboard is functional but can be more powerful.

- [x] **Real-time Analytics**:
    - Visual graphs for message volume, response times, and token usage.
    - Database statistics (size, row counts).
- [ ] **Interactive Playground**:
    - A "Chat with Bot" page in the dashboard that simulates a Discord channel.
    - Useful for testing prompts/personas without spamming real servers.
- [x] **Log Filtering**:
    - Improve the Logs view to filter by level (INFO/WARN/ERROR) or source.
- [ ] **Mobile Responsiveness**:
    - Ensure the dashboard looks good on mobile devices.

## 5. Long-term Architecture

- [ ] **TypeScript Migration**:
    - Incrementally migrate `.js` files to `.ts`.
    - Share types between API and Dashboard using the `shared` workspace.
- [ ] **Microservices vs. Monolith**:
    - Evaluate if `bot` and `api` should remain separate or be merged if complexity increases.
    - Currently, separation is good for resilience (bot crash doesn't kill dashboard).

## 6. Dashboard UX Improvements (Priority: Medium)

We are actively working on streamlining the dashboard experience.

- [x] **Consolidate Servers & Relationships**:
    - Merge the separate "Servers" and "Relationships" pages into a unified "Server Management" view.
    - Allow expanding a server row to see and manage its user relationships.
    - Reduces navigation and provides better context (managing users *within* their server).
    - [Detailed Plan](./DASHBOARD_SERVER_RELATIONSHIP_CONSOLIDATION.md)
- [ ] **Mobile Layout**:
    - Ensure the dashboard is fully usable on mobile phones.
- [ ] **Dark Mode Polish**:
    - Refine colors and contrast for better readability.

## Roadmap

### Q1 2026
- [ ] Setup ESLint/Prettier.
- [ ] Implement API Authentication.
- [ ] Add basic Unit Tests for `shared` logic.

### Q2 2026
- [ ] Implement Slash Commands.
- [ ] Add Gemini Vision support (Image analysis).
- [ ] Dashboard: Add "Chat Playground".
