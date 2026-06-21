import { createHash } from "crypto";

export function getGravatar(email: string, size = 200): string {
  const hash = createHash("md5")
    .update(email.toLowerCase().trim())
    .digest("hex");

  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=robohash`;
}
