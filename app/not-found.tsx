import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
      <h2 className="text-3xl font-bold mb-2">Página no encontrada</h2>
      <p className="text-muted-foreground mb-6">Lo sentimos, no pudimos encontrar la página que buscas.</p>
      <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Inicio
        </Link>
      </Button>
    </div>
  )
}
