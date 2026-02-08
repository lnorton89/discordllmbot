> **Note:** This is a historical plan. The features described here may have been implemented or superseded. See `README.md` for current status.

# Database Improvement Plan

This document outlines a plan for improving the database schema and data access layer of the DiscordLLMBot project.

## 1. Schema Normalization

The `relationships` table currently stores `behavior` and `boundaries` as serialized JSON. This is inefficient and makes it difficult to query and update this data. To improve this, I will:

- Create a new `behaviors` table with a foreign key to the `relationships` table.
- Create a new `boundaries` table with a foreign key to the `relationships` table.
- Migrate the existing data from the `relationships` table to the new tables.
- Update the `persistence.js` file to use the new tables.

## 2. Data Pruning

The `messages` table will grow indefinitely, which will eventually lead to performance issues. To address this, I will:

- Implement a data pruning mechanism that runs periodically and removes old messages from the database.
- Add a configuration option to `bot.json` to control the maximum age of messages to keep.

## 3. Indexing

To improve query performance, I will add indexes to the following columns:

- `messages.guildId`
- `messages.channelId`
- `messages.timestamp`
- `relationships.guildId`
- `relationships.userId`

## 4. Transactions

To ensure data integrity, I will wrap all database writes in transactions. This will prevent partial writes and ensure that the database is always in a consistent state.

## 5. Connection Management

I will improve the database connection management to ensure that the connection is properly closed when the bot shuts down. This will prevent resource leaks and ensure a graceful shutdown.
