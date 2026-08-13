#!/usr/bin/env node
// PreToolUse guard for the Webex Messaging MCP server.
//
// It also appends the AI disclaimer, if one is configured, to outgoing messages.
// The text lives in disclaimer.txt inside the plugin's data directory, written by
// the setup wizard. Absent or empty means no disclaimer.
//
// Catches three calls that return success but produce the wrong outcome:
//
//   1. An HTML-escaped mention (&lt;@personId:...&gt;) renders as literal text and
//      notifies nobody. Denied, with instructions to use literal angle brackets.
//   2. webex-create-message called with a parentId is a thread reply sent through
//      the wrong tool: it posts a new top-level message and fragments the thread.
//      Denied, with a redirect to webex-create-thread-reply.
//   3. webex-search-spaces without `max` paginates every space in the org, which
//      on a large org looks like a hang. A default bound is injected.
//
// Written in dependency-free Node rather than shell so it behaves identically on
// Windows, macOS and Linux — no bash, no jq.
//
// Fail-open by design: any unexpected input exits 0 with no output, which allows
// the call. A guard that blocks messages when something about it is broken would
// be worse than no guard.

'use strict';

const ESCAPED_MENTION_MSG =
  'This mention is HTML-escaped (&lt;@personId:...&gt;), so Webex would render it as literal text and ' +
  'notify nobody. Resend using literal angle brackets: <@personId:VALUE>. Confirm it worked by checking ' +
  'that the response contains a mentionedPeople array — if that field is absent, no mention was delivered.';

const WRONG_THREAD_TOOL_MSG =
  'webex-create-message ignores parentId, so this would post a new top-level message instead of a thread ' +
  'reply. Use webex-create-thread-reply with the same roomId and parentId. Make sure parentId is the thread ' +
  'root (the first message in the thread), not the most recent reply — when reading a space, replies carry a ' +
  'parentId pointing at that root.';

// Matches &lt; &#60; &#x3c; forms before an @personId:/@personEmail: mention.
const ESCAPED_MENTION_RE = /&(?:lt|#0*60|#x0*3c);@(?:personId|personEmail):/i;

function emit(payload) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: Object.assign({ hookEventName: 'PreToolUse' }, payload),
  }));
}

function deny(reason) {
  emit({ permissionDecision: 'deny', permissionDecisionReason: reason });
}

function bodyOf(toolInput) {
  return ['markdown', 'text', 'html']
    .map((k) => toolInput[k])
    .filter((v) => typeof v === 'string')
    .join('\n');
}

function main(raw) {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return; // Unparseable input: allow.
  }

  const tool = typeof event.tool_name === 'string' ? event.tool_name : '';
  const input = event.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};

  // Match the tool's bare name, so this works whether the server was registered
  // by this plugin (mcp__plugin_<plugin>_<server>__<tool>) or by hand.
  const name = tool.split('__').pop() || '';

  if (name === 'webex-search-spaces') {
    if (input.max === undefined || input.max === null || input.max === '') {
      emit({ updatedInput: { max: 20 } });
    }
    return;
  }

  if (name === 'webex-create-message') {
    if (input.parentId !== undefined && input.parentId !== null && input.parentId !== '') {
      return deny(WRONG_THREAD_TOOL_MSG);
    }
    if (ESCAPED_MENTION_RE.test(bodyOf(input))) return deny(ESCAPED_MENTION_MSG);
    return appendDisclaimer(input);
  }

  if (name === 'webex-create-thread-reply') {
    if (ESCAPED_MENTION_RE.test(bodyOf(input))) return deny(ESCAPED_MENTION_MSG);
    return appendDisclaimer(input);
  }

  if (name === 'webex-edit-message') {
    // Guard edits, but do not append: the original already carries the disclaimer.
    if (ESCAPED_MENTION_RE.test(bodyOf(input))) return deny(ESCAPED_MENTION_MSG);
  }
}

// Reads the disclaimer text, or '' when none is configured.
function disclaimerText() {
  const dir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dir) return '';
  try {
    return require('node:fs').readFileSync(require('node:path').join(dir, 'disclaimer.txt'), 'utf8').trim();
  } catch {
    return ''; // Not configured, or unreadable.
  }
}

// Appends the configured disclaimer in italics on its own line. Idempotent, so a
// retry or a body that already carries it is left alone.
function appendDisclaimer(input) {
  const text = disclaimerText();
  if (!text) return; // Disabled.

  // Prefer markdown, since that is what Webex renders when both are present.
  const field = typeof input.markdown === 'string' && input.markdown !== ''
    ? 'markdown'
    : (typeof input.text === 'string' && input.text !== '' ? 'text' : null);
  if (!field) return; // Attachment-only message: nothing to append to.

  const body = input[field];
  if (body.includes(text)) return; // Already present.

  const suffix = field === 'markdown' ? `_${text}_` : text;
  emit({ updatedInput: { [field]: `${body}\n\n${suffix}` } });
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    if (raw.trim()) main(raw);
  } catch {
    // Never block on an internal error.
  }
  process.exit(0);
});
process.stdin.on('error', () => process.exit(0));
