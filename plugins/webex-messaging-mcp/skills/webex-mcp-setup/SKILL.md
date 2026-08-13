---
name: webex-mcp-setup
description: |
  Guide a user through connecting Cisco's hosted Webex Messaging MCP server end to end — choose which Webex
  capabilities to grant, settle a callback port, register a Webex Integration, apply the configuration, sign in,
  and verify. Also the troubleshooter for a connection that fails or a tool that returns 403.
  TRIGGER when: the user is setting up Webex for the first time, just installed the plugin, says "set up webex",
  "connect webex", "get me started with webex"; wants to change which Webex capabilities are granted or the OAuth
  callback port; Webex tools are missing; sign-in fails; or an error mentions dynamic client registration,
  invalid_scope, redirect_uri, insufficient_scope, or a 403 from a Webex tool.
  SKIP when: Webex is already connected and the user just wants to read, search or post messages — call the
  webex-* tools directly instead.
---

# Webex Messaging MCP setup

You help a user connect their editor to Cisco's **hosted** Webex Messaging MCP server
(`https://mcp.webexapis.com/mcp/webex-messaging`) from nothing, conversationally and end to end. Nothing is
self-hosted and there is no bot token: it authenticates as the user over OAuth 2.0.

Two settings must agree between the user's Webex Integration and this plugin — the **callback port** and the
**scopes**. Each mismatch produces an error that does not name its cause, which is what this wizard exists to
prevent.

## How to run this

- **Ask one question at a time**, and wait for the answer before moving on. Never batch decisions into one message.
- **Use selectable options where your host supports them.** In Claude Code use `AskUserQuestion` — `multiSelect: true`
  for the capability checklist. In hosts without it, ask in plain language and list the options, but still one
  question per turn. Do not paste a table of scopes and ask the user to type which they want.
- **Explain before asking.** One or two sentences on what the choice affects and what breaks if it is wrong.
- **Some steps run commands, some cannot.** Where a step needs a shell, branch on whether you have one — see
  each step. In hosts with no shell (claude.ai, Claude Desktop), present copyable blocks and wait for the user to
  confirm they ran them.
- **Do not dump the whole plan up front.** Step 0's summary, then one decision at a time.

If the user is returning to a half-finished setup, read **Resuming a partial setup** first.

---

### Step 0: Say what this is

Before the first question, tell the user in about four lines:

- This connects their editor to Cisco's hosted Webex Messaging MCP server, so they can read, search and post Webex
  messages without opening Webex.
- It acts **as them**, not as a bot. Anything posted appears under their own name.
- They will need a browser, and a Webex organization where an administrator has enabled MCP access.
- It takes about five minutes, and one step happens on the Webex developer site.

Then go straight into Step 1. Do not ask permission to begin.

### Step 1: Which capabilities?

Explain that Webex grants access per capability, that the choice can be widened later, and that anything not granted
returns a 403 rather than failing silently.

Then offer these **four options as a multi-select checklist**, preselecting *Read and post messages*:

| Option label | Description to show | Scopes it contributes |
| --- | --- | --- |
| `Read and post messages` | Read, search and post messages, reply in threads, and list spaces. Covers almost all editor use. Posts appear as you. | `spark:messages_read` `spark:messages_write` `spark:rooms_read` |
| `Read messages only` | Read and search messages and spaces, with no ability to post or edit anything. | `spark:messages_read` `spark:rooms_read` |
| `Create and delete spaces` | Create, rename and delete Webex spaces. Deleting a space cannot be undone. | `spark:rooms_write` |
| `Manage space membership` | See who is in a space, and add or remove people. Can remove colleagues. | `spark:memberships_read` `spark:memberships_write` |

Webhook management (`spark:webhooks_read`, `spark:webhooks_write`) is deliberately not offered — it needs a publicly
reachable callback URL and is not useful from an editor. Add it only if the user asks for it by name.

If the user picks both `Read and post messages` and `Read messages only`, treat read-only as the narrower intent and
confirm which they meant.

Build one space-separated scope string from the selections, always starting with `spark:mcp`, which the server
requires. Show the user the final string and say it is what will be requested at sign-in.

### Step 2: AI disclaimer?

**Skip this step entirely if Step 1 granted no write scope.** Nothing is ever posted, so the question is noise.

Explain that outgoing messages can carry an automatic note saying they were AI-generated, appended in italics on its
own line, applied by a hook so it cannot be forgotten or talked around.

