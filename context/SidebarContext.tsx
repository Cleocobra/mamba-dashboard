'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface SidebarCtx {
  isOpen:       boolean
  openSidebar:  () => void
  closeSidebar: () => void
  toggleSidebar:() => void
}

const Ctx = createContext<SidebarCtx>({
  isOpen: false,
  openSidebar:  () => {},
  closeSidebar: () => {},
  toggleSidebar:() => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const openSidebar   = useCallback(() => setIsOpen(true),  [])
  const closeSidebar  = useCallback(() => setIsOpen(false), [])
  const toggleSidebar = useCallback(() => setIsOpen(v => !v), [])

  return (
    <Ctx.Provider value={{ isOpen, openSidebar, closeSidebar, toggleSidebar }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSidebar = () => useContext(Ctx)
