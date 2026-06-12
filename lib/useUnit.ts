'use client'

import { useEffect, useState } from 'react'
import type { Unit } from '@/lib/units'

const UNIT_STORAGE_KEY = 'distance-unit'

export function useUnit() {
  const [unit, setUnit] = useState<Unit>('mi')

  useEffect(() => {
    const stored = localStorage.getItem(UNIT_STORAGE_KEY)
    if (stored === 'km' || stored === 'mi') setUnit(stored)
  }, [])

  function changeUnit(next: Unit) {
    setUnit(next)
    localStorage.setItem(UNIT_STORAGE_KEY, next)
  }

  return { unit, changeUnit }
}
