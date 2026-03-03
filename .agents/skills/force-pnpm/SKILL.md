---
name: force-pnpm
description: Force the use of pnpm as the package manager for this project.
---

# Instructions

When working inside this repository or project, you MUST use `pnpm` instead of `npm`, `yarn`, or `bun`.

## Key Commands
- **Install dependencies:** `pnpm install` or `pnpm i`
- **Add a dependency:** `pnpm add <package-name>`
- **Add a dev dependency:** `pnpm add -D <package-name>`
- **Run scripts:** `pnpm run <script-name>` (e.g., `pnpm run dev`)
- **Execute binaries:** `pnpm dlx <package>` or `pnpm exec <command>`

## Rules
1. **Never** use `npm install`, `npm run`, `yarn add`, or `yarn`.
2. Do not modify `package-lock.json` or `yarn.lock` if they exist; rely purely on `pnpm-lock.yaml`.
3. If a tool suggests running an `npm` command, automatically translate it to the equivalent `pnpm` command.
4. When bootstrapping new tools or frameworks that ask for a package manager, explicitly select `pnpm`.
