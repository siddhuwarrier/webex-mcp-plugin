---
name: setup
description: |
  Guide a user through connecting Cisco's hosted Webex MCP servers end to end — choose which servers and which
  capabilities to grant, settle a callback port, register a Webex Integration, register the servers, sign in, and
  verify. Also the troubleshooter for a connection that fails or a tool that returns 403.
  TRIGGER when: the user is setting up Webex for the first time, just installed the plugin, says "set up webex",
  "connect webex", "get me started with webex"; wants to change which Webex capabilities are granted or the OAuth
  callback port; Webex tools are missing; sign-in fails; or an error mentions dynamic client registration,
  invalid_scope, redirect_uri, insufficient_scope, or a 403 from a Webex tool.
  SKIP when: Webex is already connected and the user just wants to read, search or post messages — call the
  webex-* tools directly instead.
---

# Webex MCP setup

You help a user connect their editor to Cisco's **hosted** Webex MCP servers from nothing, conversationally and end
to end. Nothing is self-hosted and there is no bot token: they authenticate as the user over OAuth 2.0.

Three servers exist — Messaging, Meetings and Vidcast. **This skill currently covers Messaging.**

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

- This connects their editor to Cisco's hosted Webex MCP servers, so they can work with Webex without opening it.
- It acts **as them**, not as a bot. Anything posted appears under their own name.
- They will need a browser, and a Webex organization where an administrator has enabled MCP access.
- It takes about five minutes, and one step happens on the Webex developer site.

Then go straight into Step 1. Do not ask permission to begin.

### Step 1: Which Webex servers?

Webex exposes three separate hosted MCP servers. They are genuinely separate: different endpoints, and scope sets
that share only `spark:mcp`. Each needs its own registration and its own browser sign-in.

Explain that, then ask which they want as a **multi-select checklist**, preselecting *Messaging*:

| Option label | Description to show | Endpoint |
| --- | --- | --- |
| `Messaging` | Read, search and post messages, spaces and threads. | `https://mcp.webexapis.com/mcp/webex-messaging` |
| `Meetings` | Schedule and list meetings, and read recordings, transcripts and summaries. | `https://mcp.webexapis.com/mcp/webex-meeting` |
| `Vidcast` | Video posts and their transcripts. | `https://mcp.webexapis.com/mcp/vidcast` |

**Only Messaging is supported by this wizard today.** If the user picks Meetings or Vidcast, say so plainly rather
than pretending — point them at the scope tables in the repository README and offer to register the server for them
with the full scope string documented there, using the same Integration, port and `add-json` command shape as the
Messaging path. Do not invent capability checklists for servers this skill has not been extended to cover.

The good news to tell them: **one Webex Integration serves all three.** Scopes are additive on the app registration,
so the Integration created in this run can hold the scopes for servers they add later, reusing the same client ID,
redirect URI and port. Only the registration and sign-in are per-server.

The remaining steps assume Messaging. Run them once per selected server if that changes.

### Step 2: Which capabilities?

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

### Step 3: AI disclaimer?

**Skip this step entirely if Step 2 granted no write scope.** Nothing is ever posted, so the question is noise.

Explain that outgoing messages can carry an automatic note saying they were AI-generated, appended in italics on its
own line, applied by a hook so it cannot be forgotten or talked around.

Offer three options, defaulting to the first:

| Option label | Description to show |
| --- | --- |
| `Yes, use the default` | Appends: _This message was generated using AI and posted using the Webex MCP server. Apologies in advance for any errors or omissions_ |
| `Yes, but let me write it` | Same behaviour with your own wording. You will be asked for the text. |
| `No disclaimer` | Messages go out with no added note. |

If they want their own wording, ask for it in a follow-up turn and use it verbatim. If they decline, simply do not
write the file in Step 6.

### Step 4: Which callback port?

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

### Step 5: Register the Integration on the Webex site

This step cannot be automated — it needs a human signed in to Webex. Give them the values already filled in, with
nothing left to work out:

