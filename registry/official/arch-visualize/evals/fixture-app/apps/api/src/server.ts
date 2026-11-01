import express from "express";
import { me } from "./routes/me";
import { checkout } from "./routes/checkout";
import { ask } from "./routes/ask";

const app = express();
app.get("/api/me", me);
app.post("/api/checkout", checkout);
app.post("/api/ask", ask);
app.listen(4000);
