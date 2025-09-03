/*
node gemini_summarize.js \
  --rules ./rules.json \
  --search ./uploads/TATACOFFEE_search_results.json \
  --model gemini-1.5-flash \
  --concurrency 3 \
  --outDir ./outputs
*/

import fs from "fs";
import path from "path";
import process from "process";
import pLimit from "p-limit";
import { GoogleGenAI } from "@google/genai";

import dotenv from "dotenv";
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = process.argv.indexOf(flag);
    if (idx === -1 || idx + 1 >= process.argv.length) {
      throw new Error(`Missing required argument: ${flag}`);
    }
    return process.argv[idx + 1];
  };
  return {
    rulesPath: get("--rules"),
    searchPath: get("--search"),
    modelName: get("--model"),
    concurrency: Number(get("--concurrency")),
    outDir: get("--outDir"),
  };
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function buildPrompt(topic, ruleSummary, pages) {
  // Join page texts with boundaries

  return `
You are analyzing an annual report.

TOPIC: ${topic}

WHAT IS IT ABOUT:
${ruleSummary}

TASK:
Read the provided pages and create a accurate summary of all the pages in accordance to the topic and guidance provided.

FORMAT:
just return summary as text

PAGES:
${pages}`;
}

async function callGemini(ai, modelName, prompt, topic) {
  const res = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });
  const raw = res.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = raw.trim();
  return {
    [topic]: clean,
  };
}

async function main() {
  const { rulesPath, searchPath, modelName, concurrency, outDir } = parseArgs();

  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const rules = loadJson(rulesPath);
  const content = loadJson(searchPath);

  const topics = Object.keys(content);

  const ai = new GoogleGenAI(GEMINI_API_KEY);
  const limit = pLimit(concurrency);
  const perTopicResults = {};

  const tasks = Object.entries(rules).map(([topic, guidance]) =>
    limit(async () => {
      const prompt = buildPrompt(topic, guidance, content[topic]);
      const completion = await callGemini(ai, modelName, prompt, topic);
      Object.assign(perTopicResults, completion);
    })
  );

  await Promise.all(tasks);

  const ticker = path.basename(searchPath).replace("_search_results.json", "");
  const finalPath = path.join(outDir, `${ticker}_gemini.json`);
  fs.writeFileSync(finalPath, JSON.stringify(perTopicResults, null, 2), "utf8");
  console.log(`\n✔ All done. Combined → ${finalPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
