# 🀄 Mahjong

<!-- One-line tagline -->

A sandbox Riichi Mahjong app where cheating is allowed.

![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

---

## Table of contents

- [📖 About](#-about)
- [✨ Features](#-features)
- [🧰 Tech stack](#-tech-stack)
- [🚀 Getting started](#-getting-started)
- [📄 Project docs](#-project-docs)
- [🙏 Credits](#-credits)

---

## 📖 About

This is a Riichi Mahjong sandbox app that doesn't enforce any rules. Every tile is freely moveable, and cheating is allowed - if you can get away with it!

Right now, the app is a little more than a sandbox to simulate playing Mahjong, but eventually there will be a multiplayer mode.

🔗 Live app: https://cheatatmahjong.netlify.app/

## ✨ Features

**Current Status**: Tiles can be dragged around the screen, flipped, and rotated. Multiple tiles can be selected and then dragged by holding shift and clicking on the tile or by drawing a box around them.

### 🚧 Near-term

- [x] Multi-select and group drag
- [ ] Build the wall and dead wall automatically
- [ ] Hand zones, with optional auto-deal
- [ ] Seat and round indicators
- [ ] Swap mode
- [ ] Riichi tracking: per-seat flag and riichi stick count

### ⏱️ Stretch / future

- [ ] Scoring via a "win" button
- [ ] Toggleable rule enforcement

## 🧰 Tech stack

| Layer    | Tools                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| Frontend | [Vue 3](https://vuejs.org) + TypeScript, [VueUse](https://vueuse.org)                   |
| Build    | [Vite](https://vite.dev), vue-tsc                                                       |
| Quality  | Prettier                                                                                |
| Tile art | [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) |

## 🚀 Getting started

### 📦 Prerequisites

- Node.js 22.18+ or 24.12+
- npm

### 🔧 Setup

```bash
git clone git@github.com:vanesarobledo/mahjong-test.git
cd mahjong-test

npm install
npm run dev
```

## 📄 Project docs

Specs and design decisions live in [`docs/`](docs):

- [Project summary](docs/mahjong-project-summary.md)
- [Build the wall spec](docs/build-the-wall-spec.md)
- [Multi-select drag plan](docs/multi-select-drag-plan.md)

## 🙏 Credits

Riichi mahjong tile vectors from [riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles).

---

_Built by [Vanesa Robledo](https://github.com/vanesarobledo)._
