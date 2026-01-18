import { defineMiddleware } from 'astro:middleware';

// Cache TTL configuration (in seconds)
const CACHE_CONFIG = {
  '/': { sMaxAge: 300, staleWhileRevalidate: 3600 }, // 5m edge, 1h stale
  '/repo/': { sMaxAge: 300, staleWhileRevalidate: 3600 }, // 5m edge, 1h stale
  '/compare': { sMaxAge: 300, staleWhileRevalidate: 3600 }, // 5m edge, 1h stale
};

const BROWSER_MAX_AGE = 60; // 1 minute browser cache for all HTML

function getCacheConfig(pathname: string): { sMaxAge: number; staleWhileRevalidate: number } | null {
  // Exact match for home
  if (pathname === '/') {
    return CACHE_CONFIG['/'];
  }
  
  // Prefix match for repo pages
  if (pathname.startsWith('/repo/')) {
    return CACHE_CONFIG['/repo/'];
  }
  
  // Compare page (with or without query)
  if (pathname === '/compare' || pathname.startsWith('/compare?')) {
    return CACHE_CONFIG['/compare'];
  }
  
  return null;
}

function buildCacheControlHeader(sMaxAge: number, staleWhileRevalidate: number): string {
  return `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  const url = new URL(request.url);
  
  // Only cache GET requests
  if (request.method !== 'GET') {
    return next();
  }
  
  // Skip non-HTML routes (API, badge, static assets)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/badge/') ||
    url.pathname.startsWith('/_astro/') ||
    url.pathname.includes('.')
  ) {
    return next();
  }
  
  const cacheConfig = getCacheConfig(url.pathname);
  
  // If this route doesn't have cache config, skip
  if (!cacheConfig) {
    return next();
  }
  
  // Try to use Cloudflare Workers cache API if available
  const cache = (globalThis as any).caches?.default;
  
  if (cache) {
    // Try to get from edge cache
    const cacheKey = new Request(url.toString(), request);
    const cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse) {
      // Return cached response
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: cachedResponse.headers,
      });
    }
    
    // Cache miss - proceed with SSR
    const response = await next();
    
    // Only cache successful responses
    if (response.status === 200) {
      // Clone response for caching
      const responseToCache = response.clone();
      
      // Set cache headers
      const headers = new Headers(responseToCache.headers);
      headers.set(
        'Cache-Control',
        buildCacheControlHeader(cacheConfig.sMaxAge, cacheConfig.staleWhileRevalidate)
      );
      headers.set('Vary', 'Accept-Encoding');
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      
      // Store in edge cache (fire and forget)
      context.locals.runtime?.waitUntil?.(cache.put(cacheKey, cachedResponse));
      
      // Return response with cache headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    
    return response;
  }
  
  // If no cache API available (local dev), just set headers
  const response = await next();
  
  if (response.status === 200) {
    const headers = new Headers(response.headers);
    headers.set(
      'Cache-Control',
      buildCacheControlHeader(cacheConfig.sMaxAge, cacheConfig.staleWhileRevalidate)
    );
    headers.set('Vary', 'Accept-Encoding');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  
  return response;
});
