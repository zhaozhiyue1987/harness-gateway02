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

```sh
PLUGIN_ROOT="/opt/harness-plugins"
HARNESS_SRC="/opt/harness"
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

The following commands may start from any shell directory. The `npm` commands belong in this plugin directory only, after `cd "$PLUGIN_ROOT/harness-gateway02"`. A Harness source checkout is a pnpm workspace and may not expose a global `dsh` binary; after `cd "$HARNESS_SRC"`, install with the supported CLI entry point:

```sh
cd "$HARNESS_SRC"
pnpm dsh plugin --profile "$PROFILE" add \
  "file:$PLUGIN_ROOT/harness-gateway02/dsh-higress-credential-routes-plugin-0.1.0.tgz"
```
