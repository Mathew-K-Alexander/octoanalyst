import express from "express";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

const app = express();
const PORT = 5000;

// Create a cookie jar
const jar = new CookieJar();
// Wrap axios to support cookies
const client = wrapper(axios.create({ jar }));

// Browser-like headers
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.nseindia.com/",
};

app.get("/api/annual-report/:ticker", async (req, res) => {
  const { ticker } = req.params;

  try {
    // 1. Hit NSE homepage to establish cookies
    await client.get("https://www.nseindia.com", { headers });

    // 2. Reuse the same cookie jar to call the API
    const apiRes = await client.get(
      `https://www.nseindia.com/api/annual-reports?index=equities&symbol=${ticker}`,
      { headers }
    );

    res.json(apiRes.data);
  } catch (error) {
    console.error("Error fetching NSE data:", error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
