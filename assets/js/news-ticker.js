(() => {
  const ticker = document.querySelector('.news-ticker');
  if (!ticker) return;
  const track = ticker.querySelector('.news-ticker-track');
  const viewport = ticker.querySelector('.news-ticker-window');
  const pause = ticker.querySelector('button');
  let signature = '';
  let items = [];
  let controller;
  function measure() {
    const copy = track.querySelector('.news-ticker-copy');
    if (!copy) return;
    const distance = copy.offsetLeft - track.firstElementChild.offsetLeft;
    track.style.setProperty('--ticker-distance', `${distance}px`);
    track.style.setProperty('--ticker-duration', `${Math.max(40, distance / 40)}s`);
  }
  function render() {
    const now = Date.now();
    items = items.filter(item => Date.parse(item.expires_at) > now);
    ticker.hidden = items.length === 0;
    const next = JSON.stringify(items);
    if (signature === next) return;
    signature = next;
    track.replaceChildren();
    for (const copy of [false, true]) {
      for (const item of items) {
        const text = document.createElement('p');
        text.className = 'news-ticker-item' + (copy ? ' news-ticker-copy' : '');
        text.textContent = item.text;
        if (copy) text.setAttribute('aria-hidden', 'true');
        track.append(text);
      }
    }
    viewport.scrollLeft = 0;
    requestAnimationFrame(measure);
  }
  async function refresh() {
    controller?.abort();
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(ticker.dataset.feed, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Feed unavailable');
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error('Invalid feed');
      items = data.items.filter(item => typeof item.text === 'string' &&
        item.text.length <= 600 && Number.isFinite(Date.parse(item.expires_at)));
    } catch {
      // Existing items remain visible only until their recorded expiry.
    } finally {
      clearTimeout(timeout);
      render();
    }
  }
  pause.addEventListener('click', () => {
    const paused = ticker.classList.toggle('is-paused');
    pause.textContent = paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-pressed', String(paused));
  });
  new ResizeObserver(measure).observe(viewport);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  setInterval(render, 10000);
})();
