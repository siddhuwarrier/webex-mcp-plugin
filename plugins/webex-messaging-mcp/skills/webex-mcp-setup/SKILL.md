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

### How to run it

This is an interactive wizard, not a document to read out. Follow these rules or the experience is wrong:

- **Ask one question per turn** with `AskUserQuestion`, and wait for the answer before moving on. Never batch
  several questions into one call, and never ask the user to answer three things in one message.
- **Use selectable options, not prose.** Every choice below has fixed options. Do not paste a markdown table of
  scopes and ask the user to type which ones they want.
- **Explain before asking.** Each question gets one or two sentences of context first — what it affects and what
  happens if they get it wrong.
- **Do not dump the whole plan up front.** The user sees Step 0's summary, then one decision at a time.

### Step 0: Say what this is

Before the first question, tell the user in about four lines:

- This connects their editor to Cisco's hosted Webex Messaging MCP server, so they can read, search and post Webex
  messages without opening Webex.
- It acts **as them**, not as a bot. Anything posted appears under their own name.
- They will need a browser, and a Webex organization where an administrator has enabled MCP access.
- It takes about five minutes, and one step happens on the Webex developer site.

Then go straight into Step 1. Do not ask permission to begin.

### Step 1: Which capabilities? (checklist)

Explain that Webex grants access per capability, that the choice can be widened later, and that anything not granted
returns a 403 rather than failing silently.

Then ask with `AskUserQuestion`, `multiSelect: true`, header `Capabilities`, using **exactly these four options**:

| Option label | Description to show | Scopes it contributes |
| --- | --- | --- |
| `Read and post messages` | Read, search and post messages, reply in threads, and list spaces. Covers almost all editor use. Posts appear as you. | `spark:messages_read` `spark:messages_write` `spark:rooms_read` |
| `Read messages only` | Read and search messages and spaces, with no ability to post or edit anything. | `spark:messages_read` `spark:rooms_read` |
| `Create and delete spaces` | Create, rename and delete Webex spaces. Deleting a space cannot be undone. | `spark:rooms_write` |
| `Manage space membership` | See who is in a space, and add or remove people. Can remove colleagues. | `spark:memberships_read` `spark:memberships_write` |

Preselect **Read and post messages**. Webhook management (`spark:webhooks_read`, `spark:webhooks_write`) is
deliberately not offered — it needs a publicly reachable callback URL and is not useful from an editor. Add it only
if the user asks for it by name.

If the user picks both `Read and post messages` and `Read messages only`, treat the read-only choice as the
narrower intent and confirm which they meant before continuing.

Build one space-separated scope string from the selections, always starting with `spark:mcp`, which the server
requires. Show the user the final string and say it will be requested at sign-in.

### Step 2: AI disclaimer? (only if they can post)

**Skip this step entirely if Step 1 granted no write scope.** Nothing is ever posted, so the question is noise.

Explain that outgoing messages can carry an automatic note saying they were AI-generated, appended in italics on its
own line, applied by a hook so it cannot be forgotten.

Ask with `AskUserQuestion`, single-select, header `Disclaimer`, using **exactly these three options**:

| Option label | Description to show |
| --- | --- |
| `Yes, use the default` | Appends: _This message was generated using AI and posted using the Webex MCP server. Apologies in advance for any errors or omissions_ |
| `Yes, but let me write it` | Same behaviour with your own wording. You will be asked for the text. |
| `No disclaimer` | Messages go out with no added note. |

Default to **Yes, use the default**. If they choose their own wording, ask for it in a follow-up turn and use it
verbatim. If they decline, set `webex_disclaimer` to an empty string.

### Step 3: Which callback port?

Explain that sign-in briefly runs a local listener, that the port must match what they register with Webex, and that
a port already in use fails at the redirect with an error that looks like a Webex problem.

Test the default first, **without asking** — there is no decision to make yet:

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
Fall back to `lsof -iTCP:<PORT> -sTCP:LISTEN -n -P` or `netstat -ano | findstr :<PORT>` and treat any output as "in
use". On Windows `python3` is usually `python` or `py -3`, so prefer the PowerShell form there.

- **If 35621 is free:** say so and use it. Do not ask a question.
- **If it is taken:** say what is holding it, test a nearby free port, and ask the user with `AskUserQuestion` to
  confirm the suggested port or pick their own. **Re-run the bind test on whatever they choose**, including a port
  they name themselves, and keep going until one passes.

Mention once that this is a pre-flight, not a reservation: if the redirect fails later, come back and re-test.
Ports below 1024 need administrator rights and will not work.

### Step 4: Register the Integration on the Webex site

This is the one step that cannot be automated — it needs a human signed in to Webex.

Give them the values already filled in, and nothing else to work out:

> Go to **[developer.webex.com/my-apps](https://developer.webex.com/my-apps) → Create a New App → Integration**
>
> - **Redirect URI:** `http://127.0.0.1:<PORT>/callback`
> - **Scopes:** tick exactly these — `<THE SCOPE LIST FROM STEP 1>`
>
> Then copy the **Client ID** and paste it back here.

Call out that the Redirect URI must use **`127.0.0.1`, not `localhost`** — Webex compares redirect URIs as exact
strings, and `localhost` fails with an error that never mentions the hostname. Say they can ignore the client
secret: this connects as a public PKCE client and does not use one.

Wait for the Client ID. It is not a secret, but do not write it to a file.

### Step 5: Apply the configuration

Install with every value at once:

```bash
claude plugin install webex-messaging-mcp@webex-mcp-official \
  --config webex_client_id=<CLIENT_ID> \
  --config webex_callback_port=<PORT> \
  --config "webex_scopes=<SCOPE STRING>" \
  --config "webex_disclaimer=<DISCLAIMER TEXT>"
```

Pass `--config webex_disclaimer=` empty to disable it, or omit the flag to keep the default.

If the plugin is already installed, tell the user to run `/plugin configure`, pick this plugin, and set the same
fields — an installed plugin cannot be reconfigured from the command line.

### Step 6: Sign in, then verify

Tell them to run `/mcp`, choose **webex**, and complete the browser sign-in.

Before they click through, it is worth checking the authorization URL matches what was set up — `redirect_uri`
should be the port from Step 3, and `scope` should be the list from Step 1 and nothing more.

Then verify with a read-only call rather than declaring success:

> List my 3 most recently active Webex group spaces.

Live data back means it works. If they granted read-only access, do not test by posting.

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
