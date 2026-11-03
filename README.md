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
