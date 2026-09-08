/* global Response, Request, console, process */

import assert from 'node:assert/strict';
import { GET } from '../api/opengraph.ts';

const ORIGIN = 'http://localhost:44';
const live = process.argv.includes('--live');
const verbose = process.argv.includes('-v') || process.argv.includes('--verbose');
const liveUrls = [
  'https://google.com',
  'https://youtu.be/7ah2b2Ys4S0',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=3793315247',
];

function showExpectedAndReceived(name, expected, received) {
  if (!verbose) return;

  console.log(`\n${name}`);
  console.log('expected:', JSON.stringify(expected, null, 2));
  console.log('received:', JSON.stringify(received, null, 2));
}

function assertEqual(name, received, expected) {
  showExpectedAndReceived(name, expected, received);
  assert.deepEqual(received, expected);
}

async function callOpenGraph(targetUrl) {
  const requestUrl = `http://localhost/api/opengraph?url=${encodeURIComponent(targetUrl)}`;
  return GET(new Request(requestUrl, { headers: { origin: ORIGIN } }));
}

async function fetchMockedOpenGraph(targetUrl, html) {
  const response = await fetchMockedOpenGraphResponse(targetUrl, html);
  return response.json();
}

async function fetchMockedOpenGraphResponse(targetUrl, html) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, targetUrl);
    return new Response(html, { status: 200 });
  };

  try {
    const response = await callOpenGraph(targetUrl);
    assert.equal(response.status, 200);
    return response;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function showLiveOpenGraph(targetUrl) {
  try {
    const response = await callOpenGraph(targetUrl);
    const body = response.ok ? await response.json() : await response.text();

    console.log(`\nLive Open Graph result: ${targetUrl}`);
    console.log('status:', response.status);
    console.log(JSON.stringify(body, null, 2));
  } catch (error) {
    console.log(`\nLive Open Graph result unavailable: ${targetUrl}`);
    console.log(error instanceof Error ? error.message : error);
  }
}

const genericOgData = await fetchMockedOpenGraph(
  'https://example.test/page',
  `
    <meta property="og:title" content="Generic OG title">
    <meta property="og:description" content="Generic OG description">
    <meta property="og:image" content="https://example.test/image.jpg">
  `,
);

assertEqual('Generic Open Graph meta tags', genericOgData, {
  title: 'Generic OG title',
  desc: 'Generic OG description',
  image: 'https://example.test/image.jpg',
});

const twitterFallbackData = await fetchMockedOpenGraph(
  'https://youtu.be/7ah2b2Ys4S0',
  `
    <meta name="twitter:title" content="YouTube-style title">
    <meta name="twitter:description" content="YouTube-style description">
    <meta name="twitter:image" content="https://example.test/youtube.jpg">
  `,
);

assertEqual('Twitter meta fallback', twitterFallbackData, {
  title: 'YouTube-style title',
  desc: 'YouTube-style description',
  image: 'https://example.test/youtube.jpg',
});

const steamUrl = 'https://steamcommunity.com/sharedfiles/filedetails/?id=3793315247';

const steamData = await fetchMockedOpenGraph(
  steamUrl,
  `
    <meta property="og:title" content="Steam Workshop::Station 51">
    <meta property="og:image" content="https://example.test/steam.jpg">
    <div class="workshopItemDescription">
      <div class="bb_h1">Station 51</div>
      <b>bold intro</b><br>
      [b]raw bold[/b]
      [url=https://example.test]example link[/url]
      <ul><li>first item</li><li>second item</li></ul>
    </div>
  `,
);

assertEqual('Steam Workshop body fallback', steamData, {
  title: 'Steam Workshop::Station 51',
  desc: 'Station 51 bold intro [b]raw bold[/b] [url=https://example.test]example link[/url] first item second item',
  image: 'https://example.test/steam.jpg',
});

const metaDescriptionData = await fetchMockedOpenGraph(
  steamUrl,
  `
    <meta property="og:description" content="Meta description wins">
    <div class="workshopItemDescription">Body fallback loses</div>
  `,
);

assertEqual('Meta description priority', metaDescriptionData.desc, 'Meta description wins');

const otherSiteData = await fetchMockedOpenGraph(
  'https://example.test/page',
  '<div class="workshopItemDescription">Not a Steam fallback</div>',
);

assertEqual('Non-Steam page without meta description', otherSiteData.desc, '');

const corsResponse = await fetchMockedOpenGraphResponse(
  'https://example.test/cors',
  '<meta property="og:title" content="CORS cache">',
);

assertEqual('CORS origin response header', corsResponse.headers.get('Access-Control-Allow-Origin'), ORIGIN);
assertEqual('CORS cache varies by origin', corsResponse.headers.get('Vary'), 'Origin');

const forbiddenResponse = await GET(new Request('http://localhost/api/opengraph?url=https%3A%2F%2Fexample.test'));

assertEqual('Forbidden response is not cached', forbiddenResponse.headers.get('Cache-Control'), 'no-store');
assertEqual('Forbidden cache varies by origin', forbiddenResponse.headers.get('Vary'), 'Origin');

if (live) {
  for (const url of liveUrls) {
    await showLiveOpenGraph(url);
  }
}

console.log('Open Graph API tests passed.');
