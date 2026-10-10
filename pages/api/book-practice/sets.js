import { practiceHandler } from "../../../src/lib/book-practice-server";
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };
export default practiceHandler("sets");
