---
name: extensions-viewer
description: Open a read-only local web page that lists installed skills, MCP servers and plugins.
disable-model-invocation: true
---

Local viewer URL (read-only, 127.0.0.1 only, valid while the server runs):

!`node "${CLAUDE_SKILL_DIR}/dist/src/launcher.js"`

Reply with only the URL above, on one line. If the output is an error message instead, show that message as is.
