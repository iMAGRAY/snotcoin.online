import { supabase } from "./supabase"

export async function signIn(token: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "telegram",
    token,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function getCurrentUser() {
  return supabase.auth.getUser()
}

export function verifyToken(token: string) {
  // Implement token verification logic here
  // This is a placeholder and should be replaced with actual token verification
  return true
}