Offer three options, defaulting to the first:

| Option label | Description to show |
| --- | --- |
| `Yes, use the default` | Appends: _This message was generated using AI and posted using the Webex MCP server. Apologies in advance for any errors or omissions_ |
| `Yes, but let me write it` | Same behaviour with your own wording. You will be asked for the text. |
| `No disclaimer` | Messages go out with no added note. |

If they want their own wording, ask for it in a follow-up turn and use it verbatim. If they decline, simply do not
write the file in Step 5.

### Step 3: Which callback port?

Explain that sign-in briefly runs a local listener, that the port must match what they register with Webex, and that
a port already in use fails at the redirect with an error that looks like a Webex problem.

**If you have a shell**, test the default (35621) yourself, without asking — there is no decision until it fails.

macOS or Linux:

```bash
python3 -c 'import socket,sys
p=int(sys.argv[1]); s=socket.socket()
try: s.bind(("127.0.0.1",p)); print(f"{p} is free")
except OSError as e: print(f"{p} is NOT usable: {e}")
finally: s.close()' 35621
```

Windows (PowerShell):

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

- **Free** → say so and use it. Do not ask a question.
- **Taken** → say what is holding it, test a nearby port, and ask the user to confirm that or name their own.
  **Re-run the check on whatever they choose**, including a port they name themselves, until one passes.

**If you have no shell**, present one of the blocks above for the user to run and wait for the result before
continuing. Do not assume 35621 is free.

Say once that this is a pre-flight, not a reservation: if the redirect fails later, come back and re-test. Ports
below 1024 need administrator rights and will not work.

### Step 4: Register the Integration on the Webex site

This step cannot be automated — it needs a human signed in to Webex. Give them the values already filled in, with
nothing left to work out:

