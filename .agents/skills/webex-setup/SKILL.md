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

**Important OpenCode limitation.** Unlike Claude Code, OpenCode does **not** honour a narrowed `oauth.scope`
for these servers. The Webex MCP servers advertise their full scope set as `required_scopes` in their
`.well-known/oauth-protected-resource` metadata, and OpenCode requests exactly that set — it overrides whatever
you put in `oauth.scope`. So per-capability selection is not possible here: to connect at all, the Integration
must hold **every** scope the chosen server requires, and sign-in fails with `invalid_scope` otherwise.

Because of that, do **not** offer a capabilities checklist on OpenCode. Instead, tell the user plainly which
full scope set each chosen server needs, and that the guard plugin — not scope narrowing — is what keeps the
dangerous calls in check.

The full required scope set per server (from the server metadata, verified against
`https://mcp.webexapis.com/.well-known/oauth-protected-resource/mcp/<server>`):

#### Messaging (all required)

- `spark:mcp`
- `spark:messages_read`
- `spark:messages_write`
- `spark:rooms_read`
- `spark:rooms_write`
- `spark:memberships_read`
- `spark:memberships_write`
- `spark:webhooks_read`
- `spark:webhooks_write`

#### Meetings (all required)

Confirm against the server's metadata at sign-up time, since the set can change. Request the full advertised
`required_scopes`; a narrowed subset will fail with `invalid_scope`.

Say this to the user, briefly:

- **You are granting the full set, not a subset** — OpenCode forces it. Posting, editing, space creation and
  deletion, membership changes and webhook management all become callable.
- **The guard plugin is the safety net.** It blocks HTML-escaped mentions and mis-threaded replies, bounds
  unbounded space searches, and appends the AI disclaimer. It cannot, however, prevent a deliberately invoked
  destructive tool — so treat `webex-delete-space`, `webex-remove-membership` and the like with care.
- If the user is uncomfortable granting the full set, the honest answer is that Webex MCP **cannot** be
  connected in this OpenCode version with a narrower grant. Note it and stop rather than pretending otherwise.

#### Then

Keep the full required scope string per server for Step 6 (`oauth.scope`), each starting with `spark:mcp`.
Even though OpenCode derives the actual request from the server metadata, setting `oauth.scope` to the full
set keeps the config honest and self-documenting. Show the user the per-server bullet list once, and say this
is exactly what will be requested at sign-in and must all be ticked on the Integration.


### Step 3: AI disclaimer?

On OpenCode the Messaging server always includes write scopes (Step 2 forces the full set), so posting is
always possible — offer the disclaimer whenever Messaging was chosen. Skip this step only if the user chose
Meetings alone.

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

**Pin the callback in OpenCode.** By default OpenCode uses a *random* loopback port and the redirect path
`/mcp/oauth/callback` — a random port cannot be pre-registered on Webex, so sign-in fails with
`redirect_uri_mismatch`. Fix this in Step 6 by setting **both** `oauth.callbackPort` and `oauth.redirectUri`
on each server so the redirect URI is stable and matches what gets registered. The redirect URI OpenCode uses
is `http://127.0.0.1:<PORT>/mcp/oauth/callback` — note the path is `/mcp/oauth/callback`, **not** `/callback`.
Ports below 1024 need admin rights and will not work.

### Step 5: Register the Integration on the Webex site

This step needs a human signed in to Webex. **One Integration covers every server chosen**, so it happens
once. Give them the full required scope set (the union across chosen servers) as a bullet list — every scope
must be ticked, since OpenCode requests the full `required_scopes` set (Step 2).

> Go to **[developer.webex.com/my-apps](https://developer.webex.com/my-apps) → Create a New App → Integration**
>
> - **Redirect URIs:** add **both** (note the path is `/mcp/oauth/callback`, not `/callback`)
>   - `http://127.0.0.1:<PORT>/mcp/oauth/callback`
>   - `http://localhost:<PORT>/mcp/oauth/callback`
> - **Scopes:** tick **all** of these (the full required set for the chosen server(s))
>   - `<one scope per line, the full required set from Step 2>`
>
> Then copy **both** the **Client ID** and the **Client Secret**, and paste the Client ID back here.

Add both redirect URIs because Webex matches them as exact strings and OpenCode's loopback host can be either
`127.0.0.1` (current default) or `localhost`. The path is always `/mcp/oauth/callback`. Registering both hosts
costs nothing and removes a guess that fails at the redirect with `redirect_uri_mismatch`.

**The Client Secret is required.** Webex Integrations are confidential clients: the token endpoint rejects the
exchange without `client_secret`, even with PKCE. The **client ID is not sensitive** and is fine in the
conversation; the **client secret is** — do not paste it here or write it into `opencode.json`. Step 6 takes
it through an environment variable instead.

### Step 6: Add the servers to opencode.json

**This is the OpenCode-specific step.** Add one `mcp` entry per server chosen. Use the global config
(`~/.config/opencode/opencode.json` or `.jsonc`) so Webex is available in every project, unless the user wants
it limited to one repo (then use the project `opencode.json`).

Each server's `oauth` block **must** set `clientId`, `scope`, `callbackPort` and `redirectUri`. The last two
are not optional here: without them OpenCode picks a random callback port each run, which cannot be
pre-registered on Webex and fails with `redirect_uri_mismatch`. Keep the client secret out of the file with
`{env:WEBEX_CLIENT_SECRET}`. Example with both servers, `<PORT>` being the one settled in Step 4:

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
        "clientSecret": "{env:WEBEX_CLIENT_SECRET}",
        "scope": "<FULL MESSAGING SCOPE STRING>",
        "callbackPort": 35621,
        "redirectUri": "http://127.0.0.1:35621/mcp/oauth/callback"
      }
    },
    "webex-meeting": {
      "type": "remote",
      "url": "https://mcp.webexapis.com/mcp/webex-meeting",
      "enabled": true,
      "oauth": {
        "clientId": "<CLIENT_ID>",
        "clientSecret": "{env:WEBEX_CLIENT_SECRET}",
        "scope": "<FULL MEETINGS SCOPE STRING>",
        "callbackPort": 35621,
        "redirectUri": "http://127.0.0.1:35621/mcp/oauth/callback"
      }
    }
  }
}
```

Notes:

- **`callbackPort` and `redirectUri` are mandatory.** Set `redirectUri` to
  `http://127.0.0.1:<PORT>/mcp/oauth/callback` (path fixed, host `127.0.0.1`), and `callbackPort` to the same
  `<PORT>`. This is the exact string that must be registered on the Integration in Step 5.
