import crypto from "crypto"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY! // Должен быть 32-байтовый ключ
const IV_LENGTH = 16 // Для AES, это всегда 16
const SIGNATURE_KEY = process.env.SIGNATURE_KEY!

export function encryptData(data: any): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv)
  let encrypted = cipher.update(JSON.stringify(data))
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

export function decryptData(text: string): any {
  const textParts = text.split(":")
  const iv = Buffer.from(textParts.shift()!, "hex")
  const encryptedText = Buffer.from(textParts.join(":"), "hex")
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return JSON.parse(decrypted.toString())
}

export function signData(data: any): string {
  const jsonData = JSON.stringify(data)
  return crypto.createHmac("sha256", SIGNATURE_KEY).update(jsonData).digest("hex")
}

export function verifyData(data: any, signature: string): boolean {
  const expectedSignature = signData(data)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

