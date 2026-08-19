---
name: webex-setup
description: |
  Guide a user through connecting Cisco's hosted Webex MCP servers to OpenCode end to end — choose which
  servers and which capabilities to grant, settle a callback port, register a Webex Integration, add the
  servers to opencode.json, authenticate, and verify. Also the troubleshooter for a connection that fails or
  a tool that returns 403.
  TRIGGER when: the user is setting up Webex for the first time in OpenCode, says "set up webex",
  "connect webex", "get me started with webex"; wants to change which Webex capabilities are granted or the
  OAuth callback; Webex tools are missing; sign-in fails; or an error mentions invalid_scope, redirect_uri,
  insufficient_scope, or a 403 from a Webex tool.
  SKIP when: Webex is already connected and the user just wants to read, search or post messages — call the
  webex-* tools directly instead.
metadata:
  host: opencode
---

# Webex MCP setup (OpenCode)

You help a user connect OpenCode to Cisco's **hosted** Webex MCP servers from nothing, conversationally and
end to end. Nothing is self-hosted, and the connection acts as the user over OAuth 2.0 rather than as a bot —
but it does need the client ID **and client secret** of a Webex Integration they own.

It covers the **Messaging** and **Meetings** servers, together or separately, in a single pass.

Two settings must agree between the user's Webex Integration and OpenCode — the **callback host/port** and the
**scopes**. Each mismatch produces an error that does not name its cause, which is what this wizard exists to
prevent.

## How OpenCode differs from Claude Code / Codex

There is no `/plugin` marketplace and no `claude mcp add-json` here. In OpenCode:

- **MCP servers are declared in config**, not registered by a CLI. You edit `opencode.json` (global at
  `~/.config/opencode/opencode.json`, or project-level `opencode.json` / `.opencode/opencode.json`) and add a
  `mcp` entry per server with `type: "remote"`.
- **OAuth is built in.** For a `type: "remote"` server, OpenCode detects the 401, runs the OAuth flow, and
  stores tokens in `~/.local/share/opencode/mcp-auth.json`. You trigger it with `opencode mcp auth <name>`.
- **Client credentials go in the `oauth` object** as `clientId`, `clientSecret` and `scope`. Prefer
  `{env:VAR}` interpolation for the secret so it never lands in the config file in plaintext.
- **The guard** (HTML-escaped mentions, mis-threaded replies, unbounded space search, AI disclaimer) ships as
  an OpenCode plugin at `.opencode/plugin/webex-guard.js`, using the `tool.execute.before` hook. It is not a
  `hooks.json` matcher.

## How to run this

**This file is context for you, not a script to read out.** Do not relay the explanations; use them to make
the right call at each step. A user who wanted this much detail would have opened the README.

Output discipline:

- **Two or three lines per step.** One line of context, then the question.
- **Never restate what just happened.** No recaps between steps, no summary at the end.
- **Give the reason only when it changes what they do.**
- **Report outcomes in a few words.** "Port 35621 is free." "Added to opencode.json."
- **One question per turn.** Wait for the answer. Never batch decisions.
- **Use selectable options where your host supports them.** Otherwise list them in plain language, one
  question per turn. Never paste a table of scopes and ask the user to type a choice.

If the user is returning to a half-finished setup, read **Resuming a partial setup** first.

---

### Step 0: Say what this is

Two lines, then move on: this connects Webex to OpenCode and acts **as them**, not as a bot; it takes about
five minutes and one step happens on the Webex developer site. Do not list prerequisites or preview the steps.
Go straight into Step 1.

### Step 1: Which Webex servers?

Ask which they want as a multi-select, preselecting *Messaging*:

| Option label | Description to show | `url` | Config key |
| --- | --- | --- | --- |
| `Messaging` | Read, search and post messages, spaces and threads. | `https://mcp.webexapis.com/mcp/webex-messaging` | `webex-messaging` |
| `Meetings` | Schedule meetings, and read transcripts, recordings and AI summaries. | `https://mcp.webexapis.com/mcp/webex-meeting` | `webex-meeting` |

Both can be set up in one pass: **every decision is collected first, then one visit to the Webex site, then
one config write, then a sign-in per server.** Do not loop the whole flow once per server.

Carry forward a per-server scope list, and a **union** for the Integration in Step 5.

Vidcast (`https://mcp.webexapis.com/mcp/vidcast`) is deliberately not offered: it requires
`Identity:Organization` and `Identity:Config`, organization-level identity access for a read-only video tool,
and its scopes cannot be narrowed. If the user asks for it by name, say that and let them decide.

### Step 2: Which capabilities?

