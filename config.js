// Verbindung zur Datenbank. Leer lassen = Demo-Modus (Daten nur auf diesem Gerät).
// Beide Werte stehen in Supabase unter Project Settings → API. Sie sind öffentlich
// gedacht; geschützt werden die Daten durch Login und Row Level Security.
export const CONFIG = {
  supabaseUrl: "",          // z. B. "https://abcdefgh.supabase.co"
  supabaseKey: "",          // "anon public" bzw. "publishable" Schlüssel
  teamId: "e-junioren"
};