> Go to **[developer.webex.com/my-apps](https://developer.webex.com/my-apps) → Create a New App → Integration**
>
> - **Redirect URI:** `http://127.0.0.1:<PORT>/callback`
> - **Scopes:** tick exactly these — `<THE SCOPE LIST FROM STEP 1>`
>
> Then copy the **Client ID** and paste it back here.

Call out that the Redirect URI must use **`127.0.0.1`, not `localhost`** — Webex compares redirect URIs as exact
strings, and `localhost` fails with an error that never mentions the hostname. Tell them to ignore the client
secret: this connects as a public PKCE client and does not use one.

Wait for the Client ID. It is not a secret, but do not write it to a file.

### Step 5: Register the server

This plugin does not define the MCP server itself, so nothing is configured until this step runs. Register it with
the values gathered above — one command, and because it is a fresh registration the pinned scopes take effect
immediately with no restart.

**If you have a shell**, confirm with the user, then run:

```bash
claude mcp add-json webex '{
  "type": "http",
  "url": "https://mcp.webexapis.com/mcp/webex-messaging",
  "oauth": {
    "clientId": "<CLIENT_ID>",
    "callbackPort": <PORT>,
    "scopes": "<SCOPE STRING>"
  }
}' --scope user
```

`callbackPort` is a **number**, unquoted. `scopes` is a single space-separated string.

Use `--scope user` so Webex is available in every project. Use `--scope project` only if the user explicitly wants it
limited to the current repository.

If a server named `webex` already exists, `claude mcp remove webex --scope user` first, then re-add — that is also
how you change the port or scopes later.

**If you have no shell**, present the command as a copyable block and wait for the user to confirm they ran it.

Then write the disclaimer, if Step 2 chose one. It lives in a file the guard hook reads:

```bash
mkdir -p "$CLAUDE_PLUGIN_DATA" && cat > "$CLAUDE_PLUGIN_DATA/disclaimer.txt" <<'EOF'
<DISCLAIMER TEXT>
EOF
```

If the user declined a disclaimer, write nothing — an absent file means no disclaimer. If `CLAUDE_PLUGIN_DATA` is not
set in your environment, the disclaimer cannot be stored; say so rather than silently skipping it, and continue.

### Step 6: Sign in, then verify

Tell the user to run `/mcp`, choose **webex**, and complete the browser sign-in.

Before they click through, it is worth checking the authorization URL matches what was set up — `redirect_uri` should
carry the port from Step 3, and `scope` should list what Step 1 selected and nothing more.

Then verify with a read-only call rather than declaring success:

> List my 3 most recently active Webex group spaces.

Live data back means it works. If they granted read-only access, do not test by posting.

---

## Resuming a partial setup

Setup gets interrupted. Before starting over, work out what is already done and continue from the first incomplete
step. If you have a shell:

1. `claude mcp list` — is a `webex` server listed? Absent means Step 5 has not run. `Needs authentication` means it
   is registered and only the browser sign-in is outstanding (Step 6).
2. `claude mcp get webex` — check the registered `clientId`, `callbackPort` and `scopes` against what the user wants.
   A port or scope change means re-running Step 5, not editing the file by hand.
3. Are `webex-*` tools already in your tool list? Then registration and sign-in both succeeded — go straight to the
   Step 6 verification call, or to **Troubleshooting** if one specific tool is failing.

Tell the user what you found rather than silently resuming — "Looks like the plugin is configured and just needs the
browser sign-in, want me to pick up there?" — and continue from that point instead of redoing finished work.

With no shell, ask the user which of the steps they have already completed.

## Troubleshooting

### `does not support dynamic client registration`

The server will not register an OAuth client, so it needs a client ID. The registration is missing one — check
`claude mcp get webex`, and re-run Step 5 with the client ID from the user's Integration.

### `invalid_scope`

The requested scopes are not all present on the Integration. Compare the two directly — the `scope` parameter in the
authorization URL against the scope list at developer.webex.com/my-apps — and fix whichever is wrong.

Do not fix this by editing `oauth.scopes` in `~/.claude.json` mid-session — the OAuth config is read when the server
is registered, so an edit does nothing until a restart. Re-run Step 5 instead (`claude mcp remove webex` then
`add-json`), which takes effect immediately.

### The redirect fails, or the browser cannot connect

Three things must agree. Check all three rather than guessing:

1. The Redirect URI on the Integration
2. The host in the authorization URL — `127.0.0.1`, not `localhost`
3. The port the editor is listening on — re-run the Step 3 bind check, since something may have taken it since

### 403 or `insufficient_scope` from a tool

That tool needs a capability outside the granted set. The server exposes all 24 tools regardless of what was granted,
so this is the narrow grant working, not a broken setup. To widen it, do both, in this order:

1. Add the scope to the Integration at developer.webex.com/my-apps
2. Re-run this wizard from Step 1 so the registered scope set matches

### Tools are missing entirely

Run `claude mcp list`. `Needs authentication` means the client ID was accepted and only the browser sign-in is
outstanding — run `/mcp`. If no `webex` server is listed at all, Step 5 has not run.

### Message bodies come back empty

Add `spark:kms` to the Integration and to the registered scope set, then re-run Step 5. It is not one of the 9 scopes the server lists as required,
but Webex uses it for end-to-end encrypted content, and without it some message bodies decrypt to nothing.

### Your organization blocks it

Access can be gated by a Webex Control Hub setting. If sign-in succeeds but every call is refused, ask a Webex
administrator to enable MCP access for the organization.

## Changing the disclaimer later

The text lives in `disclaimer.txt` in the plugin's data directory (`$CLAUDE_PLUGIN_DATA`). Rewrite that file to change
the wording, or delete it to stop appending anything. No restart is needed — the hook reads it on every call.

## Graceful degradation

If `claude mcp add-json` is unavailable in the user's host, fall back to the flag form, which cannot pin scopes:

```bash
claude mcp add --transport http --client-id <CLIENT_ID> --callback-port <PORT> \
  webex https://mcp.webexapis.com/mcp/webex-messaging
```

The server will then request whatever scope set it advertises, so the Integration must hold all of them or sign-in
fails with `invalid_scope`. Say that plainly rather than leaving the user to discover it. Scopes can be pinned
afterwards in `~/.claude.json` under `mcpServers.webex.oauth.scopes`, but that needs a restart to take effect.

In a host with no shell at all, present the commands as copyable blocks and wait for confirmation at each step.

## Limitations

- **Creating the Webex Integration cannot be automated.** It needs a human signed in to Webex, so Step 4 is always
  manual.
- **Control Hub enablement is out of reach.** If an administrator has not enabled MCP access for the organization,
  sign-in can succeed while every call is refused, and only an administrator can fix it.
- **This is not zero-config, by design of the upstream server.** Unlike servers that ship a public pre-registered
  OAuth client, Webex requires each user to create their own Integration. The wizard removes the guesswork, not the
  step.
- **The port check is a pre-flight, not a reservation.** Another process can claim the port between the check and
  sign-in.
