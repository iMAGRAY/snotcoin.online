// We'll use a simple XOR encryption as a placeholder
// Note: This is not secure for production use
const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "default-secret-key"

export function encrypt(data: string): string {
  return xorEncrypt(data, SECRET_KEY)
}

export function decrypt(encryptedData: string): string {
  return xorEncrypt(encryptedData, SECRET_KEY)
}

function xorEncrypt(data: string, key: string): string {
  let result = ""
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result) // Base64 encode the result
}

