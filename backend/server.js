import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { mainRouter } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = process.env.PORT || 3000;
const hostUrl = process.env.HOST_URL || `http://localhost:${port}`;

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", // your React app
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(mainRouter);

app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`NseIndia App started on port ${port}`);
  console.log(`Open ${hostUrl} in browser.`);
});
