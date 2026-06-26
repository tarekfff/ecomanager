'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface BoutiqueContextValue {
  boutiqueId: string
  boutiqueName: string
  setBoutique: (id: string, name: string) => void
}

const BoutiqueContext = createContext<BoutiqueContextValue>({
  boutiqueId: '',
  boutiqueName: '',
  setBoutique: () => {},
})

export function BoutiqueProvider({ children }: { children: ReactNode }) {
  const [boutiqueId, setBoutiqueId]     = useState('')
  const [boutiqueName, setBoutiqueName] = useState('')

  useEffect(() => {
    const savedId   = localStorage.getItem('boutiqueId')
    const savedName = localStorage.getItem('boutiqueName')
    if (savedId)   setBoutiqueId(savedId)
    if (savedName) setBoutiqueName(savedName)
  }, [])

  function setBoutique(id: string, name: string) {
    setBoutiqueId(id)
    setBoutiqueName(name)
    localStorage.setItem('boutiqueId', id)
    localStorage.setItem('boutiqueName', name)
  }

  return (
    <BoutiqueContext.Provider value={{ boutiqueId, boutiqueName, setBoutique }}>
      {children}
    </BoutiqueContext.Provider>
  )
}

export function useBoutique() {
  return useContext(BoutiqueContext)
}
