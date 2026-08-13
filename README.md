# Webex MCP Server

**Source:** https://developer.webex.com/mcp/docs/webex-mcp-server-overview

The Model Context Protocol (MCP) standardizes how applications can provide context to large language models (LLMs), allowing AI assistants to access and query external data and tools/APIs, and incorporate the results of those queries in their responses.

Webex provides MCP servers that enable AI agents to securely access various Webex functionalities through the Model Context Protocol. These servers act as a bridge between your AI client and Webex services, allowing AI agents to perform actions and retrieve information on your behalf.

---

## Contents

- [Overview](#overview)
- [Meetings MCP Server](#meetings-mcp-server) — https://developer.webex.com/mcp/docs/meetings-mcp-server
- [Messaging MCP Server](#messaging-mcp-server) — https://developer.webex.com/mcp/docs/messaging-mcp-server
- [Vidcast MCP Server](#vidcast-mcp-server) — https://developer.webex.com/mcp/docs/vidcast-mcp-server
- [Agent plugin](#agent-plugin)

---

## Agent plugin

This repository publishes a plugin for the **Messaging** MCP server, so you can connect without hand-editing any
configuration. It installs **directly from this repository** — it does not depend on being listed in any curated
plugin directory.

### Claude Code

Add this repository as a marketplace, then install from it:

```
/plugin marketplace add CiscoDevNet/webex-mcp-official
/plugin install webex@webex-mcp-official
```

Nothing prompts you on install. Then ask your agent to *set up Webex*, and the wizard takes it from there.

### Codex

```bash
codex plugin marketplace add CiscoDevNet/webex-mcp-official
```

Then open `/plugins` in the Codex CLI, select **Webex**, and install it.

> **The AI disclaimer is Claude Code only**, because it is stored in the plugin's data directory, which Codex does
> not provide. Setup, troubleshooting and the correctness guard all work on both.

### Guided setup

The plugin deliberately declares **no configuration form**. It ships a wizard instead, so the first thing you see is
an explanation rather than an empty field asking for a client ID. Ask your agent to *set up Webex*, and it will:

1. Explain what is being connected, and that it posts **as you**, not as a bot
2. Offer the **capabilities as a checklist**, so you grant only what you need — nothing more is requested at sign-in
3. Offer an **AI disclaimer** for outgoing messages, but only if you granted write access
4. **Test that the callback port can actually be bound** — on Windows, macOS or Linux — and pick another if not
5. Hand you the exact **Redirect URI and scope list** to paste into your Webex Integration
6. Register the server with the port and scopes pinned, taking the client secret through a masked prompt
7. Check the authorization URL before you click, then verify with a read-only call

One question at a time, and the same skill doubles as the troubleshooter for `invalid_scope`, redirect failures
and 403s.

### Removing it

The wizard registers the Webex server, so it outlives the plugin. To remove everything:

```bash
claude plugin uninstall webex@webex-mcp-official
claude mcp remove webex-messaging
```

### Doing it by hand

1. **Control Hub**: a Webex administrator must enable the MCP server for your organization.
2. **Create an Integration** at [developer.webex.com/my-apps](https://developer.webex.com/my-apps) with:
   - Redirect URI `http://localhost:35621/callback` — required. Webex matches redirect URIs as exact strings, and
     Claude Code builds the callback with `localhost`. Adding the `127.0.0.1` form too is cheap insurance against a
     future version switching host
   - The scopes you want, which must include `spark:mcp`

Then run `/mcp`, choose **webex**, and complete the browser sign-in.

### Notes

The default capability set deliberately excludes space deletion, membership changes and webhook management. All 24
tools are still exposed by the server, so the ones needing an ungranted scope return **403** — that is the narrow
grant working as intended, not a broken setup. The `/webex:setup` command covers widening it.

The plugin also installs a `PreToolUse` guard that catches three calls which succeed while producing the wrong
outcome. It runs in the harness, so it costs nothing in context:

| Caught | Why it matters |
|---|---|
| An HTML-escaped mention, `&lt;@personId:…&gt;` | Webex renders it as literal text and notifies nobody, while returning 200 |
| `webex-create-message` called with a `parentId` | That field is ignored, so the reply posts as a new top-level message and fragments the thread |
| `webex-search-spaces` with no `max` | Paginates every space in the organization; on a large org it looks like a hang. A bound of 20 is injected |

The first two are refused with an explanation of the fix; the third is corrected silently.

The guard is a dependency-free Node script, so it behaves the same on Windows, macOS and Linux. It **fails open**:
if `node` is not on your `PATH`, the hook exits without a decision and the call proceeds. Node is therefore a
prerequisite for the guard working, never for the plugin working.

Authentication is OAuth as *you*, not as a bot, and there is nothing to self-host. You do supply your Integration's
client ID and client secret; the secret goes to your keychain rather than any config file.

---

## Overview

## Benefits of Webex MCP

### 1. Faster AI Integration

Build Webex-powered AI features in hours instead of weeks with a single MCP server that eliminates repetitive API code and works across all AI platforms.

### 2. Natural Language Control

Enable users to manage Webex through conversational commands like "Schedule our quarterly review" or "Find messages about the product launch" without learning APIs.

### 3. Enterprise Security & Governance

Centralized authentication, granular permissions, and complete audit trails give IT unified control over AI access to Webex collaboration data.

### 4. Cross-Platform Workflows

Connect Webex seamlessly with other tools through standardized MCP, enabling AI to orchestrate complex workflows like "Summarize the meeting and share action items with the team".

---

## Example Use Cases

- "Schedule a meeting with the engineering team tomorrow at 2pm"
- "Send a summary of this document to the project space"
- "Find all messages from Sarah about the Q2 roadmap"
- AI assistant that manages your Webex communications
- Chatbot that joins meetings and takes notes

---

## Webex APIs vs MCP

Webex APIs are REST-based HTTP endpoints provided by Cisco Webex that developers call directly from their applications to integrate collaboration features like messaging, meetings, calling and device control. You make standard HTTP requests with authentication tokens to interact with Webex services.

### When to Use Webex APIs

Choose Webex REST APIs when you need:

- **Full Control** — Precise control over every API call and response
- **Performance** — Direct API calls with minimal latency
- **Complex Logic** — Your application has intricate business logic
- **Webhooks** — Real-time event notifications via webhooks
- **Enterprise Applications** — Large-scale solutions that need direct API access for performance and security compliance

**Example use cases:**

- Building a custom collaboration app
- Automated meeting scheduling system
- Enterprise SSO integration
- Real-time presence monitoring dashboard

### When to Use Webex MCP

Choose Webex MCP when you need:

- **AI Integration** — Enable AI agents and LLM platforms to interact with Webex using natural language
- **Rapid Prototyping** — Get started quickly without writing repetitive API integration code
- **Cross-Platform** — Connect Webex to any MCP-compatible AI client with a single configuration

**Example use cases:**

- AI assistant that manages your Webex communications
- Chatbot that schedules meetings and takes notes
- Natural language interface for searching messages and spaces

### Using Both Together

You can combine both approaches. For example:

1. Use Webex APIs for direct, programmatic control and production applications
2. Use MCP to enable AI assistants to interact with Webex through natural language

The choice depends on your use case, technical requirements, and whether AI-powered interactions are central to your application.

---

## Meetings MCP Server

**Source:** https://developer.webex.com/mcp/docs/meetings-mcp-server

**Server URL:** `https://mcp.webexapis.com/mcp/webex-meeting`

Webex Meetings MCP Server connects AI tools and workflows to Webex Meetings capabilities. It enables agents and apps to schedule meetings, look up meeting details, and access meeting transcripts and transcript snippets for analysis or follow-up. This makes it easy to automate meeting coordination, generate summaries, extract action items, and build assistants that help teams get more value from their meetings. It is a strong fit for use cases like scheduling support, post-meeting recap generation, transcript search, and meeting intelligence workflows.

> **Prerequisites:** This MCP server must be enabled by your organization's admin in Webex Control Hub before it can be used.

---

### Tools

8 tools covering the full meeting lifecycle:

| Tool | Description |
|------|-------------|
| `webex-list-meetings` | List/search meetings with filters (date range, topic, state, type). Entry point for resolving meeting names to IDs. |
| `webex-create-meeting` | Create meetings with title, time, duration, invitees, recurrence, and password. Sends email invitations. |
| `webex-update-meeting` | Update meeting properties (title, time, agenda, recurrence) and manage invitees (add/update/remove). |
| `webex-delete-meeting` | Delete a scheduled meeting with optional cancellation email. |
| `webex-get-meeting-status` | Retrieve meeting details and optionally the live participant list. |
| `webex-get-meeting-summary` | Get AI-generated summary notes (HTML) and action items for ended meetings (requires Webex AI Assistant). |
| `webex-list-recordings` | List recording metadata with playback/download URLs and passwords. |
| `webex-list-transcripts` | List transcript metadata and optionally download full plain-text transcript content for LLM analysis. |

---

### Authentication

**Auth Type:** OAuth 2.0 Bearer Token

**Issuer:** `https://webexapis.com`

**Flow:** The MCP client obtains a Webex OAuth token and passes it via the `Authorization: Bearer <token>` header. The server forwards it to each plugin, and plugins call the Webex REST API on behalf of the authenticated user.

---

### Scopes

7 unique OAuth scopes required:

| Scope | Used By |
|-------|---------|
| `spark:mcp` | Required for MCP server connection |
| `meeting:schedules_read` | `webex-list-meetings`, `webex-get-meeting-status`, `webex-list-transcripts` |
| `meeting:schedules_write` | `webex-create-meeting`, `webex-update-meeting`, `webex-delete-meeting` |
| `meeting:participants_read` | `webex-get-meeting-status` |
| `meeting:summaries_read` | `webex-get-meeting-summary` |
| `meeting:recordings_read` | `webex-list-recordings` |
| `meeting:transcripts_read` | `webex-list-transcripts` |

**Full scope string:**

```sh
spark:mcp meeting:schedules_read meeting:schedules_write meeting:participants_read meeting:summaries_read meeting:recordings_read meeting:transcripts_read
```

---

## Messaging MCP Server

**Source:** https://developer.webex.com/mcp/docs/messaging-mcp-server

**Server URL:** `https://mcp.webexapis.com/mcp/webex-messaging`

Webex Messaging MCP Server connects AI tools and workflows to Webex Messaging capabilities. It enables agents and apps to create, edit, delete, and retrieve messages in 1:1 and group spaces; manage spaces and memberships; and search messages, files, and spaces.

This makes it easy to automate team communications, route alerts and updates into the right spaces, streamline collaboration setup, support compliance and discovery workflows, and build assistants that help teams work more effectively inside Webex.

> **Prerequisites:** This MCP server must be enabled by your organization's admin in Webex Control Hub before it can be used.

---

### Tools

24 tools covering messaging, spaces, memberships, webhooks, files, and threading:

#### Messages (5)

| Tool | Description |
|------|-------------|
| `webex-create-message` | Create a new message in a Webex space or 1:1 direct message. Supports plain text, markdown, HTML, file URL attachments, and adaptive card attachments. |
| `webex-edit-message` | Edit an existing message by messageId and roomId. Supports text or markdown only (not HTML). |
| `webex-delete-message` | Delete a message from a Webex space. Destructive and irreversible. Works for both 1:1 and group spaces. |
| `webex-get-message` | Retrieve a single message by ID or list messages in a room with optional filters (mentionedPeople, before/after, parentId). |
| `webex-search-messages` | Search messages in a Webex space by roomId with optional keyword query, date range, mentionedPeople, parentId, or hasFiles filters. |

#### Spaces (5)

| Tool | Description |
|------|-------------|
| `webex-create-space` | Create a new Webex space (room) with title and optional teamId, isLocked, isAnnouncementOnly settings. |
| `webex-get-space` | Get a space by roomId or list spaces filtered by type (direct/group), teamId, and sortBy. |
| `webex-update-space` | Update space properties including title, isLocked, and isAnnouncementOnly. |
| `webex-delete-space` | Delete a space or remove the caller from it, depending on role. Deleted spaces cannot be recovered. |
| `webex-search-spaces` | Search spaces with type filter, teamId, and sortBy. |

#### Memberships (4)

| Tool | Description |
|------|-------------|
| `webex-add-membership` | Add a member to a space by roomId and personId or personEmail. Optionally grant moderator privileges. |
| `webex-get-membership` | Get a membership by ID or list memberships filtered by roomId, personId, or personEmail. |
| `webex-update-membership` | Update membership properties such as moderator role or isRoomHidden. |
| `webex-remove-membership` | Remove a member from a space by membershipId. |

#### Webhooks (4)

| Tool | Description |
|------|-------------|
| `webex-create-webhook` | Create a webhook for real-time event notifications (messages, memberships, rooms, meetings, recordings, etc.) with optional filter and HMAC secret. |
| `webex-get-webhook` | Get a webhook by ID or list all webhooks. |
| `webex-update-webhook` | Update webhook name, targetUrl, secret, and status. |
| `webex-delete-webhook` | Delete a webhook by webhookId. |

#### Files (4)

| Tool | Description |
|------|-------------|
| `webex-share-file` | Share files in a Webex space by attaching public file URLs to messages. |
| `webex-upload-file` | Upload a file to a Webex space via base64-encoded content with fileName and contentType. |
| `webex-get-file-details` | Get file metadata (Content-Type, Content-Length, Content-Disposition) from a Webex message file URL. |
| `webex-download-file` | Download file content from a Webex message file URL. Returns base64-encoded content. |

#### Threading (2)

| Tool | Description |
|------|-------------|
| `webex-create-thread-reply` | Create a threaded reply to a message in a Webex space. Requires roomId, parentId, and text or markdown. |
| `webex-get-thread` | Get all threaded replies for a parent message by roomId and parentId. |

---

### Authentication

**Auth Type:** OAuth 2.0 Bearer Token

**Issuer:** `https://webexapis.com`

**Flow:** The MCP client obtains a Webex OAuth token and passes it via the `Authorization: Bearer <token>` header. The server forwards it to each plugin, and plugins call the Webex REST API (webexapis.com) on behalf of the authenticated user.

---

### Scopes

9 unique OAuth scopes required:

| Scope | Used By |
|-------|---------|
| `spark:mcp` | Required for MCP server connection |
| `spark:messages_read` | `webex-get-message`, `webex-search-messages`, `webex-get-file-details`, `webex-download-file`, `webex-get-thread` |
| `spark:messages_write` | `webex-create-message`, `webex-edit-message`, `webex-delete-message`, `webex-share-file`, `webex-upload-file`, `webex-create-thread-reply` |
| `spark:rooms_read` | `webex-get-space`, `webex-search-spaces` |
| `spark:rooms_write` | `webex-create-space`, `webex-update-space`, `webex-delete-space` |
| `spark:memberships_read` | `webex-get-membership` |
| `spark:memberships_write` | `webex-add-membership`, `webex-update-membership`, `webex-remove-membership` |
| `spark:webhooks_read` | `webex-get-webhook` |
| `spark:webhooks_write` | `webex-create-webhook`, `webex-update-webhook`, `webex-delete-webhook` |

**Full scope string:**

```sh
spark:mcp spark:messages_read spark:messages_write spark:rooms_read spark:rooms_write spark:memberships_read spark:memberships_write spark:webhooks_read spark:webhooks_write
```

---

## Vidcast MCP Server

**Source:** https://developer.webex.com/mcp/docs/vidcast-mcp-server

**Server URL:** `https://mcp.webexapis.com/mcp/vidcast`

Vidcast MCP Server is a Model Context Protocol (MCP) integration that enables AI assistants and agents to interact with the Vidcast video platform data. Vidcast is the Webex Suite's enterprise video solution. It exposes 29 tools that allow agents to search, browse, analyze, and retrieve information from Vidcast videos, playlists, pages, and user activity — all through a standardized MCP interface with OAuth-based authentication.

> **Prerequisites:** This MCP server must be enabled by your organization's admin in Webex Control Hub before it can be used.

---

### Tools

29 tools covering video discovery, content, engagement, analytics, recommendations, sharing, and notifications:

#### Video Discovery & Search (4)

| Tool | Description |
|------|-------------|
| `vidcast-search-videos` | Search Vidcast videos by keywords (supports sorting and transcript inclusion) |
| `vidcast-search-pages` | Search Vidcast Pages by keywords |
| `vidcast-search-playlists` | Search Vidcast Playlists by keywords |
| `vidcast-search-users` | Search for Vidcast users by name or email |

#### Video Library & Browsing (7)

| Tool | Description |
|------|-------------|
| `vidcast-list-my-videos` | List the authenticated user's video library (supports filtering by date, source, share type) |
| `vidcast-list-shared-with-me` | List videos shared with the authenticated user |
| `vidcast-list-recently-viewed-videos` | List recently viewed videos |
| `vidcast-list-pages` | List pages by kind (own/shared/collaborative/recent) |
| `vidcast-list-playlists` | List playlists by kind (own/shared/collaborative/recent) |
| `vidcast-get-shared-video` | Get a shared video by shareId |
| `vidcast-get-author-videos` | Get latest videos for an author by userId |

#### Video Content & AI (2)

| Tool | Description |
|------|-------------|
| `vidcast-get-video-transcript` | Retrieve full transcript for a video |
| `vidcast-get-video-highlights` | Retrieve AI-generated highlights for a video |

#### Engagement & Social (3)

| Tool | Description |
|------|-------------|
| `vidcast-get-video-comments` | List comments for a shared video |
| `vidcast-get-video-comment-replies` | List replies for a comment thread |
| `vidcast-get-video-reactions` | List emoji reactions for a shared video |

#### Analytics & Insights (5)

| Tool | Description |
|------|-------------|
| `vidcast-get-video-insights` | Get analytics summary for a specific video |
| `vidcast-get-video-insights-views` | Get views timeseries for a video over a period |
| `vidcast-get-video-insights-retention` | Get retention analytics for a video |
| `vidcast-get-user-insights` | Get analytics summary for the authenticated user |
| `vidcast-get-user-insights-views` | Get views timeseries for the authenticated user |

#### Recommendations (3)

| Tool | Description |
|------|-------------|
| `vidcast-recommend-watch-next` | Get watch-next recommendations using a reference item |
| `vidcast-recommend-top-videos` | Get top recommended videos for the user |
| `vidcast-recommend-trending-videos` | Get trending recommended videos for the user |

#### Sharing & Access (3)

| Tool | Description |
|------|-------------|
| `vidcast-get-sharing-info` | Get sharing/access configuration for a resource |
| `vidcast-get-author-info` | Get author profile info by userId |
| `vidcast-list-access-requests` | List access requests for a shared resource |

#### Notifications (2)

| Tool | Description |
|------|-------------|
| `vidcast-check-notifications` | Quick check if there are unread notifications (boolean) |
| `vidcast-list-notifications` | List user notifications (comments, reactions, access requests, shares) |

---

### Authentication

**Auth Type:** OAuth 2.0 Bearer Token

**Issuer:** `https://webexapis.com`

**Flow:** The MCP client obtains a Webex OAuth token and passes it via the `Authorization: Bearer <token>` header. The server forwards it to each plugin, and plugins call the Webex REST API on behalf of the authenticated user.

**Rate limits:** 120 invocations per 60 seconds, max 10 concurrent requests

---

### Scopes

3 OAuth scopes required:

| Scope | Description |
|-------|-------------|
| `spark:mcp` | Required for MCP server connection |
| `Identity:Organization` | Access to organization-level identity information |
| `Identity:Config` | Access to identity configuration |

**Full scope string:**

```sh
spark:mcp Identity:Organization Identity:Config
```

---

*© 2026 Cisco and/or its affiliates. All rights reserved.*
