import { Router } from "express";
import { NseIndia } from "./index.js";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  createJob,
  getBus,
  getState,
  setState,
  finishJob,
  failJob,
} from "./jobs.js";
import "dotenv/config";
import { runPythonJson, runGeminiJson, downloadPdfOrZip } from "./helpers.js";

const mainRouter = Router();
const nseIndia = new NseIndia();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VENV_PY = path.resolve(__dirname, "../parse_trials/.venv/bin/python3");
const PARSER = path.resolve(__dirname, "./python_helpers/parse.py");
const SEARCH = path.resolve(__dirname, "./python_helpers/semantic_search.py");
const TOPICS_JSON = path.resolve(__dirname, "./rules.json");

function safeUpdate(id, bus, status, payload = {}) {
  try {
    bus.emit("progress", {
      step: status.toLowerCase().replace(/\s+/g, "_"), //replace every whitespaces with underscores
      message: status,
      ...payload,
    });
    setState(id, { status, ...payload });
  } catch (err) {
    console.error("Safe update failed:", err);
    failJob(id, err);
  }
}

// ---- START JOB ----
mainRouter.post("/api/equity/annualReports/:symbol/start", async (req, res) => {
  const { symbol } = req.params;
  const { id, bus } = createJob();
  setState(id, { status: "created", symbol });

  res.json({ jobId: id });

  const checkpath = path.join("uploads", `PDF/${symbol}.pdf`);
  const pagesJsonPath = path.join("uploads", `JSON/${symbol}.json`);
  const searchResultsPath = path.join(
    "uploads",
    `JSON/${symbol}_search_results.json`
  );
  const checkGeminiOutputPath = path.join("outputs", `${symbol}_gemini.json`);

  (async () => {
    try {
      // STEP 1: Fetch URL
      safeUpdate(id, bus, "Fetching PDF URL from NSE", symbol);

      const content = await nseIndia.getAnnualReports(symbol);
      const pdfUrl = content.data[0].fileName;
      console.log("PDF URL:", pdfUrl);

      // STEP 2: Download
      safeUpdate(id, bus, "Downloading PDF or ZIP");

      let localPDF;
      if (fs.existsSync(checkpath)) {
        console.log("exits");
        localPDF = checkpath;
      } else {
        localPDF = await downloadPdfOrZip(pdfUrl, symbol);
        console.log("Saved to:", localPDF);
      }

      // STEP 3: Parse
      safeUpdate(id, bus, "Parsing PDF");

      if (!fs.existsSync(pagesJsonPath)) {
        const parsed = await runPythonJson(VENV_PY, [PARSER, localPDF]);
        fs.writeFileSync(pagesJsonPath, JSON.stringify(parsed, null, 2));
      }

      // STEP 4: Semantic search
      safeUpdate(id, bus, "Collecting relevant topics via semantic search");

      if (fs.existsSync(searchResultsPath)) {
        console.log("search result exits");
      } else {
        const searchOut = await runPythonJson(VENV_PY, [
          SEARCH,
          pagesJsonPath,
          TOPICS_JSON,
          "0.55",
          "title",
          "5",
        ]);
        const searchResultsPath = path.join(
          "uploads",
          `JSON/${symbol}_search_results.json`
        );
        fs.writeFileSync(searchResultsPath, JSON.stringify(searchOut, null, 2));
      }

      //STEP 7: AI ANALYSIS
      safeUpdate(id, bus, "Analysing topics using AI");

      if (fs.existsSync(checkGeminiOutputPath)) {
        console.log("gemini analysis exits");
      } else {
        await runGeminiJson(symbol);
      }

      // STEP 6: Map
      bus.emit("progress", {
        step: "done",
        message: "Creating map",
      });
      setState(id, {
        status: "done",
        files: { pagesJsonPath, searchResultsPath },
      });
      finishJob(id);
    } catch (e) {
      console.error("Job failed:", e);
      failJob(id, e);
    }
  })();
});

mainRouter.get("/api/summary/:ticker", (req, res) => {
  const { ticker } = req.params;
  const file = path.join(process.cwd(), "outputs", `${ticker}_gemini.json`);
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    res.json(json);
  } catch (e) {
    res.status(404).json({ error: `Summary not found for ${ticker}` });
  }
});

// ---- STREAM ----
function sseHeaders(res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
}
function send(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
mainRouter.get("/api/jobs/:id/stream", (req, res) => {
  const { id } = req.params;
  const bus = getBus(id);
  const st = getState(id);

  sseHeaders(res);

  if (!bus) {
    send(res, "error", { message: "Unknown jobId" });
    return res.end();
  }

  // send current state
  send(res, "status", st);

  const onProgress = (payload) => send(res, "status", payload);
  const onEnd = () => {
    send(res, "done", getState(id));
    res.end();
  };
  const onErr = (msg) => {
    send(res, "error", { message: msg });
    res.end();
  };

  bus.on("progress", onProgress);
  bus.once("end", onEnd);
  bus.once("error", onErr);

  req.on("close", () => {
    bus.off("progress", onProgress);
  });
});

export { mainRouter };
