// app/components/command-center.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, Sparkles } from "lucide-react";

export function CommandCenter() {
  return (
    <div className="py-12 flex items-center justify-center">
      <Card className="w-full max-w-lg border border-amber-500/30 bg-card/80 backdrop-blur shadow-xl text-center">
        <CardContent className="py-12 px-6 flex flex-col items-center space-y-4">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Terminal className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium px-3 py-1 text-xs">
              <Sparkles className="mr-1 h-3 w-3 inline-block" />
              PRÓXIMAMENTE
            </Badge>

            <h2 className="text-2xl font-bold text-foreground">
              Centro de Comandos
            </h2>

            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Este módulo estará disponible próximamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}