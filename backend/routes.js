import { Router } from "express";
import { NseIndia } from "./index.js";

const mainRouter = Router();

const nseIndia = new NseIndia();

mainRouter.get("/api/equity/annualReports/:symbol", async (req, res) => {
  try {
    res.json(await nseIndia.getAnnualReports(req.params.symbol));
  } catch (error) {
    res.status(400).json(error);
  }
});

export { mainRouter };
