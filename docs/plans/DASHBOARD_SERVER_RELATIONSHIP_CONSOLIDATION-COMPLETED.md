# Dashboard Enhancement: Consolidate Server & Relationship Management

## Objective
Streamline the dashboard UI by combining the "Servers" and "Relationships" pages into a single, cohesive "Servers" view. This will allow administrators to view their connected servers and manage user relationships for each server from a single location, improving usability and reducing navigation.

## Current State
- **`Servers.jsx`**: Lists all servers the bot is connected to. Provides basic info (Name, Join Date) and a "Leave Server" action. Uses `/api/servers`.
- **`Relationships.jsx`**: Lists all guilds (dropdown selection). Upon selection, fetches and lists user relationships for that guild. Uses `/api/guilds` and `/api/guilds/:id/relationships`.
- **Navigation**: `App.jsx` has separate routes and nav links for `/servers` and `/relationships`.

## Target State
- **Unified `Servers.jsx`**:
    - The main table will list servers (as it currently does).
    - Each row will have an "Expand" or "Manage" button.
    - **Expanded View**:
        - Displays a list of users for that specific server.
        - Shows relationship details (Attitude, Behavior, Boundaries) for each user.
        - Allows editing these settings inline or via a modal.
    - **Data Fetching**:
        - Server list: `/api/servers` (Preferred as it includes live data from the bot).
        - Relationship data: `/api/guilds/:guildId/relationships` (Fetched on-demand when a server is expanded).

## Implementation Plan

### Phase 1: Enhance `Servers.jsx` Component
1.  **Modify Table Structure**: Add a column for "Details" or make the row clickable to toggle expansion.
2.  **Add State**: Track `expandedServerId` to know which row is open.
3.  **Fetch Relationships**:
    - When a row is expanded, check if relationships for that `guildId` are already cached/loaded.
    - If not, fetch from `/api/guilds/:guildId/relationships`.
4.  **Render Nested List**:
    - Create a sub-component (e.g., `ServerRelationships`) to render the list of users and their settings.
    - Reuse the editing logic from `Relationships.jsx` (modal or inline edit forms).

### Phase 2: Migrate Logic & Cleanup
1.  **Port Functionality**: Move the "Edit Relationship" logic (state, API calls) from `Relationships.jsx` to `Servers.jsx` (or its sub-component).
2.  **Remove Old Component**: Delete `Relationships.jsx`.
3.  **Update Navigation**:
    - Remove the `/relationships` route from `App.jsx`.
    - Remove the "Relationships" link from the main navigation bar.

### Phase 3: UI Polish
1.  **Loading States**: Ensure the expanded view shows a loading spinner while fetching relationships.
2.  **Empty States**: Handle cases where a server has no stored relationships yet.
3.  **Responsive Design**: Ensure the nested table/list works well on smaller screens.

## API Considerations
- No new endpoints are strictly required.
- We will use:
    - `GET /api/servers` for the main list.
    - `GET /api/guilds/:guildId/relationships` for the expanded view.
    - `POST /api/guilds/:guildId/relationships/:userId` for updates.
