(() => {
  const cacheDuration = 12 * 60 * 60 * 1000;
  const requestTimeout = 4000;
  const links = document.querySelectorAll('.publication .links a');

  async function fetchJSON(url) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Star request failed');
          return response.json();
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Star request timed out'));
          }, requestTimeout);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function showStars(link) {
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)\/?$/i.exec(link.href);
    if (!match || link.textContent.trim() !== 'Code') return;

    const repository = `${match[1]}/${match[2]}`;
    const cacheKey = `github-stars:${repository.toLowerCase()}`;
    let count;
    let cachedCount;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached && Number.isFinite(cached.time) && cached.time <= Date.now() &&
          ((Number.isInteger(cached.count) && cached.count >= 0) ||
           (typeof cached.count === 'string' && /^[\d,.]+[kKmM]?$/.test(cached.count)))) {
        cachedCount = cached.count;
        if (Date.now() - cached.time < cacheDuration) count = cachedCount;
      }
    } catch (_) { /* Storage may be unavailable. */ }

    if (count === undefined) {
      try {
        const repo = await fetchJSON(`https://api.github.com/repos/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`);
        if (Number.isInteger(repo.stargazers_count) && repo.stargazers_count >= 0) count = repo.stargazers_count;
      } catch (_) { /* Try the fallback below. */ }
      if (count === undefined) {
        try {
          const badge = await fetchJSON(`https://img.shields.io/github/stars/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}.json`);
          if (!badge.isError && typeof badge.message === 'string' && /^[\d,.]+[kKmM]?$/.test(badge.message)) count = badge.message;
        } catch (_) { /* Use an older cached value if available. */ }
      }
      if (count !== undefined) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ count, time: Date.now() })); } catch (_) { /* Optional cache. */ }
      } else {
        count = cachedCount;
      }
    }

    if (count === undefined) return;
    const stars = document.createElement('span');
    stars.className = 'github-stars';
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', `${count.toLocaleString('en-US')} GitHub stars`);
    stars.textContent = `★ ${count.toLocaleString('en-US')}`;
    link.append(stars);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          showStars(entry.target);
        }
      }
    }, { rootMargin: '200px' });
    links.forEach((link) => observer.observe(link));
  } else {
    links.forEach(showStars);
  }
})();
