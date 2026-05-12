# House Power Demand Calculator

An installable, touch-friendly web app for estimating household power demand
from appliance selections, daily run hours, and weekly activity days. It opens
straight into appliance selection so the consultation can start immediately.

## Run Locally

This project has no third-party runtime dependencies. If Node.js is installed:

```bash
npm start
```

In this Codex workspace, the bundled Node runtime can run it directly:

```powershell
& 'C:\Users\YI MING\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

Then open:

```text
http://localhost:4173
```

## Test

```bash
npm test
```

Or with the bundled runtime:

```powershell
& 'C:\Users\YI MING\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.js
```

## Scope

The app is for customer education and consultation. It is not a certified
electrical design tool. Equipment ratings, usage patterns, and site conditions
should be confirmed before quoting or committing to work.
