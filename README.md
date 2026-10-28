<div align="center">

# 🔍 extensions-viewer

**See every skill, MCP server and plugin of Claude Code on one page.**

Type `/extensions-viewer`. Get a local URL. Done.

[![CI](https://github.com/euiseok00/extensions-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/euiseok00/extensions-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933.svg)](https://nodejs.org)
![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen.svg)
![Read-only](https://img.shields.io/badge/mode-read--only-informational.svg)

</div>

---

Claude Code keeps these in different places: `/mcp`, `/plugin`, folders on disk. **extensions-viewer** puts all three side by side, with scope, enabled state and search, in a page that only your own machine can open.

> [!NOTE]
> Unofficial project. Not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

## ✨ Features

| | |
|---|---|
| 🧩 **Three tabs, one view** | Plugins, MCP servers and skills with counts and live search |
| 🎯 **Scope aware** | `user`, `project`, `local` and `plugin` scopes, plus enabled state from your settings |
| 🛡️ **Secrets masked** | MCP `env` and `headers` show key names only, never values |
| 🔒 **Locked down** | `127.0.0.1` only, random port, token and Host checks on every request |
| 🪶 **Zero dependencies** | Node built-ins only. Nothing to audit but this repo |
| 🙈 **Read-only** | Never writes to your Claude Code settings |

## 🚀 Quick start

```sh
git clone https://github.com/euiseok00/extensions-viewer.git
cd extensions-viewer
npm ci
npm run bundle -- ~/.claude/skills/extensions-viewer
```

Then, in Claude Code:

```
/extensions-viewer
```

It prints one URL. Open it. Run the command again and the running server is reused.

<details>
<summary>Windows and other install paths</summary>

<br>

On Windows pass the full path, for example:

```sh
npm run bundle -- C:\Users\<you>\.claude\skills\extensions-viewer
```

Without an argument, `npm run bundle` writes to `.claude/skills/extensions-viewer` inside the repository, which makes the command available in that project only.

Requires Node.js 22 or newer and Claude Code.

</details>

## 🔐 Security model

The page can show your MCP configuration, which often holds API keys. So the server is built to leak nothing, even to other programs on the same machine.

```
 browser ──► 127.0.0.1:<random port> ──► Host ok? ──► token ok? ──► collectors ──► mask ──► JSON
                                           │             │
                                           └── 403 ◄─────┘   (no token, wrong token, foreign Host)
```

- **Token:** 32 random bytes per run, compared in constant time, swapped for an `HttpOnly`, `SameSite=Strict` cookie on first visit.
- **Host check:** blocks DNS-rebinding attacks.
- **Headers:** `Content-Security-Policy: default-src 'self'`, `Cache-Control: no-store`, no CORS.
- **Masking:** token-like `args`, URL credentials and URL query values become `***`.
- **UI:** plugin and skill text is untrusted, so the page uses `textContent` only and never `innerHTML`.
- **Lifetime:** the server exits after 10 idle minutes.

Full threat table: [docs/04-security.md](docs/04-security.md).

## 🧭 How it works

```
/extensions-viewer
      │
      ▼
  launcher ── server already running for this project? ── yes ──► print URL
      │                                                   
      no
      ▼
  start detached server ──► collectors (plugins · MCP · skills, in parallel) ──► mask ──► UI
```

One collector failing does not hide the others. The failed tab shows the reason.

## ⚠️ Known limitations

<details>
<summary>Read before you rely on it</summary>

<br>

- The page reflects **config files**, not what is loaded in your current session.
- MCP enabled state is not shown yet.
- Plugins are read from `installed_plugins.json` and `enabledPlugins`, not from `claude plugin list`.
- In testing, Claude Code did not run the skill's `!` command itself. Claude ran the same command through Bash instead, so the result can depend on your Bash permissions. The cause is not yet known.
- Secrets with no known prefix and no secret-like name, such as a random string in `args`, are not detected.

More open questions: [docs/05-roadmap.md](docs/05-roadmap.md).

</details>

## 🛠️ Development

```sh
npm ci
npm test         # type-check, build, run tests
npm run collect  # print collected data as JSON
```

CI runs on Ubuntu, macOS and Windows with Node 22 and 24. Design docs live in [`docs/`](docs/).

## 📄 License

[MIT](LICENSE) © 2026 Joung Euisoek
