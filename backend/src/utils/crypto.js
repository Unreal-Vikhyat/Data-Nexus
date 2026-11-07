import { createHash, randomBytes, randomUUID } from "node:crypto";

export const newId = () => randomUUID();
export const newSecret = () => randomBytes(32).toString("base64url");
export const hashSecret = (value) => createHash("sha256").update(value).digest("hex");
