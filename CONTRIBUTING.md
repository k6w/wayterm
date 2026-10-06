# Contributing to Nexterm

Thanks for wanting to help. This page is short on purpose: how to get the app running, how we write commits, and what a pull request needs before it can merge.

## Getting set up

You need Node.js 22, Rust stable and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS. On Debian or Ubuntu that's:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libudev-dev pkg-config
```

Then:

```bash
git clone https://github.com/k6w/nexterm-terminal-app.git
cd nexterm-terminal-app
npm ci
npm run tauri dev
```

The first `tauri dev` compiles the Rust side and takes a while. After that, front-end changes reload on save and Rust changes rebuild the app.

## Branches

- `master` is always releasable. Don't commit to it directly.
- Work on a branch named after what it does: `feat/ssh-config`, `fix/tab-drag`, `docs/readme`, `chore/lint`.
- Keep a branch to one thing. Two unrelated fixes are two pull requests.

## Commits

We use Conventional Commits with a scope. Commit messages stay lowercase and use plain words:

```
feat(ssh): import hosts from ~/.ssh/config
fix(terminal): pane controls hide on pointer leave
perf(ui): lazy-load the sftp and database panels
refactor(ui): one icon registry
test: resolve the src dir so the title guard runs on windows
docs: rewrite readme
chore(lint): report stale disable directives
```

- Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`.
- Scopes are the area you touched: `terminal`, `ssh`, `sftp`, `git`, `database`, `palette`, `settings`, `theme`, `ui`, `pty`, `build` and so on.
- The subject says what changes for the user, not which file you edited.
- Add a body when the reason isn't obvious.

## Checks

CI runs these on macOS, Windows and Linux. Run them locally before you push:

```bash
npm run lint        # ESLint plus the lint ratchet
npm run typecheck
npm test

cd src-tauri
cargo clippy -- -D warnings
cargo test
```

### The lint ratchet

Every ESLint rule is an error. Violations that existed when ESLint was introduced are recorded in `eslint-suppressions.json`, and that file is only allowed to shrink:

- A file can't gain new violations.
- When you fix a suppressed violation, run `npx eslint . --prune-suppressions` and commit the smaller file.
- Files listed in `STRICT_PATHS` in `scripts/check-lint-ratchet.mjs` must have no suppressions at all. When you move a file onto the design kit, add it to that list. Never remove an entry.
- No inline styles or color literals in components. Use the design tokens and the kit in `src/ui`.

### Tests

New behavior comes with a test, and a bug fix comes with a test that fails without it. Front-end tests sit next to the code as `*.test.ts(x)` and run with Vitest. Rust tests live in the module or in a `tests.rs` beside it. If something truly can't be tested, say why in the pull request.

## Pull requests

- Fill in the template. A screenshot or short clip helps a lot for anything visual.
- Check light and dark themes if you touched the UI.
- Keep the diff focused. A refactor that a feature needs can go in the same pull request; unrelated cleanup can't.
- CI has to be green before merge.

## Reporting bugs and ideas

Use the issue templates. For bugs, the version, your OS and the steps to reproduce matter most. Please don't paste hostnames, keys or passwords into issues.
