import { supabase } from "../utils/supabase"

export async function signIn(userData: any) {
  try {
    // Create a custom JWT token using the user data from Telegram
    const { data, error } = await supabase.functions.invoke("create-custom-jwt", {
      body: JSON.stringify(userData),
    })

    if (error) throw error

    // Sign in with the custom JWT token
    const { data: authData, error: signInError } = await supabase.auth.signInWithIdToken({
      provider: "telegram",
      token: data.token,
    })

    if (signInError) throw signInError

    return authData
  } catch (error) {
    console.error("SignIn error:", error)
    throw error
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  return supabase.auth.getUser()
}