Ask once per server chosen in Step 1 — Messaging first, then Meetings — as separate questions in separate
turns. Say once that anything not granted returns a 403 rather than failing silently, and can be widened later.

#### Messaging

Offer these four options as a multi-select, preselecting *Read and post messages*:

| Option label | Description to show | Scopes it contributes |
| --- | --- | --- |
| `Read and post messages` | Read, search and post messages, reply in threads, and list spaces. Posts appear as you. | `spark:messages_read` `spark:messages_write` `spark:rooms_read` |
| `Read messages only` | Read and search messages and spaces, with no ability to post or edit anything. | `spark:messages_read` `spark:rooms_read` |
| `Create and delete spaces` | Create, rename and delete Webex spaces. Deleting a space cannot be undone. | `spark:rooms_write` |
| `Manage space membership` | See who is in a space, and add or remove people. | `spark:memberships_read` `spark:memberships_write` |

Webhook scopes (`spark:webhooks_read`, `spark:webhooks_write`) are not offered — they need a publicly
reachable callback and are not useful from an editor. Add only if asked by name.

If the user picks both `Read and post messages` and `Read messages only`, treat read-only as the narrower
intent and confirm which they meant.

#### Meetings

Offer these three options as a multi-select, preselecting *Read meetings and transcripts*:

| Option label | Description to show | Scopes granted |
| --- | --- | --- |
| `Read meetings and transcripts` | List and search meetings, see details and live participants, and read transcripts and recordings. | `meeting:schedules_read` `meeting:participants_read` `meeting:transcripts_read` `meeting:recordings_read` |
| `AI summaries and action items` | Read AI-generated summary notes and action items for ended meetings. | `meeting:summaries_read` |
| `Create, change and cancel meetings` | Schedule, reschedule and cancel meetings, and manage invitees. | `meeting:schedules_write` |

Say briefly:

- **`Create, change and cancel meetings` sends real email** to invitees, and cancelling emails them too. It
  is the most consequential grant in this wizard.
- **`AI summaries and action items` needs Webex AI Assistant** enabled for the organization; a 403 there is an
  entitlement problem, not a scope one.

#### Then

Assemble the scopes, keeping two forms:

- **For the user:** a bullet list, one scope per line, grouped under its server — the list they tick on the
  Webex site.
- **For the configuration:** a space-separated string per server, each starting with `spark:mcp`, which both
  servers require. That is the value of `oauth.scope` in Step 6. Never show the user this form.

Also keep the union across servers for Step 5. Show the per-server bullet lists once, and say this is what
will be requested at sign-in.

### Step 3: AI disclaimer?

**Skip entirely if Step 2 granted no write scope.**

Explain that outgoing messages can carry an automatic note saying they were AI-generated, appended in italics
on its own line by the guard plugin so it cannot be forgotten. Offer three options, defaulting to the first:

| Option label | Description to show |
| --- | --- |
| `Yes, use the default` | Appends: _This message was generated using AI and posted using the Webex MCP server. Apologies in advance for any errors or omissions_ |
| `Yes, but let me write it` | Same behaviour with your own wording. You will be asked for the text. |
| `No disclaimer` | Messages go out with no added note. |

If they want their own wording, ask for it in a follow-up turn and use it verbatim.

### Step 4: Which callback port?

Explain that sign-in briefly runs a local listener and the port must match what they register with Webex. Test
the default (35621) yourself if you have a shell:

```bash
python3 -c 'import socket,sys
p=int(sys.argv[1]); s=socket.socket()
try: s.bind(("127.0.0.1",p)); print(f"{p} is free")
except OSError as e: print(f"{p} is NOT usable: {e}")
finally: s.close()' 35621
```

- **Free** → use it, no question.
- **Taken** → say what holds it, test a nearby port, ask the user to confirm or name their own, and re-run the
  check on whatever they choose.

OpenCode picks its own loopback callback for the OAuth flow, but registering the redirect URIs below covers
the ports/hosts it may use. Ports below 1024 need admin rights and will not work.

### Step 5: Register the Integration on the Webex site

This step needs a human signed in to Webex. **One Integration covers every server chosen**, so it happens
once. Give them the union of scopes as a bullet list.

