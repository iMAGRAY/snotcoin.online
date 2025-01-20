import type React from "react"
import { useState } from "react"

const MyForm = () => {
  const [userData, setUserData] = useState({
    username: "",
    email: "",
    password: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData({ ...userData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Submitting user data:", userData)
    console.log("Sending user data:", userData) // Added debug log
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })
      if (!response.ok) {
        throw new Error("Network response was not ok")
      }
      const data = await response.json()
      console.log("Server response:", data)
      // Handle successful registration
    } catch (error) {
      console.error("Error during registration:", error)
      // Handle error
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Username:
        <input type="text" name="username" value={userData.username} onChange={handleChange} />
      </label>
      <label>
        Email:
        <input type="email" name="email" value={userData.email} onChange={handleChange} />
      </label>
      <label>
        Password:
        <input type="password" name="password" value={userData.password} onChange={handleChange} />
      </label>
      <button type="submit">Register</button>
    </form>
  )
}

export default MyForm

