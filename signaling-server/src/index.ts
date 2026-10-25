import { startServer } from "./server.js";

const port = Number(process.env.PORT ?? 8080);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",");

startServer({ port, allowedOrigins }).then((s) => {
  console.log(`Signaling server on ws://localhost:${s.port}`);
});