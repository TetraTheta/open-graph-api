import * as cheerio from 'cheerio';

export const runtime = 'edge';

const STEAM_WORKSHOP_HOST = 'steamcommunity.com';
const STEAM_WORKSHOP_PATH = '/sharedfiles/filedetails/';

function getMetaContent($: cheerio.CheerioAPI, names: string[]): string {
  for (const name of names) {
    const meta = $(`meta[name="${name}"]`).attr('content') || $(`meta[property="${name}"]`).attr('content');
    if (meta) return meta;
  }
  return '';
}

function isSteamWorkshopUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === STEAM_WORKSHOP_HOST && parsedUrl.pathname === STEAM_WORKSHOP_PATH;
  } catch {
    return false;
  }
}

function getSteamWorkshopDescription($: cheerio.CheerioAPI): string {
  const description = $('.workshopItemDescription').first().clone();
  description.find('br, hr').replaceWith(' ');
  description.find('div, li, p').append(' ');
  return description.text().replace(/\s+/g, ' ').trim();
}

export async function GET(req: Request) {
  const allowedOrigin = ['http://localhost:44', 'https://gmoddocs.readthedocs.io', 'https://tetralog.onrender.com'];

  // 'Origin' is Forbidden Header Name, so it is immutable
  const origin = req.headers.get('origin');
  if (!origin || !allowedOrigin.includes(origin)) {
    return new Response('Forbidden', {
      status: 403,
      headers: {
        'Cache-Control': 'no-store',
        Vary: 'Origin',
      },
    });
  }

  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response('Bad Request', { status: 400 });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not OK');
    const text = await response.text();
    const $ = cheerio.load(text);

    const title = getMetaContent($, ['title', 'og:title', 'twitter:title']);
    const metaDesc = getMetaContent($, ['description', 'og:description', 'twitter:description']);
    const desc = metaDesc || (isSteamWorkshopUrl(url) ? getSteamWorkshopDescription($) : '');
    const image = getMetaContent($, ['image', 'og:image', 'twitter:image']);

    const ogData = { title, desc, image };

    return new Response(JSON.stringify(ogData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600', // Cache the response in Vercel Edge
        Vary: 'Origin',
      },
    });
  } catch {
    return new Response('Error fetching Open Graph data', { status: 500 });
  }
}
