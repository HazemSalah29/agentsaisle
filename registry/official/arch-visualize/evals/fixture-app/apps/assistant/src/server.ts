import express from "express";
import { answer } from "./answer";

const app = express();
app.post("/ask", answer);
app.listen(5000);
