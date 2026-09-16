# contributing to nexterm

thanks for wanting to help. this page is short on purpose: how to get it running, how we write commits, and what a pull request needs before it can merge.

## getting set up

you need node 22, rust stable and the [tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your os. on debian or ubuntu that's:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libudev-dev pkg-config
```

then:

```bash
git clone https://github.com/k6w/nexterm-terminal-app.git
cd nexterm-terminal-app
npm ci
npm run tauri dev
```

the first `tauri dev` compiles the rust side and takes a while. after that, front end changes reload on save and rust changes rebuild the app.

## branches

- `master` is always releasable. don't commit to it directly.
- work on a branch named after what it does: `feat/ssh-config`, `fix/tab-drag`, `docs/readme`, `chore/lint`.
- keep a branch to one thing. two unrelated fixes are two pull requests.

## commits

we use conventional commits with a scope, written in lowercase and in plain words:

```
feat(ssh): import hosts from ~/.ssh/config
fix(terminal): pane controls hide on pointer leave
perf(ui): lazy-load the sftp and database panels
refactor(ui): one icon registry
test: resolve the src dir so the title guard runs on windows
docs: rewrite readme
chore(lint): report stale disable directives
```

- types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`
- scopes are the area you touched: `terminal`, `ssh`, `sftp`, `git`, `database`, `palette`, `settings`, `theme`, `ui`, `pty`, `build` and so on
- the subject says what changes for the user, not which file you edited
- add a body when the why isn't obvious

## the checks

ci runs these on macos, windows and linux. run them locally before you push:

```bash
npm run lint        # eslint plus the lint ratchet
npm run typecheck
npm test

cd src-tauri
cargo clippy -- -D warnings
cargo test
```

### the lint ratchet

every eslint rule is an error. violations that existed when eslint was introduced are recorded in `eslint-suppressions.json`, and that file is only allowed to shrink:

- a file can't gain new violations
- when you fix a suppressed violation, run `npx eslint . --prune-suppressions` and commit the smaller file
- files listed in `STRICT_PATHS` in `scripts/check-lint-ratchet.mjs` must have no suppressions at all. when you move a file onto the design kit, add it to that list. never remove an entry
- no inline styles or color literals in components. use the design tokens and the kit in `src/ui`

### tests

new behavior comes with a test, and a bug fix comes with a test that fails without it. front end tests sit next to the code as `*.test.ts(x)` and run with vitest. rust tests live in the module or in a `tests.rs` beside it. if something truly can't be tested, say why in the pull request.

## pull requests

- fill in the template. a screenshot or short clip helps a lot for anything visual
- check light and dark themes if you touched the ui
- keep the diff focused. a refactor that a feature needs can go in the same pr, unrelated cleanup can't
- ci has to be green before merge

## reporting bugs and ideas

use the issue templates. for bugs, the version, your os and the steps to reproduce matter most. please don't paste hostnames, keys or passwords into issues.
