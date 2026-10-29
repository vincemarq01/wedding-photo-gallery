import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function seal(data: object, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(secret, "hex"), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unseal<T extends { expires: number }>(
  token: string,
  secret: string,
): T {
  try {
    if (token.length > 12000) throw Error();
    const b = Buffer.from(token, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(secret, "hex"),
      b.subarray(0, 12),
    );
    decipher.setAuthTag(b.subarray(12, 28));
    const data = JSON.parse(
      Buffer.concat([
        decipher.update(b.subarray(28)),
        decipher.final(),
      ]).toString(),
    ) as T;
    if (data.expires < Date.now()) throw Error();
    return data;
  } catch {
    throw new Error(
      "Upload authorization expired. Refresh the page and choose your files again.",
    );
  }
}