> Go to **[developer.webex.com/my-apps](https://developer.webex.com/my-apps) → Create a New App → Integration**
>
> - **Redirect URIs:** add **both**
>   - `http://localhost:<PORT>/callback`
>   - `http://127.0.0.1:<PORT>/callback`
> - **Scopes:** tick exactly these
>   - `spark:mcp`
>   - `<one scope per line, the union from Step 2>`
>
> Then copy **both** the **Client ID** and the **Client Secret**, and paste the Client ID back here.

Add both redirect URIs because Webex matches them as exact strings and the loopback host can be either
`localhost` or `127.0.0.1`. Registering both costs nothing and removes a guess that fails at the redirect.

**The Client Secret is required.** Webex Integrations are confidential clients: the token endpoint rejects the
exchange without `client_secret`, even with PKCE. The **client ID is not sensitive** and is fine in the
conversation; the **client secret is** — do not paste it here or write it into `opencode.json`. Step 6 takes
it through an environment variable instead.

### Step 6: Add the servers to opencode.json

**This is the OpenCode-specific step.** Add one `mcp` entry per server chosen. Use the global config
(`~/.config/opencode/opencode.json`) so Webex is available in every project, unless the user wants it limited
to one repo (then use the project `opencode.json`).

Keep the client secret out of the file with `{env:WEBEX_CLIENT_SECRET}`. Example with both servers:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "webex-messaging": {
      "type": "remote",
      "url": "https://mcp.webexapis.com/mcp/webex-messaging",
      "enabled": true,
      "oauth": {
        "clientId": "<CLIENT_ID>",
        "scope": "<MESSAGING SCOPE STRING>"
      }
    },
    "webex-meeting": {
      "type": "remote",
      "url": "https://mcp.webexapis.com/mcp/webex-meeting",
      "enabled": true,
      "oauth": {
        "clientId": "<CLIENT_ID>",
        "scope": "<MEETINGS SCOPE STRING>"
      }
    }
  }
}
```

Notes:

- `scope` is the space-separated form from Step 2, each starting with `spark:mcp`. Not the bullet list.
- **The client secret:** OpenCode reads `oauth.clientSecret`, and it supports `{env:VAR}` interpolation. Add
  `"clientSecret": "{env:WEBEX_CLIENT_SECRET}"` to each `oauth` block and have the user export
  `WEBEX_CLIENT_SECRET` in their shell profile (`~/.zshrc`, `~/.bashrc`, or their OS keychain-backed env).
  This keeps the real secret out of the config file. If they would rather not set an env var, they can paste
  the literal secret as `clientSecret`, but tell them plainly that it then lives in the file in plaintext.
- Only include the servers they actually chose. Omit the block for a server they skipped.
- Merge into any existing `mcp` object rather than overwriting the file. Read the current config first.

If the user granted a disclaimer in Step 3, write it where the guard plugin reads it (Step 6b).

Show the user the edited `opencode.json` snippet so a silent write failure cannot pass for success.

### Step 6b: Disclaimer file (only if Step 3 chose one)

The guard plugin reads the disclaimer from `~/.config/opencode/webex-mcp/disclaimer.txt`. Write it:

```bash
mkdir -p ~/.config/opencode/webex-mcp && cat > ~/.config/opencode/webex-mcp/disclaimer.txt <<'EOF'
<DISCLAIMER TEXT>
EOF
```

Read it back and show the user. If they declined, write nothing — an absent file means no disclaimer.

Also confirm the guard plugin is present at `~/.config/opencode/plugin/webex-guard.js` (global) or
`.opencode/plugin/webex-guard.js` (project). If it is not, copy it from this repo's `.opencode/plugin/`
directory. Node must be on PATH for the guard to run; it fails open otherwise, so the plugin still works
without the disclaimer/guard if Node is missing.

### Step 7: Authenticate

OpenCode registers `type: "remote"` servers from config on startup, so **the servers appear after a restart**
of the OpenCode session (or on next launch). Then authenticate each one:

```bash
opencode mcp auth webex-messaging
opencode mcp auth webex-meeting     # only if Meetings was chosen
```

Each opens the browser for consent (once per server, as the token is per server) and stores the token in
`~/.local/share/opencode/mcp-auth.json`.

**Before the user clicks**, if you can read the authorization URL, check:

- `redirect_uri` host/port is one of the two registered in Step 5.
- `scope` matches **that server's** Step 2 string, with nothing extra. A Meetings URL carrying
  `spark:messages_*`, or a Messaging URL carrying `meeting:*`, means the wrong scope string went into the
  wrong `mcp` entry.

If either is wrong, stop and fix it (add the redirect URI, or correct `oauth.scope` and re-auth).

**Verify with a read-only call**, do not trust a closed browser tab. Pick one covered by the granted scopes:

| Server | Call | Needs |
| --- | --- | --- |
| Messaging | `webex-search-spaces` with `max: 3`, `sortBy: "lastactivity"` | `spark:rooms_read` |
| Meetings | `webex-list-meetings` with a small `max` | `meeting:schedules_read` |

Live data back means the token exchange succeeded. Report it in one line. If the granted scopes cover no
read-only call, say so rather than calling a tool that would create something.

If a call fails, run `opencode mcp list` (auth status) or `opencode mcp debug <name>` (connection + OAuth
flow) — that is where the underlying error text appears. See Troubleshooting for the common ones.

### Step 8: Close out with things to try

Verification already happened. Write four or five sample prompts derived from what they actually granted — real
sentences, not a menu. Only include a prompt if every scope it needs was granted.

| Granted | Prompts worth offering |
| --- | --- |
| Messaging read | "Summarise what happened in the *X* space today." · "Find the messages where we decided on *Y*." |
| Messaging write | "Reply in that thread saying the deploy is done." · "Send *N* a Webex message asking for a review." |
| Meetings read | "What meetings do I have tomorrow?" · "Pull the transcript from this morning's *X* call and list the decisions." |
| Meetings AI summaries | "Give me the action items from yesterday's *X* meeting." |
| Meetings write | "Schedule a 30-minute follow-up with *N* on Thursday afternoon." |
| Both servers | "Summarise this morning's *X* meeting and post the action items to the *X* space." |

Substitute real names you saw during Step 7. Then two short lines: edit `opencode.json` and re-auth to change
capabilities or the port, and, only if a disclaimer was set, that it lives in
`~/.config/opencode/webex-mcp/disclaimer.txt` and can be edited or deleted.

---

## Resuming a partial setup

1. Is there a `webex-messaging` entry under `mcp` in `opencode.json`? Absent means Step 6 has not run.
2. Run `opencode mcp list` — does it show the server authenticated? `Needs authentication` means Step 7's
   sign-in is outstanding.
3. Are the `webex-*` tools in your tool list? That is the reliable signal both registration and auth
   succeeded. If the entry exists in config but the tools are absent, the session predates the config change —
   restart OpenCode.

Tell the user what you found rather than silently resuming, and continue from the first incomplete step.

## Troubleshooting

### Tools are missing entirely
Check the `mcp` entry exists in `opencode.json`, then that the OpenCode session was restarted after adding it.
Run `opencode mcp list`; `Needs authentication` means run `opencode mcp auth <name>`.

### `client_secret cannot be null or empty`
The Integration's client secret was not supplied. Consent succeeds, then the **token exchange** fails. Add
`oauth.clientSecret` (via `{env:WEBEX_CLIENT_SECRET}`) to the server's config entry and re-auth. Webex
Integrations are confidential clients — PKCE does not exempt them. Regenerate the secret at
developer.webex.com/my-apps if lost.

### `invalid_scope`
The requested scopes are not all present on the Integration. Compare the `scope` in the authorization URL
against the scope list at developer.webex.com/my-apps and fix whichever is wrong. Edit `oauth.scope` in
`opencode.json`, restart, and re-auth — the config is read at registration.

### The redirect fails, or the browser cannot connect
Three things must agree: the Redirect URI on the Integration, the host in the authorization URL (read it, do
not assume — `127.0.0.1` vs `localhost`), and the port. Register both hosts in Step 5 to cover this.

### 403 or `insufficient_scope` from a tool
That tool needs a capability outside the granted set — the narrow grant working, not a broken setup. To widen:
add the scope to the Integration at developer.webex.com/my-apps, then update `oauth.scope` in `opencode.json`,
restart, and re-auth.

### Message bodies come back empty
Add `spark:kms` to the Integration and to `oauth.scope`, then restart and re-auth. Webex uses it for
end-to-end encrypted content; without it some message bodies decrypt to nothing.

### Your organization blocks it
Access can be gated by a Webex Control Hub setting. If sign-in succeeds but every call is refused, ask a Webex
administrator to enable MCP access for the organization.

### `opencode mcp debug <name>`
Shows current auth status, tests HTTP connectivity, and attempts the OAuth discovery flow — the fastest way to
see the real error when auth fails.

## Changing the disclaimer later

The text lives in `~/.config/opencode/webex-mcp/disclaimer.txt`. Rewrite that file to change the wording, or
delete it to stop appending. No restart is needed — the guard plugin reads it on every call.

## Limitations

- **Creating the Webex Integration cannot be automated.** It needs a human signed in to Webex.
- **Control Hub enablement is out of reach.** If an admin has not enabled MCP access, sign-in can succeed while
  every call is refused.
- **This is not zero-config, by design of the upstream server.** Webex requires each user to create their own
  Integration and, because Integrations are confidential clients, supply a client secret. The wizard removes
  the guesswork, not the steps.
