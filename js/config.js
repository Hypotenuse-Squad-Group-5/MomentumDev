/* =====================================================================
   Momentum: configuration

   To connect the vertical slice to Supabase:
     1. Supabase dashboard > Project Settings > API (or "API Keys")
     2. Copy the Project URL and the anon / publishable key into the two lines below.
     3. Save, reload the site. The "Saved to" badge on the Post-an-activity
        page will switch from "this browser" to "Supabase".

   Both are required. Without them the app shows a "not connected to Supabase" message.

   NEVER paste the service_role / secret key here. It bypasses all security.
   ===================================================================== */
window.MOMENTUM_CONFIG = {
  SUPABASE_URL: "https://gwqbuaeufzimqvtdvpdj.supabase.co",       // e.g. "https://abcdefghijkl.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_dkqoynEhd7wC7vFoQVhTYA_Vfu6vyjI",  // starts with "eyJ..." or "sb_publishable_..."
};
