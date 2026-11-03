# AsiaInfo AIGW credential routes Harness plugin

This is a new standalone plugin project. It does not replace the existing `dsh-higress-ai-route-plugin` package.

For a native Harness source checkout, use
[`scripts/install-native-harness.sh`](./scripts/install-native-harness.sh) to build
and install this bundle into an existing profile through the supported `dsh plugin`
CLI.

It supports multiple BEARER credential connections in one Harness profile. Every connection discovers all routes authorized for its credential and owns isolated Providers identified by `connectionId + gatewayInstanceId + routeId`.

```sh
HARNESS_SRC=/opt/dsh/harness PROFILE=web \
  ./scripts/install-native-harness.sh
```

The `npm` commands belong in this plugin directory only. A Harness source checkout is a pnpm workspace and may not expose a global `dsh` binary. For a source checkout, install with the supported CLI entry point:

```sh
cd /path/to/harness
pnpm dsh plugin --profile web add \
  file:/absolute/path/to/dsh-higress-credential-routes-plugin-0.1.0.tgz
```

The running `127.0.0.1:3080` instance uses the `web` profile; installing into `demo` does not update it. Restart the matching Harness Web process after installation.
