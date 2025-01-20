import type { NextApiRequest, NextApiResponse } from "next"
import { createNewUser } from "../../utils/db"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    console.log("Received registration request:", req.body)
    const { username, password } = req.body

    try {
      const newUser = await createNewUser({
        id: Date.now(), // Using timestamp as a simple unique ID
        username,
        first_name: username || "",
        last_name: "",
        photo_url: undefined,
      })

      console.log("User registered successfully:", newUser)
      res.status(200).json({ message: "User registered successfully", data: newUser })
    } catch (error) {
      console.error("Error registering user:", error)
      res.status(500).json({ error: "Error registering user" })
    }
  } else {
    res.setHeader("Allow", ["POST"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

