# How to Contribute

Thanks for your interest in contributing to this project! Here are a few general guidelines on contributing and
reporting bugs that we ask you to review. Following these guidelines helps to communicate that you respect the time of
the contributors managing and developing this open source project. In return, they should reciprocate that respect in
addressing your issue, assessing changes, and helping you finalize your pull requests. In that spirit of mutual respect,
we endeavor to review incoming issues and pull requests within 10 days, and will close any lingering issues or pull
requests after 60 days of inactivity.

Please note that all of your interactions in the project are subject to our [Code of Conduct](/CODE_OF_CONDUCT.md). This
includes creation of issues or pull requests, commenting on issues or pull requests, and extends to all interactions in
any real-time space e.g., Webex, Slack, Discord, etc.

## Table Of Contents

- [Reporting Issues](#reporting-issues)
- [Sending Pull Requests](#sending-pull-requests)
- [Contributing to the Claude Code plugin](#contributing-to-the-claude-code-plugin)
- [Other Ways to Contribute](#other-ways-to-contribute)

## Reporting Issues

Before reporting a new issue, please ensure that the issue was not already reported or fixed by searching through our
[issues list](https://github.com/CiscoDevNet/webex-mcp-official/issues).

When creating a new issue, please be sure to include a **title and clear description**, as much relevant information as
possible, and, if possible, a reproduction case.

Note that this repository covers the documentation and the Claude Code plugin for the Webex MCP servers. It is not the
place to report bugs in the hosted MCP servers themselves or in the underlying Webex APIs — for those, use
[Webex Developer Support](https://developer.webex.com/support).

**If you discover a security bug, please do not report it through GitHub. Instead, please see security procedures in
[SECURITY.md](/SECURITY.md).**

## Sending Pull Requests

Before sending a new pull request, take a look at existing pull requests and issues to see if the proposed change or fix
has been discussed in the past, or if the change was already implemented but not yet released.

As we follow semantic versioning, we may reserve breaking changes until the next major version release.

## Contributing to the Claude Code plugin

The plugin lives in [`plugins/webex/`](/plugins/webex) and is published through the marketplace manifest at
[`.claude-plugin/marketplace.json`](/.claude-plugin/marketplace.json).

Before opening a pull request that touches the plugin:

1. **Validate the manifests.** Run `claude plugin validate ./plugins/webex` and confirm it reports no errors.
2. **Test a real install.** Run `/plugin marketplace add <your-fork>` followed by `/plugin install webex@webex-mcp-official`,
   then run the wizard end to end and complete the OAuth flow against a Webex Integration you control. Check that
   installing prompts you for nothing.
3. **Bump `version`** in `plugins/webex/.claude-plugin/plugin.json` using semantic versioning. Users are pinned to
   this string and only receive updates when it changes. Bump `.codex-plugin/plugin.json` to match — the two
   manifests are separate files and drift silently.

**Do not add `userConfig` to the manifest.** Declaring any user configuration makes the host open its own
configuration dialog when the plugin is enabled, which pre-empts the wizard: the user is asked for a Webex client ID
before anything has told them how to obtain one, in a flat form that cannot offer a scope checklist. That is why this
plugin ships no MCP server definition either — per-user values are gathered by the wizard and applied with
`claude mcp add-json`, and the disclaimer lives in `~/.claude/webex-mcp/disclaimer.txt`.

The plugin targets two agents from one tree, with a marketplace manifest for each:

| Agent | Marketplace manifest | Plugin manifest | Hook config | Ships |
| --- | --- | --- | --- | --- |
| Claude Code | `.claude-plugin/marketplace.json` | `.claude-plugin/plugin.json` | `hooks/hooks.json` (exec form, `${CLAUDE_PLUGIN_ROOT}`) | Skill, guard hook, disclaimer |
| Codex | `.agents/plugins/marketplace.json` | `.codex-plugin/plugin.json` | `hooks.json` at plugin root (relative command) | Skill, guard hook |

Both hook configs invoke the same `hooks/webex-guard.js`. They are separate files because the two agents differ in
where the config lives and how the command is resolved: Claude Code uses `hooks/hooks.json` with exec-form `args` and
`${CLAUDE_PLUGIN_ROOT}`, while Codex auto-discovers `hooks.json` at the plugin root and resolves relative paths from
there. `${CLAUDE_PLUGIN_ROOT}` does not exist in Codex. **Change one, change the other.**

Neither manifest defines an MCP server; the wizard registers it. On Codex the server is registered through Codex's
own MCP configuration instead of `claude mcp add-json`.

Two Codex-specific caveats, both untested against a live Codex install:

- The disclaimer is untested there. The guard looks in `$CLAUDE_PLUGIN_DATA/disclaimer.txt` first and then falls back
  to `~/.claude/webex-mcp/disclaimer.txt`, so it would work if a Codex user wrote that file, but the wizard does not
  offer the step. The three correctness rules apply regardless.

The two-location lookup is deliberate. `CLAUDE_PLUGIN_DATA` is exported to hook processes but **not** to the agent's
own shell, so whatever writes the file cannot expand it — and the documented sanitisation of the plugin id into a
directory name is not something to reconstruct by hand. The wizard writes the fixed `~/.claude/webex-mcp` path; the
data directory is still honoured first for anyone who prefers it.
- The guard emits `updatedInput` without `permissionDecision`. Codex's documented modify form pairs `updatedInput`
  with `permissionDecision: "allow"`, but setting `allow` in Claude Code would auto-approve the call and suppress
  the user's confirmation prompt — unacceptable for a tool that posts messages. If Codex turns out to ignore a bare
  `updatedInput`, fix it by emitting `allow` **only** for `webex-search-spaces`, which is read-only.

If you change the guard hook in [`hooks/`](/plugins/webex/hooks), exercise it directly rather than
only through a live session — it takes the `PreToolUse` payload on stdin:

```bash
printf '%s' '{"tool_name":"mcp__webex-messaging__webex-create-message",
              "tool_input":{"roomId":"R1","markdown":"hi &lt;@personId:ABC&gt;"}}' \
  | node ./plugins/webex/hooks/webex-guard.js
```

Cover both outcomes for each rule — the call it should refuse, and a legitimate call it must leave alone. Include
at least one message body that merely *mentions* `max` or `parentId` as prose, to confirm the guard is parsing
JSON rather than pattern-matching the raw payload.

Two properties to preserve:

- **Dependency-free Node, not shell.** Native Windows has neither `bash` nor `jq`, so a shell implementation would
  silently not run for a whole platform.
- **Fail-open.** Unexpected payload, missing `node`, or an internal error must exit 0 and allow the call. A guard
  that blocks messages when something about itself is broken is worse than no guard.

Two constraints are worth knowing before you change the OAuth configuration:

- **Keep the default callback port stable.** Users register `http://127.0.0.1:<port>/callback` as the redirect URI in
  their own Webex Integration. Changing the default the wizard suggests means existing users who re-run it silently
  register a mismatched URI. Treat it as a breaking change.
- **Widen the default capability set only when a tool needs it.** It is deliberately narrower than the nine scopes the
  server advertises, so that a default setup cannot grant space deletion or membership changes. If you add a scope to
  the checklist, say which tool requires it in the pull request description.

## Other Ways to Contribute

We welcome anyone that wants to contribute to this project to triage and reply to open issues to help troubleshoot
and fix existing bugs. Here is what you can do:

- Help ensure that existing issues follow the recommendations from the _[Reporting Issues](#reporting-issues)_ section,
  providing feedback to the issue's author on what might be missing.
- Review existing pull requests, and test changes against a real Webex organization.
- Improve the troubleshooting documentation when you hit a setup failure that isn't covered yet.

Thanks again for your interest in contributing!

:heart:
