---
name: webex-mcp-setup
description: Guided setup wizard and troubleshooter for the Webex Messaging MCP server. Use when connecting Webex for the first time, when changing which Webex capabilities are granted or the OAuth callback port, when Webex tools are missing, when sign-in fails, or on errors mentioning dynamic client registration, invalid_scope, redirect_uri, insufficient_scope, or a 403 from a Webex tool.
---

# Webex Messaging MCP setup

This plugin connects to Cisco's **hosted** Webex Messaging MCP server at
`https://mcp.webexapis.com/mcp/webex-messaging`. Nothing is self-hosted and there is no token to store —
authentication is OAuth 2.0 as *you*.

Two settings have to agree between the user's Webex Integration and this plugin: the **callback port** and the
**scopes**. Getting either wrong produces an error that does not name the real cause, which is what this wizard
exists to prevent.

---

## Part 1 — Run the wizard

Work through these steps in order, then hand the user one set of values to register.

### Step 1: Pick the capabilities

The server defines **9 scopes**. `spark:mcp` is mandatory, so the user is choosing among the other 8.

Present them as a **multi-select checklist** — `AskUserQuestion` with `multiSelect: true` — grouping the
read/write pairs that are only useful together. Preselect group 1, the common case.

| # | Checklist option | Scopes granted | Tools it unlocks |
| --- | --- | --- | --- |
| 1 | Read and post messages *(default)* | `spark:messages_read` `spark:messages_write` `spark:rooms_read` | `webex-get-message`, `webex-search-messages`, `webex-get-thread`, `webex-get-file-details`, `webex-download-file`, `webex-create-message`, `webex-edit-message`, `webex-delete-message`, `webex-create-thread-reply`, `webex-share-file`, `webex-upload-file`, `webex-get-space`, `webex-search-spaces` |
| 2 | Create, rename and delete spaces | `spark:rooms_write` | `webex-create-space`, `webex-update-space`, `webex-delete-space` |
| 3 | See and change space membership | `spark:memberships_read` `spark:memberships_write` | `webex-get-membership`, `webex-add-membership`, `webex-update-membership`, `webex-remove-membership` |
| 4 | Manage webhooks | `spark:webhooks_read` `spark:webhooks_write` | `webex-get-webhook`, `webex-create-webhook`, `webex-update-webhook`, `webex-delete-webhook` |

That accounts for all 9: `spark:mcp` (always) + 3 + 1 + 2 + 2.

Say these while asking, because they are not obvious from the scope names:

- **Group 1** posts, edits and deletes **as the user**, not as a bot.
- **Group 2** includes `webex-delete-space`, and **deleting a space cannot be undone**.
- **Group 3** can remove colleagues from spaces.
- **Group 4** is rarely useful for editor work; webhooks need a publicly reachable callback URL.

If the user wants read-only access, offer group 1 without `spark:messages_write` — a common enough combination to
name explicitly. Do not offer a "grant everything" shortcut; the point of the checklist is that each capability is
a deliberate choice. If the user asks for all 9 anyway, that is their call — restate what `spark:rooms_write` and
`spark:memberships_write` allow, then proceed.

Build the result as one space-separated string with `spark:mcp` first.

### Step 2: Offer the AI disclaimer

**Only ask this if Step 1 granted a message-write scope.** With read-only access nothing is ever posted, so the
question is noise.

Ask whether outgoing messages should carry an AI disclaimer, **defaulting to yes**. Show the default text so the
user can judge it, and say they can replace it:

> _This message was generated using AI and posted using the Webex MCP server. Apologies in advance for any errors or omissions_

Tell them how it behaves, because it is not obvious:

- It is appended **in italics on its own line at the end of every message** the server posts, including thread
  replies.
- It is applied by a hook, so it cannot be forgotten or talked out of — and it is idempotent, so a retry does not
  duplicate it.
- Edits to an existing message do not re-append it, since the original already carries it.

If they want their own wording, take it verbatim and use it in place of the default. If they decline, set
`webex_disclaimer` to an empty string, which disables the append.

Whether AI-generated messages must be labelled is a policy question in some organizations — if the user is unsure,
say that leaving it on is the cautious choice.

### Step 3: Settle the callback port

Claude Code binds this port locally during sign-in, so **check that whichever port is chosen is free — including
one the user names themselves.** Do not skip the check because the user chose deliberately; a port already in use
fails at the redirect, and the error looks like a Webex problem rather than a local one.

Start with the default, **35621**. Run the check for the user's platform:

**macOS or Linux**

```bash
python3 -c 'import socket,sys
p=int(sys.argv[1]); s=socket.socket()
try: s.bind(("127.0.0.1",p)); print(f"{p} is free")
except OSError as e: print(f"{p} is NOT usable: {e}")
finally: s.close()' 35621
```

