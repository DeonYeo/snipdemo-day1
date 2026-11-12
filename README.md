# Snip frontend

Angular 19 client for the Snip API. Run `npm install` and `npm start` with the
backend running on `http://localhost:3000`. The development server proxies
`/api` to the backend; the production build uses the same origin as the page.

Run `npm run build` to generate `dist/snip-frontend/browser` and `npm test` for
the component tests. Links are held in backend memory and disappear on restart.
