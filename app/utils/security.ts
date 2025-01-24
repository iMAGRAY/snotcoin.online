import crypto from "crypto"
import { supabase } from "./supabase"

// Function to get encryption keys from Supabase
async function getEncryptionKeys() {
  const { data: envVars, error } = await supabase
    .from("environment_variables")
    .select("*")
    .in("Name", ["ENCRYPTION_KEY", "SIGNATURE_KEY"])

  if (error) {
    throw new Error("Failed to fetch encryption keys")
  }

  const keys = {
    ENCRYPTION_KEY: envVars.find((v) => v.Name === "ENCRYPTION_KEY")?.Key || "",
    SIGNATURE_KEY: envVars.find((v) => v.Name === "SIGNATURE_KEY")?.Key || "",
  }

  return keys
}

const IV_LENGTH = 16 // For AES, this is always 16

export async function encryptData(data: any): Promise<string> {
  const keys = await getEncryptionKeys()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(keys.ENCRYPTION_KEY), iv)

  let encrypted = cipher.update(JSON.stringify(data))
  encrypted = Buffer.concat([encrypted, cipher.final()])

  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

export async function decryptData(text: string): Promise<any> {
  const keys = await getEncryptionKeys()
  const textParts = text.split(":")
  const iv = Buffer.from(textParts.shift()!, "hex")
  const encryptedText = Buffer.from(textParts.join(":"), "hex")

  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(keys.ENCRYPTION_KEY), iv)

  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return JSON.parse(decrypted.toString())
}

export async function signData(data: any): Promise<string> {
  const keys = await getEncryptionKeys()
  const jsonData = JSON.stringify(data)
  return crypto.createHmac("sha256", keys.SIGNATURE_KEY).update(jsonData).digest("hex")
}

export async function verifyData(data: any, signature: string): Promise<boolean> {
  const expectedSignature = await signData(data)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

// Cache the keys in memory to reduce database calls
let cachedKeys: { ENCRYPTION_KEY: string; SIGNATURE_KEY: string } | null = null
let lastKeysFetch = 0
const KEY_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Helper function to get cached keys or fetch new ones
export async function getKeys() {
  const now = Date.now()
  if (!cachedKeys || now - lastKeysFetch > KEY_CACHE_DURATION) {
    cachedKeys = await getEncryptionKeys()
    lastKeysFetch = now
  }
  return cachedKeys
}