> Go to **[developer.webex.com/my-apps](https://developer.webex.com/my-apps) → Create a New App → Integration**
>
> - **Redirect URIs:** add **both** of these
>   - `http://127.0.0.1:<PORT>/callback`
>   - `http://localhost:<PORT>/callback`
> - **Scopes:** tick exactly these — `<THE SCOPE LIST FROM STEP 2>`
>
> Then copy the **Client ID** and paste it back here.

Explain why both: Webex compares redirect URIs as **exact strings**, and which host the editor uses is not something
this skill can promise. Claude Code has generated `127.0.0.1` in some versions and `localhost` in others, and a
mismatch fails at the redirect with an error that never mentions the hostname. Webex allows several redirect URIs, so
registering both costs nothing and removes the guess. Step 7 confirms which one is actually in use.

Tell them to ignore the client secret: this connects as a public PKCE client and does not use one.

Wait for the Client ID. It is not a secret, but do not write it to a file.

### Step 6: Register the server

This plugin does not define the MCP server itself, so nothing is configured until this step runs. Register it with
the values gathered above — one command, and because it is a fresh registration the pinned scopes take effect
immediately with no restart.

**If you have a shell**, confirm with the user, then run:

```bash
claude mcp add-json webex-messaging '{
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

If a server named `webex-messaging` already exists, `claude mcp remove webex-messaging --scope user` first, then re-add — that is also
how you change the port or scopes later.

**If you have no shell**, present the command as a copyable block and wait for the user to confirm they ran it.

Then write the disclaimer, if Step 3 chose one. It goes in a fixed location the guard hook reads:

macOS or Linux:

```bash
mkdir -p ~/.claude/webex-mcp && cat > ~/.claude/webex-mcp/disclaimer.txt <<'EOF'
<DISCLAIMER TEXT>
EOF
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.claude\webex-mcp" | Out-Null
Set-Content -Path "$HOME\.claude\webex-mcp\disclaimer.txt" -Value '<DISCLAIMER TEXT>'
```

**Use this literal path. Do not use `$CLAUDE_PLUGIN_DATA`** — it is set for hook processes but not for your shell, so
it expands to nothing and the file lands somewhere the hook will never look. Do not try to reconstruct the plugin's
data directory either.

Read the file back and show the user what it contains, so a silent write failure cannot pass for success.

If the user declined a disclaimer, write nothing — an absent file means no disclaimer.

### Step 7: Sign in

Only one part of this genuinely needs the user — clicking through the Webex consent screen. Drive everything else
yourself rather than handing over a list of instructions.

**First, look for the server's auth tool.** A registered server that needs authentication exposes
`mcp__webex-messaging__authenticate` and `mcp__webex-messaging__complete_authentication`. Search your available tools
for a name ending in `__authenticate` for this server.

#### If the auth tool is there

1. **Call `authenticate`.** It returns the authorization URL with the correct PKCE challenge and state already in it.
   Never hand-build this URL, and never use the sample URL from the Webex developer site — that one has a placeholder
   `state` and no `code_challenge`, so the local listener rejects the callback.
2. **Check the URL before the user ever sees it**, and say what you checked:
   - `redirect_uri` — read the host and port out of the URL rather than assuming either. The port must be the one
     from Step 4, and the **exact** string, host included, must be registered on the Integration. Do not assert that
     it will be `127.0.0.1`: it varies by version, which is why Step 5 registers both spellings. If the URL carries a
     host the user has not registered, tell them the exact value to add.
   - `scope` must match the Step 2 string, with nothing extra.

   If either is wrong, **stop and fix it** rather than letting the user walk into the error. A port mismatch means
   adding that redirect URI to the Integration; extra scopes mean re-running Step 6 with the right pinned set.
3. **Open it for them.** Offer to launch the browser and do it on confirmation: `open <url>` on macOS,
   `xdg-open <url>` on Linux, `start "" "<url>"` on Windows.
4. **Copy it to the clipboard as well** — `pbcopy`, `clip.exe`, or `xclip -selection clipboard` — and print it as one
   unwrapped line. These URLs are long, and terminal multiplexers insert wrapping characters that silently corrupt a
   hand-made selection.
5. **Wait, then confirm** the `webex-*` tools have appeared. If the redirect page errors, ask for the full
   address-bar URL and pass it to `complete_authentication`.

#### If the auth tool is missing

The registration landed after this session started, so the session cannot see it. **This is the step users miss**, so
make it the only thing in your message — no preamble, no recap of what came before — and give the exact commands for
their environment rather than telling them to "restart".

You cannot do this yourself: restarting and slash commands both belong to the user.

> **The Webex server is registered, but this session can't see it yet — it needs a restart.**
>
> **Terminal:** type `/exit` (or press Ctrl-D), then run this in the same directory to come back to this
> conversation:
>
> ```bash
> claude --continue
> ```
>
> **VS Code / JetBrains:** open the command palette — <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on macOS,
> <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> elsewhere — and run **Developer: Reload Window**. Then reopen Claude
> and pick this conversation from the history.
>
> **Claude Desktop:** quit the app fully (<kbd>Cmd</kbd>+<kbd>Q</kbd> on macOS) and reopen it.
>
> Then run `/webex:setup` again. It will detect what is already done and resume at the sign-in.

Tell them `claude --continue` reopens this conversation rather than starting a fresh one, because the usual worry
about restarting is losing the thread.

Do not offer `/reload-plugins` as a shortcut. It reloads MCP servers that a *plugin* provides, and this server was
registered into the user's own configuration, so it may not be covered. Restarting is the reliable action.

### Step 8: Verify

Do not treat a completed sign-in as success. Make a read-only call:

> List my 3 most recently active Webex group spaces.

Live data back means it works. If the user granted read-only access, do not test by posting.

Then say where the settings live: re-run `/webex:setup` to change capabilities or the port, and edit
`~/.claude/webex-mcp/disclaimer.txt` to change or remove the disclaimer.

---

## Resuming a partial setup

Setup gets interrupted. Before starting over, work out what is already done and continue from the first incomplete
step. If you have a shell:

1. `claude mcp list` — is a `webex-messaging` server listed? Absent means Step 6 has not run. `Needs authentication`
   means it is registered and only the browser sign-in is outstanding (Step 7). If it is listed there but its
   `__authenticate` tool is not among your available tools, the session predates the registration — go to the restart
   instructions in Step 7.
2. `claude mcp get webex-messaging` — check the registered `clientId`, `callbackPort` and `scopes` against what the user wants.
   A port or scope change means re-running Step 6, not editing the file by hand.
3. Are `webex-*` tools already in your tool list? Then registration and sign-in both succeeded — go straight to the
   Step 8 verification call, or to **Troubleshooting** if one specific tool is failing.

Tell the user what you found rather than silently resuming — "Looks like the plugin is configured and just needs the
browser sign-in, want me to pick up there?" — and continue from that point instead of redoing finished work.

With no shell, ask the user which of the steps they have already completed.

## Troubleshooting

### `does not support dynamic client registration`

The server will not register an OAuth client, so it needs a client ID. The registration is missing one — check
`claude mcp get webex-messaging`, and re-run Step 6 with the client ID from the user's Integration.

### `invalid_scope`

The requested scopes are not all present on the Integration. Compare the two directly — the `scope` parameter in the
authorization URL against the scope list at developer.webex.com/my-apps — and fix whichever is wrong.

Do not fix this by editing `oauth.scopes` in `~/.claude.json` mid-session — the OAuth config is read when the server
is registered, so an edit does nothing until a restart. Re-run Step 6 instead (`claude mcp remove webex-messaging` then
`add-json`), which takes effect immediately.

### The redirect fails, or the browser cannot connect

Three things must agree. Check all three rather than guessing:

1. The Redirect URI on the Integration
2. The host in the authorization URL — read it, do not assume. Whichever of `127.0.0.1` or `localhost` the URL uses
   must be registered on the Integration verbatim
3. The port the editor is listening on — re-run the Step 4 bind check, since something may have taken it since

### 403 or `insufficient_scope` from a tool

That tool needs a capability outside the granted set. The server exposes all 24 tools regardless of what was granted,
so this is the narrow grant working, not a broken setup. To widen it, do both, in this order:

1. Add the scope to the Integration at developer.webex.com/my-apps
2. Re-run this wizard from Step 2 so the registered scope set matches

### Tools are missing entirely

Run `claude mcp list`. `Needs authentication` means the client ID was accepted and only the browser sign-in is
outstanding — run `/mcp`. If no `webex-messaging` server is listed at all, Step 6 has not run.

### Message bodies come back empty

Add `spark:kms` to the Integration and to the registered scope set, then re-run Step 6. It is not one of the 9 scopes the server lists as required,
but Webex uses it for end-to-end encrypted content, and without it some message bodies decrypt to nothing.

### Your organization blocks it

Access can be gated by a Webex Control Hub setting. If sign-in succeeds but every call is refused, ask a Webex
administrator to enable MCP access for the organization.

## Changing the disclaimer later

The text lives in `~/.claude/webex-mcp/disclaimer.txt`. Rewrite that file to change the wording, or delete it to stop
appending anything. No restart is needed — the hook reads it on every call.

## Graceful degradation

If `claude mcp add-json` is unavailable in the user's host, fall back to the flag form, which cannot pin scopes:

```bash
claude mcp add --transport http --client-id <CLIENT_ID> --callback-port <PORT> \
  webex-messaging https://mcp.webexapis.com/mcp/webex-messaging
```

The server will then request whatever scope set it advertises, so the Integration must hold all of them or sign-in
fails with `invalid_scope`. Say that plainly rather than leaving the user to discover it. Scopes can be pinned
afterwards in `~/.claude.json` under `mcpServers.webex-messaging.oauth.scopes`, but that needs a restart to take effect.

In a host with no shell at all, present the commands as copyable blocks and wait for confirmation at each step.

## Limitations

- **Creating the Webex Integration cannot be automated.** It needs a human signed in to Webex, so Step 5 is always
  manual.
- **Control Hub enablement is out of reach.** If an administrator has not enabled MCP access for the organization,
  sign-in can succeed while every call is refused, and only an administrator can fix it.
- **This is not zero-config, by design of the upstream server.** Unlike servers that ship a public pre-registered
  OAuth client, Webex requires each user to create their own Integration. The wizard removes the guesswork, not the
  step.
- **The port check is a pre-flight, not a reservation.** Another process can claim the port between the check and
  sign-in.
