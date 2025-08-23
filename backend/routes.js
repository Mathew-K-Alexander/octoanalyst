import { Router } from "express";
import { NseIndia } from "./index.js";
import multer from "multer";
import { spawn } from "child_process";

import path from "path";
import axios from "axios";
import fs from "fs";

const mainRouter = Router();
const upload = multer({ dest: "uploads/" });
const nseIndia = new NseIndia();

mainRouter.get("/api/equity/annualReports/:symbol", async (req, res) => {
  try {
    const content = await nseIndia.getAnnualReports(req.params.symbol);
    const pdfUrl = content.data[0].fileName;
    console.log(pdfUrl);

    //const localPath = path.join("uploads", `${req.params.symbol}.pdf`);
    //const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    // await fs.promises.writeFile(localPath, response.data);

    //console.log("Done");

    const localPath = path.join("uploads", `${req.params.symbol}.pdf`);
    const writer = fs.createWriteStream(localPath);

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
      response.data.pipe(writer);
      let error = null;
      writer.on("error", (err) => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on("close", () => {
        if (!error) {
          const stats = fs.statSync(localPath);
          console.log(
            `Downloaded ${req.params.symbol} -> ${localPath} (${stats.size} bytes)`
          );
          resolve(true);
        }
      });
    });

    const venvPython = path.resolve("../parse_trials/.venv/bin/python3");

    const py = spawn(venvPython, ["parse.py", localPath]);

    let result = "";
    let error = "";

    py.stdout.on("data", (data) => {
      result += data.toString();
    });

    py.stderr.on("data", (data) => {
      error += data.toString();
    });

    py.on("close", (code) => {
      if (code !== 0 || error) {
        console.error("Parser error:", error);
        return res.status(500).json({ error: error || "Python script failed" });
      }

      try {
        const parsed = JSON.parse(result);

        // save parsed output
        const jsonPath = path.join("uploads", `${req.params.symbol}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), "utf8");

        // cleanup original PDF only after successful parse
        try {
          fs.unlinkSync(localPath);
        } catch {}

        // confirmation response
        res.json({
          message: "Report parsed and saved",
          file: jsonPath,
        });
      } catch (e) {
        console.error("Invalid JSON from parser:", result);
        res.status(500).json({ error: "Invalid JSON from parser" });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Unknown error" });
  }
});

export { mainRouter };
