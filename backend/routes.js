import { Router } from "express";
import { NseIndia } from "./index.js";
import multer from "multer";
import { spawn } from "child_process";
import path from "path";
import axios from "axios";
import fs from "fs";
import unzipper from "unzipper";
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

const mainRouter = Router();
const upload = multer({ dest: "uploads/" });
const nseIndia = new NseIndia();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VENV_PY = path.resolve(__dirname, "../parse_trials/.venv/bin/python3");
const PARSER = path.resolve(__dirname, "./parse.py");
const SEARCH = path.resolve(__dirname, "./semantic_search.py");
const TOPICS_JSON = path.resolve(__dirname, "./rules.json");

// --- helper: run python script and parse JSON stdout ---
function runPythonJson(py, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    console.log("Running python:", py, args.join(" "));
    const child = spawn(py, args, { cwd });
    let out = "",
      err = "";

    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(err || `Python exited with code ${code}`));
      }
      if (err) {
        console.warn("Python stderr:", err);
      }
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(
          new Error("Invalid JSON from script: " + e.message + "\n" + out)
        );
      }
    });
  });
}

// --- helper: download PDF or unzip ZIP to PDF ---
async function downloadPdfOrZip(pdfUrl, symbol) {
  const localPDF = path.join("uploads", `${symbol}.pdf`);

  if (pdfUrl.toLowerCase().endsWith(".zip")) {
    // download zip
    const zipPath = path.join("uploads", `${symbol}.zip`);
    const response = await axios({
      method: "get",
      url: pdfUrl,
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "application/pdf,application/zip",
      },
    });

    //downloading zip
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);
      let error = null;
      writer.on("error", (err) => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on("close", () => {
        if (!error) {
          const stats = fs.statSync(zipPath);
          console.log(
            `Downloaded ${symbol} -> ${zipPath} (${stats.size} bytes)`
          );
          resolve(true);
        }
      });
    });

    // unzip first PDF found
    const directory = await unzipper.Open.file(zipPath);
    const pdfEntry = directory.files.find((f) =>
      f.path.toLowerCase().endsWith(".pdf")
    );
    if (!pdfEntry) throw new Error("No PDF found in ZIP file");

    //downloading PDF from zip
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(localPDF);
      pdfEntry.stream().pipe(writer);
      let error = null;
      writer.on("error", (err) => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on("close", () => {
        if (!error) {
          const stats = fs.statSync(localPDF);
          console.log(
            `Downloaded ${symbol} -> ${localPDF} (${stats.size} bytes)`
          );
          resolve(true);
        }
      });
    });

    // cleanup zip
    try {
      fs.unlinkSync(zipPath);
    } catch {}
    return localPDF;
  }

  // normal PDF
  const response = await axios({
    method: "get",
    url: pdfUrl,
    responseType: "stream",
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "application/pdf,application/zip",
    },
  });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(localPDF);
    response.data.pipe(writer);
    let error = null;
    writer.on("error", (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on("close", () => {
      if (!error) {
        const stats = fs.statSync(localPDF);
        console.log(
          `Downloaded ${symbol} -> ${localPDF} (${stats.size} bytes)`
        );
        resolve(true);
      }
    });
  });
  return localPDF;
}

// ---- START JOB ----
mainRouter.post("/api/equity/annualReports/:symbol/start", async (req, res) => {
  const { symbol } = req.params;
  const { id, bus } = createJob();
  setState(id, { status: "created", symbol });

  res.json({ jobId: id });

  (async () => {
    try {
      // STEP 1: Fetch URL
      bus.emit("progress", {
        step: "fetching_pdf_url",
        message: "Fetching PDF URL from NSE",
        symbol,
      });
      setState(id, { status: "Fetching PDF URL" });

      const content = await nseIndia.getAnnualReports(symbol);
      const pdfUrl = content.data[0].fileName;
      console.log("PDF URL:", pdfUrl);

      // STEP 2: Download
      bus.emit("progress", {
        step: "downloading_pdf",
        message: "Downloading PDF or ZIP",
        url: pdfUrl,
      });
      setState(id, { status: "Fetching PDF" });

      const localPDF = await downloadPdfOrZip(pdfUrl, symbol);
      console.log("Saved to:", localPDF);

      // STEP 3: Parse
      bus.emit("progress", {
        step: "parsing_pdf",
        message: "Parsing PDF to per-page JSON",
      });
      setState(id, { status: "Parsing PDF" });

      const parsed = await runPythonJson(VENV_PY, [PARSER, localPDF]);
      const pagesJsonPath = path.join("uploads", `${symbol}.json`);
      fs.writeFileSync(pagesJsonPath, JSON.stringify(parsed, null, 2));

      try {
        fs.unlinkSync(localPDF);
      } catch {}

      // STEP 4: Semantic search
      bus.emit("progress", {
        step: "collecting_topics",
        message: "Collecting relevant topics via semantic search",
      });
      setState(id, { status: "Collecting relevant topics" });

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
        `${symbol}_search_results.json`
      );
      fs.writeFileSync(searchResultsPath, JSON.stringify(searchOut, null, 2));

      // STEP 5: Map
      bus.emit("progress", {
        step: "creating_map",
        message: "Creating map/summary",
      });
      setState(id, {
        status: "Creating map",
        files: { pagesJsonPath, searchResultsPath },
      });

      // DONE
      bus.emit("progress", { step: "done", message: "Completed" });
      setState(id, {
        status: "Done",
        files: { pagesJsonPath, searchResultsPath },
      });
      finishJob(id);
    } catch (e) {
      console.error("Job failed:", e);
      failJob(id, e);
    }
  })();
});

// ---- ARTIFACTS ----
mainRouter.get("/api/equity/annualReports/:symbol/artifacts", (req, res) => {
  const { symbol } = req.params;
  const pagesJsonPath = path.join("uploads", `${symbol}.json`);
  const searchResultsPath = path.join(
    "uploads",
    `${symbol}_search_results.json`
  );
  res.json({
    pagesJson: fs.existsSync(pagesJsonPath) ? pagesJsonPath : null,
    searchResults: fs.existsSync(searchResultsPath) ? searchResultsPath : null,
  });
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
