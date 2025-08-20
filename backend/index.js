import axios from "axios";
import UserAgent from "user-agents";
import { sleep } from "./utils.js";

export class NseIndia {
  baseUrl = "https://www.nseindia.com";
  cookieMaxAge = 60; // seconds
  baseHeaders = {
    Authority: "www.nseindia.com",
    Referer: "https://www.nseindia.com/",
    Accept: "*/*",
    Origin: this.baseUrl,
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "application/json, text/plain, */*",
    Connection: "keep-alive",
  };

  userAgent = "";
  cookies = "";
  cookieUsedCount = 0;
  cookieExpiry = new Date().getTime() + this.cookieMaxAge * 1000;
  noOfConnections = 0;

  async getNseCookies() {
    if (
      this.cookies === "" ||
      this.cookieUsedCount > 10 ||
      this.cookieExpiry <= new Date().getTime()
    ) {
      this.userAgent = new UserAgent().toString();
      const response = await axios.get(
        `${this.baseUrl}/get-quotes/equity?symbol=TCS`,
        {
          headers: { ...this.baseHeaders, "User-Agent": this.userAgent },
        }
      );
      const setCookies = response.headers["set-cookie"] || [];
      const cookies = [];
      setCookies.forEach((cookie) => {
        const cookieKeyValue = cookie.split(";")[0];
        cookies.push(cookieKeyValue);
      });
      this.cookies = cookies.join("; ");
      this.cookieUsedCount = 0;
      this.cookieExpiry = new Date().getTime() + this.cookieMaxAge * 1000;
    }
    this.cookieUsedCount++;
    return this.cookies;
  }

  /**
   * @param {string} url NSE API URL
   * @returns {Promise<any>} JSON
   */
  async getData(url) {
    let retries = 0;
    let hasError = false;
    do {
      while (this.noOfConnections >= 5) {
        await sleep(500);
      }
      this.noOfConnections++;
      try {
        const response = await axios.get(url, {
          headers: {
            ...this.baseHeaders,
            Cookie: await this.getNseCookies(),
            "User-Agent": this.userAgent,
          },
        });
        this.noOfConnections--;
        return response.data;
      } catch (error) {
        hasError = true;
        retries++;
        this.noOfConnections--;
        if (retries >= 10) throw error;
      }
    } while (hasError);
  }

  getDataByEndpoint(apiEndpoint) {
    return this.getData(`${this.baseUrl}${apiEndpoint}`);
  }

  getAnnualReports(symbol) {
    return this.getDataByEndpoint(
      `/api/annual-reports?index=equities&symbol=${encodeURIComponent(
        symbol.toUpperCase()
      )}`
    );
  }
}
