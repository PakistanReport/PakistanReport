(function () {
  'use strict';
  if (window.pakistanReportConsentUIInstalled) return;
  window.pakistanReportConsentUIInstalled = true;
  const key = 'pakistan-report.analytics-choice.v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const notice = document.getElementById('pr-analytics-notice');
  const status = document.getElementById('pr-analytics-status');
  const allow = document.getElementById('pr-analytics-allow');
  const decline = document.getElementById('pr-analytics-decline');
  if (!notice || !status || !allow || !decline) return;
  let timer, expiresAt = 0, returnFocus = null;

  function readChoice() {
    try {
      const value = JSON.parse(window.localStorage.getItem(key));
      if (value && typeof value.granted === 'boolean' && Number.isFinite(value.expiresAt) &&
          value.expiresAt > Date.now() && value.expiresAt <= Date.now() + lifetime) return value;
    } catch (_) { /* Storage unavailable or invalid: default to no consent. */ }
    return null;
  }

  function clearAnalyticsCookies() {
    try {
    // Only GA4 first-party analytics cookies, never unrelated site cookies.
    const names = document.cookie.split(';').map(c => c.trim().split('=')[0])
      .filter(name => name === '_ga' || /^_ga_[A-Za-z0-9]+$/.test(name));
    const paths = new Set(['/']);
    const parts = window.location.pathname.split('/').filter(Boolean);
    while (parts.length) { paths.add('/' + parts.join('/')); paths.add('/' + parts.join('/') + '/'); parts.pop(); }
    const domains = [''];
    const labels = window.location.hostname.split('.');
    for (let i=0; i<labels.length-1; i++) {
      const domain = labels.slice(i).join('.');
      domains.push('; Domain=' + domain, '; Domain=.' + domain);
    }
    for (const name of names) for (const path of paths) for (const domain of domains) {
      document.cookie = name + '=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=' + path + domain + '; SameSite=Lax; Secure';
    }
    } catch (_) { /* Browser restrictions may make cookies inaccessible. */ }
  }

  function signal(granted) {
    window.pakistanReportAnalyticsConsent = granted;
    window.dispatchEvent(new CustomEvent('pakistan-report:analytics-consent', {detail:{granted}}));
  }

  function scheduleExpiry() {
    clearTimeout(timer);
    if (!expiresAt) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      expiresAt = 0;
      try { window.localStorage.removeItem(key); } catch (_) {}
      clearAnalyticsCookies();
      notice.hidden = false;
      status.textContent = 'Your previous choice has expired. Analytics is off until you allow it again.';
      signal(false);
      return;
    }
    timer = setTimeout(scheduleExpiry, Math.min(remaining, 2147483647));
  }

  function apply(value) {
    expiresAt = value ? value.expiresAt : 0;
    const granted = !!value && value.granted;
    if (!granted) clearAnalyticsCookies();
    notice.hidden = !!value;
    status.textContent = value ? (granted ? 'Current choice: analytics allowed.' : 'Current choice: analytics declined.') : '';
    signal(granted);
    scheduleExpiry();
  }

  function choose(granted) {
    const value = {granted, expiresAt:Date.now() + lifetime};
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) {
      // Remove a stale previous grant if replacing the choice fails.
      try { window.localStorage.removeItem(key); } catch (_) {}
      // Choice still works for this page; storage restrictions can prevent persistence.
    }
    apply(value);
    if (returnFocus) returnFocus.focus();
  }
  allow.addEventListener('click', () => choose(true));
  decline.addEventListener('click', () => choose(false));
  document.querySelectorAll('.pr-analytics-preferences').forEach(button => {
    button.addEventListener('click', () => {
      returnFocus = button;
      notice.hidden = false;
      allow.focus();
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(readChoice());
  });
  window.addEventListener('pageshow', () => apply(readChoice()));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') apply(readChoice());
  });
  apply(readChoice());
}());
