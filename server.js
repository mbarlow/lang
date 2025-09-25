const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    if (path === '/') path = '/index.html';

    const file = Bun.file('.' + path);
    const exists = await file.exists();

    if (!exists) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(file);
  },
});

console.log(`Server running at http://localhost:${server.port}`);