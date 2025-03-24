import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const setSupabaseToken = async (token: string) => {
  const { error } = await supabase.auth.setSession({
    access_token: token,
    refresh_token: token,
  })
  if (error) {
    throw error
  }
}

export async function setServerSession(supabaseAccessToken: string): Promise<void> {
  try {
    await supabase.auth.setSession({
      access_token: supabaseAccessToken,
      refresh_token: "",
    })
  } catch (error) {
    // Ошибка установки сессии
  }
}

