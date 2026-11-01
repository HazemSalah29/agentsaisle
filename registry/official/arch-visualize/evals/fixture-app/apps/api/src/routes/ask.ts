export async function ask(req, res) {
  const reply = await fetch(`${process.env.ASSISTANT_URL}/ask`, {
    method: "POST",
    body: JSON.stringify(req.body),
    signal: AbortSignal.timeout(25000),
  });
  res.json(await reply.json());
}
