import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  if (!id) {
    return res.status(400).json({ error: "User ID is required" })
  }

  try {
    // In a real-world scenario, you would make an API call to Telegram here
    // For this example, we'll return mock data
    const mockUser = {
      id: Number.parseInt(id as string, 10),
      first_name: "Updated First Name",
      last_name: "Updated Last Name",
      username: "updated_username",
      language_code: "en",
      photo_url: "https://example.com/updated_photo.jpg",
      auth_date: Math.floor(Date.now() / 1000),
    }

    res.status(200).json(mockUser)
  } catch (error) {
    console.error("Error fetching user data:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

