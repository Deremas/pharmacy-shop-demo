import http from "http";
import next from "next";

process.chdir(new URL(".", import.meta.url).pathname);

const dev = false;
const port = Number(process.env.PORT || 3000);

const app = next({
  dev,
  dir: process.cwd(),
  hostname: "0.0.0.0",
  port,
});

const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, "0.0.0.0", () => {
      console.log(`Next.js app is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start Next.js app:", err);
    process.exit(1);
  });