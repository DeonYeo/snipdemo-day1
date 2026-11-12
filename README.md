# snip-backend

The Snip API: a single-file [Bun](https://bun.sh) server with zero npm dependencies. Links are stored in an in-memory `Map`, so restarts clear all links.

## API

| Method | Path         | Body                     | Response                                                                 |
| ------ | ------------ | ------------------------ | ------------------------------------------------------------------------ |
| `POST` | `/api/links` | `{ "url": "https://…" }` | `201` `{ code, url, shortUrl, hits, createdAt }` · `400` `{ error }`     |
| `GET`  | `/api/links` | —                        | `200` array of all links                                                 |
| `GET`  | `/:code`     | —                        | `302` to the original URL (+1 hit) · `404` `{ error }` if unknown        |
| `GET`  | `/healthz`   | —                        | `200` `{ ok: true }` (liveness probe)                                    |

## Configuration

| Variable                | Default                                    | Purpose                                                                 |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `PORT`                  | `3000`                                     | Listening port                                                          |
| `BASE_URL`              | `https://$RAILWAY_PUBLIC_DOMAIN`, else `http://localhost:$PORT` | Origin used in `shortUrl` values                  |
| `PUBLIC_DIR`            | unset                                      | When set, also serves static files from this folder (`/` → `index.html`; an existing file wins over a short code) |

## Run

```sh
bun start
curl -i -X POST localhost:3000/api/links -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
```
