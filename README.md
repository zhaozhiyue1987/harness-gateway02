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
