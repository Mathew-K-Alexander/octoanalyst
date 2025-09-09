import path from "path";
import axios from "axios";
import fs from "fs";
import unzipper from "unzipper";
import { failJob } from "./jobs.js";
import "dotenv/config";
import { fileURLToPath } from "url";

import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRIGGER_AI = path.resolve(__dirname, "./gemini_summarize.js");

// --- helper: run python script and parse JSON stdout ---
export function runPythonJson(py, args, { cwd } = {}) {
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

export function runGeminiJson(symbol) {
  /*
node gemini_summarize.js \
  --rules ./rules.json \
  --search ./uploads/TATACOFFEE_search_results.json \
  --model gemini-1.5-flash \
  --concurrency 3 \
  --outDir ./outputs
*/
  return new Promise((resolve, reject) => {
    const geminiArgs = [
      TRIGGER_AI,
      "--rules",
      "./rules.json",
      "--search",
      `./uploads/JSON/${symbol}_search_results.json`,
      "--model",
      "gemini-2.0-flash-lite",
      "--concurrency",
      "1",
      "--outDir",
      "./outputs",
    ];
    const analyse = spawn("node", geminiArgs, { cwd: process.cwd() });

    analyse.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

    analyse.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    analyse.on("close", (code) => {
      if (code !== 0) {
        failJob(jobId, new Error("Gemini failed with code " + code));
        reject();
      } else {
        resolve();
      }
    });
  });
}

// --- helper: download PDF or unzip ZIP to PDF ---
export async function downloadPdfOrZip(pdfUrl, symbol) {
  const localPDF = path.join("uploads", `PDF/${symbol}.pdf`);

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
