# linkgentest — public website generator with persistent storage

This version removes the admin password and sign-in screen, so anyone can generate a website link. It keeps the original charcoal-grey and yellow Times New Roman design, template selector, Supabase Storage persistence, and basic abuse protections.

## Security features

- Website generation is rate-limited to 20 requests per hour per IP (per running instance).
- Helmet security headers are enabled and Express's identifying header is disabled.
- JSON request bodies are limited to 2 KB, template names are validated, and cross-origin POST requests are rejected when an Origin header is present.
- The Supabase server-side key stays on the server. Do not put it in frontend files or commit it to GitHub.
- Generated pages are public to anyone with their link.

## Required environment variables

Set these in Koyeb's Environment Variables section:

- `SUPABASE_URL`: your Supabase project URL, e.g. `https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: your server-side Supabase secret/service-role key
- `NODE_ENV`: set to `production` on the hosted deployment (recommended)

The app uses the `PORT` environment variable when provided by the host.

## Supabase setup

1. Create a Supabase project.
2. Create a **private** Storage bucket named `site-pages`.
3. Copy the project URL and server-side key into Koyeb's environment variables.
4. Do not expose the service-role key in the browser. The app uses it only from `server.js` to read/write objects in the private bucket.

## Koyeb deployment

1. Upload this folder's contents to a GitHub repository (with `package.json` at the root).
2. Create a Koyeb Web Service from that repository.
3. Use `npm start` as the run command and set the required environment variables.
4. Koyeb provides HTTPS. Set `NODE_ENV=production`.

## Local run

Requires Node.js 18+. Set the environment variables, then run:

```sh
npm install
npm start
```

Open `http://localhost:3000`.

## Templates

Add `templates/another-page.html` and redeploy. It appears in the selector. The included `templates/truffled.html` is still a placeholder because the uploaded source ZIP did not include the actual Truffled site.

## Important limitations

- Anyone can generate links. Rate limits reduce casual abuse but are not a hard global quota and may reset on restart. Monitor Supabase usage and consider tighter limits if the site becomes popular.
- Generated links are public to anyone who has the URL. Do not put private information in templates.
- Only use templates you trust. HTML pages can run JavaScript in a visitor's browser.
- This version copies one HTML file, not a full multi-page site with its assets. Supporting full websites requires copying and serving a directory/archive of files and rewriting relative paths.
