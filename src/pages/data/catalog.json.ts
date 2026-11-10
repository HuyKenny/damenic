import type { APIRoute } from 'astro';
import { buildCatalog } from '@/lib/content';

// Static JSON built once; the cart and checkout read prices from here.
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildCatalog()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