- **`scope` is the full required set**, each starting with `spark:mcp`. OpenCode derives the actual OAuth
  request from the server's `required_scopes` metadata regardless, so a narrowed value here will not reduce
  what is requested — set it to the full set to keep the config honest and avoid confusion.
- **The client secret:** OpenCode reads `oauth.clientSecret` and supports `{env:VAR}` interpolation. Use
  `"clientSecret": "{env:WEBEX_CLIENT_SECRET}"` and have the user export `WEBEX_CLIENT_SECRET` in their shell
  profile (`~/.zshrc`, `~/.zprofile`, `~/.bashrc`) or OS keychain-backed env. If they would rather not, they
  can paste the literal secret as `clientSecret`, but tell them plainly it then lives in the file in plaintext.
- Two servers can share one `<PORT>`: the callback listener runs only briefly during each sign-in, and sign-ins
  happen one at a time.
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

- `redirect_uri` is exactly one you registered — `http://127.0.0.1:<PORT>/mcp/oauth/callback` (path
  `/mcp/oauth/callback`, not `/callback`). If the port differs from what you registered, `oauth.callbackPort` /
  `oauth.redirectUri` are not set in config; fix Step 6 and re-auth.
- `scope` lists the server's full `required_scopes` set (OpenCode uses that, not a narrowed `oauth.scope`).
  Confirm every scope in the URL is ticked on the Integration — a missing one produces `invalid_scope`. A
  Meetings URL should carry only `meeting:*` (plus `spark:mcp`); a Messaging URL only `spark:*`. Mismatched
  families mean the wrong server URL is in the wrong `mcp` entry.

If either is wrong, stop and fix it (add the redirect URI or the missing scopes to the Integration, or correct
the `mcp` entry, then re-auth). Editing `oauth.scope` will not change what is requested — the fix for
`invalid_scope` is always on the Integration side.

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

Substitute real names you saw during Step 7. Then two short lines: edit the `oauth` block in `opencode.json`
and re-auth to change the port or client, and, only if a disclaimer was set, that it lives in
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
OpenCode requests the server's full `required_scopes` set, and one or more of them is not enabled on the
Integration. Compare the `scope` parameter in the authorization URL against the scope list at
developer.webex.com/my-apps and tick every one that is missing. On OpenCode you cannot avoid this by narrowing
`oauth.scope` — the server metadata forces the full set (see Step 2). Editing `oauth.scope` does not change the
requested set; the fix is always to add the missing scopes to the Integration, then re-auth.

### The redirect fails, or the browser cannot connect
Three things must agree, exactly: the Redirect URI on the Integration, the host+path in the authorization URL
(read it — OpenCode uses `http://127.0.0.1:<PORT>/mcp/oauth/callback`, path `/mcp/oauth/callback`, not
`/callback`), and the port. If the URL shows a *different* port than you registered, `oauth.callbackPort` /
`oauth.redirectUri` are not set — add them (Step 6) so the port is stable, then register that exact URI.
Register both `127.0.0.1` and `localhost` hosts to cover either form.

### 403 or `insufficient_scope` from a tool
On OpenCode the full scope set is always granted, so a 403 here is usually an **entitlement** problem (e.g. the
org has not enabled a feature, or `meeting:summaries_read` needs Webex AI Assistant), not a missing scope. If a
scope genuinely is missing, add it to the Integration and re-auth. The guard plugin does not cause 403s — it
only rewrites or refuses specific message calls.

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

- **OpenCode cannot narrow scopes for these servers.** The Webex MCP servers advertise their full scope set as
  `required_scopes`, and OpenCode requests exactly that regardless of `oauth.scope`. So the per-capability
  grant that Claude Code offers is not possible here — you grant the full set or you do not connect. The guard
  plugin, not scope narrowing, is what limits the dangerous calls.
- **The OAuth callback must be pinned.** OpenCode defaults to a random loopback port and the path
  `/mcp/oauth/callback`. A random port cannot be pre-registered on Webex, so `oauth.callbackPort` and
  `oauth.redirectUri` are effectively required.
- **Creating the Webex Integration cannot be automated.** It needs a human signed in to Webex.
- **Control Hub enablement is out of reach.** If an admin has not enabled MCP access, sign-in can succeed while
  every call is refused.
- **This is not zero-config, by design of the upstream server.** Webex requires each user to create their own
  Integration and, because Integrations are confidential clients, supply a client secret. The wizard removes
  the guesswork, not the steps.
