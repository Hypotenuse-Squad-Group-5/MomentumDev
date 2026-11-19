// Admin › Accounts › "Add user". The logic is in handler.mjs (tested with Node).
// Deploy: supabase functions deploy admin-create-user
import { createHandler } from './handler.mjs';

Deno.serve(createHandler({ env: (name: string) => Deno.env.get(name) }));
