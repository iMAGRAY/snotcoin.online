import { supabase } from "./supabase"
import type { GameState, User } from "../types/gameTypes"

export async function createNewUser(telegramUser: {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
  language_code?: string
}) {
  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        photo_url: telegramUser.photo_url,
        language_code: telegramUser.language_code,
      })
      .select()
      .single()

    if (userError) throw userError

    console.log("New user created:", user)

    const { data: inventory, error: inventoryError } = await supabase
      .from("inventories")
      .insert({
        user_id: user.id,
        snot: 0,
        snot_coins: 0,
        container_capacity_level: 1,
        filling_speed_level: 1,
        collection_efficiency: 1.0,
      })
      .select()
      .single()

    if (inventoryError) throw inventoryError

    const { data: gameProgress, error: gameProgressError } = await supabase
      .from("game_progress")
      .insert({
        user_id: user.id,
        container_level: 1,
        container_snot: 0,
        energy: 100,
        max_energy: 100,
        fusion_games_played: 0,
        fusion_attempts_used: 0,
        highest_level: 1,
      })
      .select()
      .single()

    if (gameProgressError) throw gameProgressError

    console.log("User data initialized successfully")
    return { ...user, inventories: inventory, game_progress: gameProgress, wallets: [] }
  } catch (error) {
    console.error("Error creating new user:", error)
    throw error
  }
}

export async function getUserByTelegramId(telegramId: number | string) {
  const userId = typeof telegramId === "string" ? Number.parseInt(telegramId) : telegramId

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*, inventories(*), game_progress(*), wallets(*)")
      .eq("telegram_id", userId)
      .single()

    if (userError) throw new Error("User not found")

    console.log("User data retrieved successfully:", user)
    return user
  } catch (error) {
    console.error("Error getting user by Telegram ID:", error)
    throw error
  }
}

export async function updateUserGameState(userId: string, gameState: Partial<GameState>) {
  try {
    const { error: inventoryError } = await supabase
      .from("inventories")
      .update({
        snot: gameState.inventory?.snot,
        snot_coins: gameState.inventory?.snotCoins,
        container_capacity_level: gameState.inventory?.containerCapacityLevel,
        filling_speed_level: gameState.inventory?.fillingSpeedLevel,
        collection_efficiency: gameState.inventory?.collectionEfficiency,
      })
      .eq("user_id", userId)

    if (inventoryError) throw inventoryError

    const { error: gameProgressError } = await supabase
      .from("game_progress")
      .update({
        container_level: gameState.containerLevel,
        container_snot: gameState.containerSnot,
        energy: gameState.energy,
        max_energy: gameState.maxEnergy,
        fusion_games_played: gameState.fusionGamesPlayed,
        fusion_attempts_used: gameState.fusionAttemptsUsed,
        last_fusion_game_time: gameState.lastFusionGameTime,
        highest_level: gameState.highestLevel,
      })
      .eq("user_id", userId)

    if (gameProgressError) throw gameProgressError

    console.log("User game state updated successfully")
  } catch (error) {
    console.error("Error updating user game state:", error)
    throw error
  }
}

export async function updateGameProgress(userId: string, progress: Partial<GameState>) {
  const { error } = await supabase.from("game_progress").update(progress).eq("user_id", userId)

  if (error) throw error
}

export async function createTransaction(
  userId: string,
  type: "SNOT_GAIN" | "SNOT_SPEND" | "COIN_GAIN" | "COIN_SPEND",
  amount: number,
  description: string,
) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type,
      amount,
      description,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function checkAchievement(userId: string, achievementName: string) {
  const { data: achievement, error: achievementError } = await supabase
    .from("achievements")
    .select()
    .eq("name", achievementName)
    .single()

  if (achievementError) throw achievementError

  const { data: existingAchievement, error: existingAchievementError } = await supabase
    .from("player_achievements")
    .select()
    .eq("user_id", userId)
    .eq("achievement_id", achievement.id)
    .single()

  if (existingAchievementError && existingAchievementError.code !== "PGRST116") {
    throw existingAchievementError
  }

  if (existingAchievement) return null // Achievement already earned

  const { data: playerAchievement, error: playerAchievementError } = await supabase
    .from("player_achievements")
    .insert({
      user_id: userId,
      achievement_id: achievement.id,
    })
    .select()
    .single()

  if (playerAchievementError) throw playerAchievementError
  return playerAchievement
}

export async function compareAndUpdateUserData(dbUser: any, telegramUser: any) {
  const updates: Partial<any> = {}

  if (dbUser.username !== telegramUser.username) updates.username = telegramUser.username
  if (dbUser.first_name !== telegramUser.first_name) updates.first_name = telegramUser.first_name
  if (dbUser.last_name !== telegramUser.last_name) updates.last_name = telegramUser.last_name
  if (dbUser.photo_url !== telegramUser.photo_url) updates.photo_url = telegramUser.photo_url
  if (dbUser.language_code !== telegramUser.language_code) updates.language_code = telegramUser.language_code

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("telegram_id", telegramUser.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  return dbUser
}

export async function getOrCreateUserGameState(telegramId: number): Promise<GameState> {
  const { data: existingState, error: fetchError } = await supabase
    .from("game_states")
    .select("*")
    .eq("telegram_id", telegramId)
    .single()

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("Error fetching game state:", fetchError)
    throw fetchError
  }

  if (existingState) {
    return existingState as GameState
  }

  // If no existing state, create a new one with default values
  const newState: Partial<GameState> = {
    telegram_id: telegramId,
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      Cap: 10,
      collectionEfficiency: 1.0,
    },
    containerLevel: 1,
    containerSnot: 0,
    energy: 100,
    maxEnergy: 100,
    fusionGamesPlayed: 0,
    fusionAttemptsUsed: 0,
    highestLevel: 1,
    // Add other default values as needed
  }

  const { data: createdState, error: createError } = await supabase
    .from("game_states")
    .insert(newState)
    .select()
    .single()

  if (createError) {
    console.error("Error creating new game state:", createError)
    throw createError
  }

  return createdState as GameState
}

export async function updateGameState(telegramId: number, updates: Partial<GameState>): Promise<void> {
  const { error } = await supabase.from("game_states").update(updates).eq("telegram_id", telegramId)

  if (error) {
    console.error("Error updating game state:", error)
    throw error
  }
}

export async function saveOrUpdateUser(user: User): Promise<User> {
  const { data, error } = await supabase
    .from("users")
    .upsert({
      telegram_id: user.telegram_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      photo_url: user.photo_url,
      language_code: user.language_code,
      auth_date: user.auth_date,
    })
    .select()
    .single()

  if (error) {
    console.error("Error saving/updating user:", error)
    throw error
  }

  return data
}

