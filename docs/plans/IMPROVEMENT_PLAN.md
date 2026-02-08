> **Note:** This is a historical plan. The features described here may have been implemented or superseded. See `README.md` for current status.

# Project Improvement Plan

This document outlines a plan for improving the DiscordLLMBot project. The focus is on enhancing modularity, state management, configurability, and error handling, as well as adding new features.

## 1. Core Architecture & Modularity

- **State Management:** The current persistence model uses JSON files as a backing store for the in-memory cache. While this prevents data loss on restart, it could be made more robust. For example, switching to a transactional database like SQLite would prevent data corruption if the bot crashes mid-write and would scale better for very large servers.
- **Configuration:** The current single `bot.json` file is becoming unwieldy. Refactor the configuration to use multiple, domain-specific files (e.g., `persona.json`, `api.json`, `replyBehavior.json`). This will improve organization and make it easier to manage settings.
- **Error Handling:** Implement more robust error handling throughout the application. This includes catching errors at the top level of event handlers and providing more informative error messages.
- **Modularity:** Break down large files into smaller, more focused modules. For example, the `messageCreate.js` event handler could be broken down into smaller functions for handling different aspects of the message processing pipeline.

## TODO Checklist: Core Architecture & Modularity

- [ ] **State Management (SQLite Integration)**
  - [ ] Choose and install a Node.js SQLite library (e.g., `better-sqlite3`).
  - [ ] Create a new `database.js` module in `src/storage/` to manage the database connection and schema.
  - [ ] Design and create tables for `relationships` and `channel_contexts`.
  - [ ] Refactor `src/storage/persistence.js` to write to the SQLite database instead of JSON files.
  - [ ] Update `context.js` and `relationships.js` to use the new database-backed persistence layer.
  - [ ] (Optional) Create a one-time script to migrate existing data from `.json` files into the new database.

- [ ] **Configuration Refactor (Multi-file)**
  - [ ] Create a new `config` directory in `src/` if it doesn't already exist.
  - [ ] Create separate JSON files for each configuration domain: `persona.json`, `api.json`, `replyBehavior.json`, and `logger.json`.
  - [ ] Move the relevant settings from `bot.json` into the new, domain-specific files.
  - [ ] Update `src/config/configLoader.js` to load and merge these new configuration files into a single, unified config object.
  - [ ] Replace the direct access to `bot.json` with calls to the new, unified config object.

- [ ] **Robust Error Handling**
  - [ ] Wrap the main logic in each event handler in `src/events/` with a global `try...catch` block.
  - [ ] In the `catch` blocks, log the full error using `logger.error()` and send a generic error message to the user or channel.
  - [ ] Review all external API calls (e.g., `generateReply` in `llm/gemini.js`) and ensure they have robust error handling and retry logic.

- [ ] **Modularity Refactor (`messageCreate.js`)**
  - [ ] Create a new directory: `src/core/message-handler/`.
  - [ ] Break down the logic in `src/events/messageCreate.js` into smaller, single-responsibility functions and move them to the new directory. Potential modules:
    - `parse.js`: For cleaning message content.
    - `context.js`: For fetching and managing context.
    - `prompt.js`: For building the final prompt.
    - `reply.js`: For handling the reply generation and sending logic.
  - [ ] Rewrite `src/events/messageCreate.js` to be a simple orchestrator that calls these new, smaller functions.

## 2. New Features

- **Slash Commands:** Implement slash commands for interacting with the bot. This will provide a more modern and user-friendly experience.
- **Admin Commands:** Add a set of admin commands for managing the bot. This could include commands for reloading the configuration, viewing the current state, and managing relationships.
- **Per-Guild Configuration:** Allow for per-guild configuration of the bot. This would allow server owners to customize the bot's behavior for their specific needs.
- **LLM Fallback:** Implement a fallback mechanism for the LLM. If the primary LLM fails, the bot could fall back to a simpler, less expensive model.

## 3. Code Quality & Maintainability

- **Linting & Formatting:** Introduce a linter and code formatter to ensure a consistent code style throughout the project.
- **Testing:** Add a test suite to the project. This will help to ensure that the bot is working as expected and prevent regressions.
- **Documentation:** Improve the documentation for the project. This includes adding more detailed comments to the code and creating a more comprehensive README.
