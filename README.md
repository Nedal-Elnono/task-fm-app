# TASK FM

A lightweight, elegant checklist app that lives in your macOS menu bar. Fast, focused, and distraction-free.

## Features

- Lives in your menu bar — always one click away
- Sound packs for task events (create, complete, delete)
- Minimal UI with smooth animations
- Persistent storage between sessions
- Supports Apple Silicon and Intel Macs (universal binary)

## Tech Stack

- [Tauri v2](https://tauri.app/) — Rust-powered native shell
- [React 19](https://react.dev/) + TypeScript
- [Vite](https://vitejs.dev/) — frontend build tool
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [Framer Motion](https://www.framer.com/motion/) — animations

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- Xcode Command Line Tools (macOS)

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run tauri dev
```

### Build for production (universal macOS)

```bash
npm run tauri build -- --target universal-apple-darwin
```

The `.app` and `.dmg` will be output to:
```
src-tauri/target/universal-apple-darwin/release/bundle/
```

## Requirements

- macOS 12.0 (Monterey) or later
- Apple Silicon or Intel Mac
