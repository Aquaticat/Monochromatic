# Project Pi settings

Project Pi settings are intentionally empty of packages.
Put user-specific workflow packages in global Pi settings instead:

```text
~/.pi/agent/settings.json
```

The project `.pi/settings.json` file only carries a JSON comment marker because Pi settings use strict JSON.
Do not add `packages` here unless the package is shared project configuration.
