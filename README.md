<div align="center">

# Vienna

**Chess analysis on your own computer.**

A Spanish-language Windows desktop app for reviewing games, exploring variations and keeping your analyses locally.

[Download for Windows](https://github.com/MagicNube/Vienna/releases/latest/download/Vienna.exe) · [All releases](https://github.com/MagicNube/Vienna/releases) · [Guía en español](docs/USER_GUIDE.es.md) · [My portfolio](https://jesuscaravaca.web.app/)

![React](https://img.shields.io/badge/React-149eca?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-Rust-292929?style=flat-square&logo=rust)
![Stockfish](https://img.shields.io/badge/Stockfish-19-769656?style=flat-square)
![License](https://img.shields.io/badge/License-GPL--3.0--or--later-535353?style=flat-square)

</div>

## Why I built it

I wanted to review my chess games without a daily analysis limit. Other tools did not fit the interface I wanted, and repeatedly entering my username interrupted the workflow. Vienna keeps the library, engine analysis and exploration together in a local desktop application.

## What you can do

- Import PGN files or download a public Chess.com account's games without providing a password.
- Review games with native Stockfish 19 and configurable analysis times and resource limits.
- Explore nested variations without replacing the original game.
- Navigate evaluations, suggested continuations and move classifications.
- Keep games, completed analyses, settings and statistics in SQLite on your computer.
- Use a separate free-analysis board, opening references and the Vienna/Nogal colour themes.

Move classifications use Vienna's own documented heuristics over engine evaluations. They are not claims of exact agreement with another chess platform.

## Install

1. Download [Vienna.exe](https://github.com/MagicNube/Vienna/releases/latest/download/Vienna.exe) from the public release.
2. Run the Windows x64 installer; it includes Stockfish and the public assets.
3. Import a PGN or choose a public Chess.com username.

The installer is unsigned, so Windows may display a SmartScreen notice. **Windows x64 is the verified packaged platform.** Builds for other platforms are not verified releases.

PGN import and analysis work offline after installation. Downloading Chess.com games and sending optional feedback require Internet access. The app does not impose a daily analysis quota; your computer's CPU, memory and available time determine the practical limits.

## Architecture

```text
React / TypeScript / Chessground / chess.js
                    ↓ Tauri commands
                 Rust backend
        ┌───────────┴───────────┐
  Native Stockfish / UCI     SQLite
```

Rust coordinates the native engine and database. Interactive analysis and game review use separate channels. Saved analyses can be reused, cancelled work is isolated, and stale results cannot overwrite the position currently being viewed.

The browser development bridge uses the same Rust backend over loopback. Publishing `dist/` alone does not produce a standalone web version of Vienna.

## Develop locally

Install Node.js 24+, stable Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Windows builds need Microsoft C++ Build Tools and WebView2.

```sh
git clone https://github.com/MagicNube/Vienna.git
cd Vienna
npm ci
npm run engine:install
npm run desktop
```

`engine:install` downloads the official Stockfish 19 package and verifies the published SHA-256. Its source and license are retained with the engine resources.

<details>
<summary>Browser development and checks</summary>

Build the Rust bridge before using the browser development server:

```sh
npm run bridge:build
npm run dev
```

```sh
npm test
npm run test:native
npm run test:integration
npm run build:public
npm run package
```

Integration tests require the real installed engine. `package` creates the public installer; personal audio and user databases are excluded.

</details>

## Documentation

- [Guía completa de uso y comportamiento, en español](docs/USER_GUIDE.es.md)
- [Public export and build process](docs/PUBLISHING.md)
- [Distribution status and requirements](docs/DISTRIBUTION.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License and credits

Vienna is **GPL-3.0-or-later**; see [LICENSE](LICENSE). Stockfish, Chessground, chess.js, the Cburnett pieces, fonts and CC0 sounds are credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Public builds use the included open sound assets.

Feedback is available from **Ajustes → Ayuda**. You can also [support development](https://buymeacoffee.com/magicnube).
