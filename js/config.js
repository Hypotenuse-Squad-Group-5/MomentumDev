/* =====================================================================
   Momentum: configuration

   To connect the vertical slice to Supabase:
     1. Supabase dashboard > Project Settings > API (or "API Keys")
     2. Copy the Project URL and the anon / publishable key into the two lines below.
     3. Save, reload the site. The "Saved to" badge on the Post-an-activity
        page will switch from "this browser" to "Supabase".

   Leave them empty and the site runs in demo mode (saved in this browser only).

   NEVER paste the service_role / secret key here. It bypasses all security.
   ===================================================================== */
window.MOMENTUM_CONFIG = {
  SUPABASE_URL: "",       // e.g. "https://abcdefghijkl.supabase.co"
  SUPABASE_ANON_KEY: "",  // starts with "eyJ..." or "sb_publishable_..."
};
