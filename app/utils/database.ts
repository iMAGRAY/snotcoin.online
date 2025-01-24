import { supabase } from "./supabase"

export async function saveGameStateToDatabase(userId: string, encryptedData: string, signature: string) {
  const { data, error } = await supabase
    .from("game_states")
    .upsert({ user_id: userId, encrypted_data: encryptedData, signature: signature })

  if (error) {
    throw error
  }

  return data
}

