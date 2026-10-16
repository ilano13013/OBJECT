/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEMORY_ROUTER: boolean
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
