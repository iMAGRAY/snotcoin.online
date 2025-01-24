"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "../utils/supabase"

const fetchData = async () => {
  const { data, error } = await supabase.from("your_table").select("*")

  if (error) {
    console.error("Error fetching data:", error)
    return null
  }

  return data
}

export default function MyComponent() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const fetchAndSetData = async () => {
      const fetchedData = await fetchData()
      setData(fetchedData)
    }

    fetchAndSetData()
  }, [])

  return <div>{data && <pre>{JSON.stringify(data, null, 2)}</pre>}</div>
}

