export interface Chest {
  id: number
  name: string
  image: string
  requiredSnot: number
  reward: () => number
  description: string
}

// Add any other storage-related types here if needed

