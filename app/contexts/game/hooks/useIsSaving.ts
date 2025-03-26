import { useContext } from 'react'
import { IsSavingContext } from '../contexts'

export function useIsSaving(): boolean {
  return useContext(IsSavingContext)
} 