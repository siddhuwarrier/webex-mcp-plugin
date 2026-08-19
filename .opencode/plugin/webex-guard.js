// OpenCode plugin: Webex Messaging guard + AI disclaimer.
//
// This is the OpenCode equivalent of the Claude Code / Codex PreToolUse hook in
// plugins/webex/hooks/webex-guard.js. OpenCode plugins hook into events rather
// than matching a hooks.json, so this uses `tool.execute.before` to inspect and
// (where needed) rewrite the arguments before a Webex tool runs.
//
// Install: copy this file to one of
//   - ~/.config/opencode/plugin/webex-guard.js   (global)
//   - .opencode/plugin/webex-guard.js            (project)
// OpenCode loads every JS/TS file in those directories at startup.
//
// It catches three calls that return success but produce the wrong outcome:
//
//   1. An HTML-escaped mention (&lt;@personId:...&gt;) renders as literal text and
//      notifies nobody. Refused, with instructions to use literal angle brackets.
//   2. webex-create-message called with a parentId is a thread reply sent through
//      the wrong tool: it posts a new top-level message and fragments the thread.
//      Refused, with a redirect to webex-create-thread-reply.
//   3. webex-search-spaces without `max` paginates every space in the org, which
//      on a large org looks like a hang. A default bound of 20 is injected.
//
// It also appends the AI disclaimer, if one is configured, to outgoing messages.
// The text lives in disclaimer.txt under the OpenCode config directory, written by
// the setup skill. Absent or empty means no disclaimer.
//
// Fail-open by design: any unexpected input is left alone, which allows the call.
// A guard that blocks messages when something is broken would be worse than none.

import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const ESCAPED_MENTION_MSG =
  "This mention is HTML-escaped (&lt;@personId:...&gt;), so Webex would render it as literal text and " +
  "notify nobody. Resend using literal angle brackets: <@personId:VALUE>. Confirm it worked by checking " +
  "that the response contains a mentionedPeople array — if that field is absent, no mention was delivered."

const WRONG_THREAD_TOOL_MSG =
  "webex-create-message ignores parentId, so this would post a new top-level message instead of a thread " +
  "reply. Use webex-create-thread-reply with the same roomId and parentId. Make sure parentId is the thread " +
  "root (the first message in the thread), not the most recent reply."

// Matches &lt; &#60; &#x3c; forms before an @personId:/@personEmail: mention.
const ESCAPED_MENTION_RE = /&(?:lt|#0*60|#x0*3c);@(?:personId|personEmail):/i

// Reads the disclaimer text, or "" when none is configured.
// Honours OPENCODE_CONFIG dir if set, otherwise ~/.config/opencode.
function disclaimerText() {
  const candidates = []
  if (process.env.OPENCODE_CONFIG) {
    candidates.push(path.join(path.dirname(process.env.OPENCODE_CONFIG), "webex-mcp", "disclaimer.txt"))
  }
  candidates.push(path.join(os.homedir(), ".config", "opencode", "webex-mcp", "disclaimer.txt"))
  for (const file of candidates) {
    try {
      const text = fs.readFileSync(file, "utf8").trim()
      if (text) return text
    } catch {
      // Missing or unreadable: try the next one.
    }
  }
  return ""
}

function bodyOf(args) {
  return ["markdown", "text", "html"]
    .map((k) => args[k])
    .filter((v) => typeof v === "string")
    .join("\n")
}

// Appends the configured disclaimer in italics on its own line. Idempotent.
function appendDisclaimer(args) {
  const text = disclaimerText()
  if (!text) return
  const field =
    typeof args.markdown === "string" && args.markdown !== ""
      ? "markdown"
      : typeof args.text === "string" && args.text !== ""
        ? "text"
        : null
  if (!field) return // Attachment-only message: nothing to append to.
  const body = args[field]
  if (body.includes(text)) return // Already present.
  const suffix = field === "markdown" ? `_${text}_` : text
  args[field] = `${body}\n\n${suffix}`
}

// Match the bare tool name, so this works regardless of the MCP prefix OpenCode
// applies (server tools are exposed as <server>_<tool> or mcp__<server>__<tool>).
function bareName(tool) {
  if (typeof tool !== "string") return ""
  if (tool.includes("__")) return tool.split("__").pop() || ""
  const idx = tool.lastIndexOf("webex-")
  return idx >= 0 ? tool.slice(idx) : tool
}

export const WebexGuard = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const name = bareName(input?.tool)
      if (!name.startsWith("webex-")) return
      const args = output?.args
      if (!args || typeof args !== "object") return

      if (name === "webex-search-spaces") {
        if (args.max === undefined || args.max === null || args.max === "") {
          args.max = 20
        }
        return
      }

      if (name === "webex-create-message") {
        if (args.parentId !== undefined && args.parentId !== null && args.parentId !== "") {
          throw new Error(WRONG_THREAD_TOOL_MSG)
        }
        if (ESCAPED_MENTION_RE.test(bodyOf(args))) throw new Error(ESCAPED_MENTION_MSG)
        appendDisclaimer(args)
        return
      }

      if (name === "webex-create-thread-reply") {
        if (ESCAPED_MENTION_RE.test(bodyOf(args))) throw new Error(ESCAPED_MENTION_MSG)
        appendDisclaimer(args)
        return
      }

      if (name === "webex-edit-message") {
        // Guard edits, but do not append: the original already carries the disclaimer.
        if (ESCAPED_MENTION_RE.test(bodyOf(args))) throw new Error(ESCAPED_MENTION_MSG)
      }
    },
  }
}
