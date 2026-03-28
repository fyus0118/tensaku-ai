export async function GET() {
  return Response.json({
    supabase_url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_url_prefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20),
    anon_key_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anon_key_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
    app_url: process.env.NEXT_PUBLIC_APP_URL,
  });
}
