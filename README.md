# Snip CLI

Node.js 20 or newer is required. The CLI has no dependencies.

Run `node cli.js help`, use the `snip`, `snip.cmd`, or `snip.ps1` wrapper,
or install the package with npm to use the `snip` command.

```text
snip add https://example.com
snip ls
snip open Ab12Cd
```

`SNIP_API` selects the backend origin and defaults to `http://localhost:3000`.
`open` requests the short code without following its redirect, then opens the
destination in the default browser. That request increments the hit count.
Errors go to stderr and return exit code 1. Requests time out after 10 seconds.

Run `npm test` for the mock API tests. The backend stores links in memory;
restarting it clears them.
