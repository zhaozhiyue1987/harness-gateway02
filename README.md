# AsiaInfo AIGW credential routes Harness plugin

This is a new standalone plugin project. It does not replace the existing `dsh-higress-ai-route-plugin` package.

For any native Harness source checkout, use
[`scripts/install-native-harness.sh`](./scripts/install-native-harness.sh) to build
and install this bundle into an existing profile through the supported `dsh plugin`
CLI.

It supports multiple BEARER credential connections in one Harness profile. Every connection discovers all routes authorized for its credential and owns isolated Providers identified by `connectionId + gatewayInstanceId + routeId`.

## Clone and install

Clone this repository into a directory you control, then run the installer against
an existing Harness source checkout. The `PROFILE` must already exist.

### Understand the two directories first

The installation uses two different directories. Do not set them to the same path:

| Name | Meaning | Expected contents | Example |
| --- | --- | --- | --- |
| Plugin directory | The `harness-gateway02` directory cloned from this GitHub repository; run `npm` commands here | `package.json`, `scripts/`, `src/` | `/Users/your-name/harness-plugins/harness-gateway02` |
| Harness source directory | The root of your Harness source checkout; run `pnpm dsh` here | `package.json`, `apps/cli/src/bin.ts`, `apps/` | `/Users/your-name/harness` |

The directories should be siblings, not nested inside one another:

```text
/Users/your-name/
├── harness-plugins/
│   └── harness-gateway02/   # plugin directory: npm ci/build/pack
└── harness/                 # Harness source directory: pnpm dsh plugin ... add
```

`PROFILE` is a profile name such as `web`, not a directory path. It must already exist in Harness.

```sh
PLUGIN_ROOT="$HOME/harness-plugins"
HARNESS_SRC="$HOME/harness"
PROFILE="<existing-profile>"

mkdir -p "$PLUGIN_ROOT"
git clone https://github.com/zhaozhiyue1987/harness-gateway02.git \
  "$PLUGIN_ROOT/harness-gateway02"
cd "$PLUGIN_ROOT/harness-gateway02"
HARNESS_SRC="$HARNESS_SRC" PROFILE="$PROFILE" \
  ./scripts/install-native-harness.sh
```

The script runs the locked dependency checks, build, tests, packaging, and native
Harness CLI installation. Restart the Harness Web process for the selected profile
after installation. Console URLs and credentials are configured in the plugin UI.

For a beginner-friendly manual installation, follow these steps in order. You may start in any shell directory, but the `npm` commands must run in the plugin checkout and the `pnpm dsh` command must run in the Harness source checkout.

1. Set real paths and an existing profile:

   ```sh
   PLUGIN_ROOT="$HOME/harness-plugins"
   HARNESS_SRC="$HOME/harness"
   PROFILE="web"
   ```

2. Confirm the Harness checkout:

   ```sh
   test -f "$HARNESS_SRC/package.json" && \
   test -f "$HARNESS_SRC/apps/cli/src/bin.ts" && \
   echo "Harness source checkout: $HARNESS_SRC"
   ```

3. Clone the plugin and enter its directory:

   ```sh
   mkdir -p "$PLUGIN_ROOT"
   git clone https://github.com/zhaozhiyue1987/harness-gateway02.git \
     "$PLUGIN_ROOT/harness-gateway02"
   cd "$PLUGIN_ROOT/harness-gateway02"
   pwd
   ```

   The final `pwd` must end in `harness-gateway02`.

4. Stay in the plugin directory and build the package:

   ```sh
   npm ci
   npm run typecheck
   npm run build
   npm test
   npm pack
   ls -lh dsh-higress-credential-routes-plugin-0.1.0.tgz
   ```

5. Change to the Harness source directory. Do not run the next command from the
   plugin directory:

   ```sh
   cd "$HARNESS_SRC"
   pwd
   ```

   The final `pwd` must show the Harness checkout path. Then install the tarball:

   If `cd "$HARNESS_SRC"` reports `no such file or directory`, the variable
   still points to an example or old path. A failed `cd` leaves the shell in the
   plugin directory, so `pwd` will still end in `harness-gateway02`; do not run
   `pnpm dsh` there. Locate the Harness CLI source first:

   ```sh
   find "$HOME" -path "*/apps/cli/src/bin.ts" -print 2>/dev/null
   ```

   If the result is `/Users/your-user/project/harness/apps/cli/src/bin.ts`, set
   the parent directory and verify it:

   ```sh
   export HARNESS_SRC="$HOME/project/harness"
   cd "$HARNESS_SRC"
   pwd
   test -f package.json && test -f apps/cli/src/bin.ts && \
     echo "Harness source checkout: $HARNESS_SRC"
   ```

   Run `pnpm dsh plugin ... add` only after `pwd` shows the Harness source root.

### Windows WSL2

The command order is the same as macOS, but run every command in the WSL Ubuntu
terminal, not PowerShell. Keep both checkouts in the WSL Linux filesystem (for
example under `$HOME`), not under `/mnt/c` or another Windows-mounted path.
From the WSL terminal, verify Node.js `>=22.19.0`, then enable Corepack when
needed:

```sh
uname -srm
node --version
npm --version
corepack enable
pnpm --version
```

Run `pnpm install --frozen-lockfile` once in the Harness source root before the
first `pnpm dsh` command. The plugin still uses `npm ci`, build, test and pack
in its own checkout. WSL may not run systemd; if the installer cannot restart
`dsh-harness`, restart Harness Web using its existing WSL launch command before
opening the Web UI from Windows.

```sh
pnpm dsh plugin --profile "$PROFILE" add \
  "file:$PLUGIN_ROOT/harness-gateway02/dsh-higress-credential-routes-plugin-0.1.0.tgz"
```

6. Restart Harness Web, then open **Settings → Plugins** and confirm that
   **AsiaInfo AIGW credential routes** is loaded.

If the one-command installer is preferred, run it from the plugin directory
after steps 1–3:

```sh
HARNESS_SRC="$HARNESS_SRC" PROFILE="$PROFILE" \
  ./scripts/install-native-harness.sh
```
