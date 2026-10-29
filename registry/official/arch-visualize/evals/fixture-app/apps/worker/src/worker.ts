import { Worker } from "bullmq";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

new Worker("receipts", async (job) => {
  await resend.emails.send({ to: "customer@example.com", subject: "Receipt", text: String(job.data.total) });
});
