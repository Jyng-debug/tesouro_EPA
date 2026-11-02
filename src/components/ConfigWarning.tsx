import { supabaseConfigured } from "@/integrations/supabase/client";

export function ConfigWarning() {
  if (supabaseConfigured) return null;
  return (
    <div role="alert" className="bg-destructive px-4 py-2 text-center font-semibold text-destructive-foreground">
      Configuração em falta: define VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local.
    </div>
  );
}
