import type { APIRoute } from 'astro';
import { recipeIndex } from '@/lib/content';

// Static index behind the recipe filters on /recepty/ (fetched by the island on first use, not part of the HTML).
export const GET: APIRoute = async () => new Response(JSON.stringify(await recipeIndex()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
