import { socialHandler } from "../../../src/lib/social/server";
export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
export default socialHandler();
