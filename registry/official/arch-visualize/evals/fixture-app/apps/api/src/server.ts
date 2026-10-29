import express from "express";
import { me } from "./routes/me";
import { checkout } from "./routes/checkout";

const app = express();
app.get("/api/me", me);
app.post("/api/checkout", checkout);
app.listen(4000);
