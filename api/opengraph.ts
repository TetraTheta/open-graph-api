import * as cheerio from 'cheerio';

export const runtime = 'edge'

export async function GET(req: Request) {
  const allowedOrigin = ['http://localhost:44', 'https://tetralog.onrender.com'];

  // 'Origin' is Forbidden Header Name, so it is immutable
  const origin = req.headers.get('origin');
  if (!origin || !allowedOrigin.includes(origin)) return new Response('Forbidden', { status: 403 });

  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response('Bad Request', { status: 400 });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not OK');
    const text = await response.text();
    const $ = cheerio.load(text);

    const getMetaContent = (names: string[]) => {
      for (const name of names) {
        const meta = $(`meta[name="${name}"]`).attr('content') || $(`meta[property="${name}"]`).attr('content');
        if (meta) return meta;
      }
      return '';
    };

    const title = getMetaContent(['title', 'og:title', 'twitter:title']);
    const desc = getMetaContent(['description', 'og:description', 'twitter:description']);
    const image = getMetaContent(['image', 'og:image', 'twitter:image']);

    const ogData = { title, desc, image };

    return new Response(JSON.stringify(ogData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600' // Cache the response in Vercel Edge
      },
    });
  } catch {
    return new Response('Error fetching Open Graph data', { status: 500 });
  }
}