**Windows (PowerShell)**

```powershell
$p = 35621
try {
  $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
  $l.Start(); "$p is free"; $l.Stop()
} catch { "$p is NOT usable: $($_.Exception.Message)" }
```

Both attempt the bind rather than reading a process list, so they also catch ports held by another user's process.
Fallbacks if the above is unavailable: `lsof -iTCP:<PORT> -sTCP:LISTEN -n -P` on macOS/Linux, or
`netstat -ano | findstr :<PORT>` on Windows — treat any output as "in use". On Windows, note that `python3` is
usually `python` or `py -3`, so prefer the PowerShell form there.

**Loop until a port passes:** if it is not free, propose another in the 1024–65535 range, confirm it, and run the
same check on that one. Only continue once a port has passed.

Two things to tell the user:

- The check is a pre-flight, not a reservation. Something else can take the port before sign-in; if the redirect
  fails later, re-run this step.
- Ports below 1024 need administrator privileges and will not work.

Whatever passes must appear in both the Redirect URI and the plugin config, so settle it before continuing.

### Step 4: Have the user create the Integration

This needs a human signed in to Webex and cannot be automated. Give them the values already filled in:

> Go to **[developer.webex.com/my-apps](https://developer.webex.com/my-apps) → Create a New App → Integration**
>
> - **Redirect URI:** `http://127.0.0.1:<PORT>/callback`
> - **Scopes:** tick exactly the scopes from Step 1
>
> Then copy the **Client ID**.

State explicitly that the Redirect URI must use **`127.0.0.1`, not `localhost`** — Webex compares redirect URIs as
exact strings, and `localhost` fails at the redirect with an error that never mentions the hostname.

Ask them to paste the Client ID back. It is not a secret, but do not write it into a file.

### Step 5: Write the configuration

Apply every value together:

```bash
claude plugin install webex-messaging-mcp@webex-mcp-official \
  --config webex_client_id=<CLIENT_ID> \
  --config webex_callback_port=<PORT> \
  --config "webex_scopes=<SCOPE STRING>" \
  --config "webex_disclaimer=<DISCLAIMER TEXT>"
```

Omit the last flag to keep the default disclaimer, or pass it empty (`--config webex_disclaimer=`) to disable the
append. Skip it entirely if Step 2 did not apply.

If the plugin is already installed, the user runs `/plugin configure` and updates the same fields — an installed
plugin cannot be reconfigured from the command line.

### Step 6: Sign in and verify

Have the user run `/mcp`, choose **webex**, and complete the browser sign-in. Then verify with a read-only call
rather than declaring success:

> List my 3 most recently active Webex group spaces.

Live data back means it works. If the user granted read-only scopes, do not test by posting.

---

## Part 2 — Troubleshooting

### `does not support dynamic client registration`

The server will not register an OAuth client, so it needs a client ID. Either `webex_client_id` is empty, or the
server was added manually without one.

### `invalid_scope`

The requested scopes are not all present on the Integration. Compare the two directly — the `scope` parameter in
the authorization URL against the scope list at developer.webex.com/my-apps — and fix whichever is wrong.

If the server was configured by hand rather than through this plugin, note that editing `oauth.scopes` in
`~/.claude.json` mid-session has no effect: the OAuth config is read when the server is registered, so it needs a
restart.

### The redirect fails, or the browser cannot connect

Three things must agree. Check all three rather than guessing:

1. The Redirect URI on the Integration
2. The host in the authorization URL — `127.0.0.1`, not `localhost`
3. The port the editor is listening on — re-run the Step 3 bind check, since something may have taken it since

### 403 or `insufficient_scope` from a tool

That tool needs a capability outside the granted set. The server exposes all 24 tools regardless of what was
granted, so this is the narrow grant working, not a broken setup. To widen it, do both, in this order:

1. Add the scope to the Integration at developer.webex.com/my-apps
2. Re-run this wizard from Step 1 so `webex_scopes` matches

### Tools are missing entirely

```bash
claude mcp list
```

`Needs authentication` means the client ID was accepted and only the browser sign-in is outstanding — run `/mcp`.
If the server is absent, the plugin is not enabled.

### Message bodies come back empty

Add `spark:kms` to the Integration and to `webex_scopes`. It is not one of the 9 scopes the server lists as
required, but Webex uses it for end-to-end encrypted content, and without it some message bodies decrypt to
nothing.

### Your organization blocks it

Access can be gated by a Webex Control Hub setting. If sign-in succeeds but every call is refused, ask a Webex
administrator to enable MCP access for the organization.

---

## Changing the disclaimer later

The text lives in the `webex_disclaimer` plugin setting. Run `/plugin configure`, pick this plugin, and edit or
clear that field — clearing it disables the append entirely. No restart is needed; the hook reads the value on
each call.
