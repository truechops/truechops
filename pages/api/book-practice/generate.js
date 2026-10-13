// Keep old clients/links informative without retaining a generation capability.
export default function retiredBookGenerator(req,res) {
  res.setHeader("Cache-Control","private, no-store");
  return res.status(410).json({ error:"Book generation has moved to the score. Open the book page, select exercises, and choose Open in score to make dynamic variations." });
}
