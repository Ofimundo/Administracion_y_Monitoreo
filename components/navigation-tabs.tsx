// components/navigation-tabs.tsx (componente del lado del cliente)
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function NavigationTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab") || "dashboard"

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value === "dashboard") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    router.push(`/?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full max-w-2xl grid-cols-3">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="comparison">Comparador de Clientes</TabsTrigger>
        <TabsTrigger value="commands">Centro de Comandos</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}