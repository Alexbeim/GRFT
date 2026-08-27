# Markdown content negotiation — status & how to finish it

**Audit item:** acceptmarkdown.com compliance — when a client sends
`Accept: text/markdown`, serve a markdown representation and add `Accept` to the
`Vary` header (`Vary: Accept, Accept-Encoding`).

## Why it is not live yet

`graffitiplus.io` is hosted on **GitHub Pages** (`server: GitHub.com`). GitHub
Pages serves static files only: it **cannot run server-side logic, cannot do
`Accept`-based content negotiation, and cannot set custom response headers**
(the `_headers` file is a Netlify / Cloudflare Pages feature and is ignored by
GitHub Pages). So the `Vary: Accept` header and the markdown variant cannot be
produced by the current host. This is an infrastructure decision, not a code
change — it requires putting an edge/CDN layer in front of the site or moving
hosts.

Agents can already fetch markdown today via [`/llms.txt`](https://graffitiplus.io/llms.txt)
and [`/llms-full.txt`](https://graffitiplus.io/llms-full.txt); what is missing is
per-URL `Accept` negotiation with the `Vary` header.

## Drop-in fixes once an edge layer exists

### Option A — Cloudflare in front of GitHub Pages (recommended, no migration)

Add a Cloudflare Worker on the zone:

```js
export default {
  async fetch(request, env) {
    const accept = request.headers.get("Accept") || "";
    const wantsMd = /text\/markdown/i.test(accept);
    const url = new URL(request.url);

    // Serve a .md sibling when the agent asks for markdown and one exists.
    if (wantsMd && !url.pathname.endsWith(".md")) {
      const mdPath = url.pathname.replace(/\/$/, "/index").replace(/\.html$/, "") + ".md";
      const mdResp = await fetch(new URL(mdPath, url), request);
      if (mdResp.ok) {
        const headers = new Headers(mdResp.headers);
        headers.set("Content-Type", "text/markdown; charset=utf-8");
        headers.set("Vary", "Accept, Accept-Encoding");
        return new Response(mdResp.body, { status: 200, headers });
      }
    }

    // Otherwise pass through, but still advertise that the response varies on Accept.
    const resp = await fetch(request);
    const headers = new Headers(resp.headers);
    headers.set("Vary", "Accept, Accept-Encoding");
    return new Response(resp.body, { status: resp.status, headers });
  }
};
```

### Option B — Netlify / Cloudflare Pages `_headers` (only if the site migrates there)

```
/*
  Vary: Accept, Accept-Encoding
```

(Static hosts still cannot *transform* the body to markdown from `_headers`
alone — pair this with `.md` siblings and a redirect/edge function for the
actual negotiation.)

## Verify after enabling

```bash
curl -sI -H "Accept: text/markdown" https://graffitiplus.io/ \
  | grep -iE 'content-type|vary'
# expect: content-type: text/markdown...  and  vary: Accept, Accept-Encoding
```
