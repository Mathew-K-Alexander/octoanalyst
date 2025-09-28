/*
node openrouter_summarize.js \
  --rules ./rules.json \
  --search ./uploads/TATACOFFEE_search_results.json \
  --model deepseek/deepseek-chat-v3.1:free \
  --concurrency 3 \
  --outDir ./outputs
*/

import fs from "fs";
import path from "path";
import process from "process";
import pLimit from "p-limit";
import fetch from "node-fetch"; // Node <18: npm i node-fetch

import dotenv from "dotenv";
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_TIMEOUT = Number(process.env.OPENROUTER_TIMEOUT || 90000); // configurable timeout

// ----------------------
// Utility functions
// ----------------------
function parseArgs() {
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
  return `
You are analyzing an annual report.

TOPIC: ${topic}

WHAT IS IT ABOUT:
${ruleSummary}

TASK:
Read the provided pages and create an accurate summary of all the pages in accordance with the topic and guidance provided.

FORMAT:
Return only the summary as plain text.

PAGES:
${pages}`;
}

// ----------------------
// API call to OpenRouter
// ----------------------
async function callOpenRouter(modelName, prompt, topic) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost", // required by OpenRouter
        "X-Title": "research-stock summarizer", // required by OpenRouter
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    return { [topic]: raw.trim() };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `OpenRouter request timed out after ${OPENROUTER_TIMEOUT}ms`
      );
    }
    throw err;
  }
}

// ----------------------
// Main pipeline
// ----------------------
async function main() {
  const { rulesPath, searchPath, modelName, concurrency, outDir } = parseArgs();

  if (!OPENROUTER_API_KEY) {
    console.error("❌ Missing OPENROUTER_API_KEY in environment");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const rules = loadJson(rulesPath);
  const content = loadJson(searchPath);

  const perTopicResults = {};
  const limit = pLimit(concurrency);

  const tasks = Object.entries(rules).map(([topic, guidance]) =>
    limit(async () => {
      try {
        const prompt = buildPrompt(topic, guidance, content[topic]);
        const completion = await callOpenRouter(modelName, prompt, topic);
        Object.assign(perTopicResults, completion);
      } catch (err) {
        console.error(`❌ Failed to process topic "${topic}":`, err.message);
      }
    })
  );

  await Promise.all(tasks);

  const ticker = path.basename(searchPath).replace("_search_results.json", "");
  const finalPath = path.join(outDir, `${ticker}_openrouter.json`);

  fs.writeFileSync(finalPath, JSON.stringify(perTopicResults, null, 2), "utf8");
  console.log(`\n✔ All done. Combined → ${finalPath}`);
}

// ----------------------
main().catch((e) => {
  console.error("❌ Fatal error:", e);
  process.exit(1);
});
