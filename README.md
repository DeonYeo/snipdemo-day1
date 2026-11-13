# Snip

Snip is a small URL shortener with one backend and two clients: an Angular web
app and a Node.js CLI. Each layer has its own orphan branch in this repository;
`main` assembles exact commits from those branches as Git submodules.

## Layout

| Branch | Contents |
| --- | --- |
| `backend` | Bun API server |
| `frontend` | Angular 22 web app |
| `cli` | Zero-dependency CommonJS CLI |
| `bundle` | Generated release: API server, built UI, and CLI |
| `main` | Submodule pointers, build script, documentation, and CI |

The API stores links in an in-memory map, so restarting the server clears them.

## API contract

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/links` | JSON `{ "url": "https://…" }` returns `201` and `{ code, url, shortUrl, hits, createdAt }`; invalid JSON or a non-HTTP(S) URL returns `400`. |
| `GET` | `/api/links` | Returns `200` and an array of link objects. |
| `GET` | `/:code` | Redirects with `302` and increments `hits`; an unknown code returns `404`. |

If the contract changes, update the backend and both clients together.

## Clone

Submodules contain the app layers, so clone recursively:

```sh
git clone --recurse-submodules https://github.com/DeonYeo/snipdemo-day1.git
```

For an existing plain clone, initialize them with:

```sh
git submodule update --init --recursive
```

## Run locally

Start each component in a separate terminal from the `main` checkout:

```sh
cd backend && bun start
cd frontend && npm install && npx ng serve
cd cli && node cli.js ls
```

The backend listens on port `3000`; Angular serves the UI on port `4200`. The
frontend development proxy forwards API requests to the backend. Set `SNIP_API`
to override the CLI's default API URL.

## Updating a layer

Edit and push the layer in its own submodule branch, then move the superproject
gitlink to that commit:

```sh
cd backend
git add -A && git commit -m "Describe backend change" && git push
cd ..
git submodule update --remote backend
git add backend && git commit -m "Bump backend submodule" && git push
```

Repeat with `frontend` or `cli` as appropriate. `bundle/` is generated output;
do not hand-edit it. Rebuild and publish a bundle with:

```sh
node scripts/build-bundle.mjs --push
```

The hourly bundle workflow intentionally has no push trigger. A bundle gitlink
update on `main` triggers the Docker image workflow.
