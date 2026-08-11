// Reveal-on-scroll
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach((el) => io.observe(el));

// Contact form -> FormSubmit (AJAX, falls back to a real POST if the request fails)
// Both paths land the user on thank-you.html — AJAX success redirects there directly,
// and the fallback real POST gets there via the form's _next field.
const form = document.getElementById('auditForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const business = form.business.value.trim();
    form._subject.value = `New Rain Revenue Report request — ${business}`;

    // Shared conversion ID so the Reddit Pixel event (fired on thank-you.html)
    // and this Conversions API call get deduplicated as one conversion by Reddit.
    const conversionId = crypto.randomUUID();
    form._next.value = `https://anchorhedger.com/thank-you.html?cid=${conversionId}`;

    // Server-side Reddit conversion event, fired here (not on thank-you.html) so we
    // have the actual submitted email/phone as match keys without putting PII in the URL.
    const capiPayload = JSON.stringify({
      conversionId,
      email: form.email.value,
      phone: form.phone.value,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/.netlify/functions/reddit-capi',
        new Blob([capiPayload], { type: 'application/json' })
      );
    } else {
      fetch('/.netlify/functions/reddit-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: capiPayload,
        keepalive: true,
      }).catch(() => {});
    }

    try {
      const endpoint = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error('FormSubmit request failed');
      window.location.href = `thank-you.html?cid=${conversionId}`;
    } catch (err) {
      // HTMLFormElement.submit() bypasses the 'submit' event, so this won't re-enter this handler
      form.submit();
    }
  });
}

// Hero story panel — the actual Anchor Hedger narration script, shown as a
// looping, captioned mock product walkthrough. Stage durations are measured
// from the real narration clip's silence gaps, not guessed from word counts,
// so the pacing reads naturally whether or not sound is turned on. Sound is
// opt-in (browsers block autoplaying audio with sound) via a toggle button.
(() => {
  const root = document.getElementById('storyAnim');
  if (!root) return;
  const captionEl = document.getElementById('storyCaption');
  const dotEls = document.querySelectorAll('#storyDots .process-dot');
  const audio = document.getElementById('storyAudio');
  const soundBtn = document.getElementById('storySoundBtn');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stages = [
    { key: 'forecast', duration: 2440, dot: 0, caption: "Bad weather doesn't just change the <em>forecast</em>." },
    { key: 'wipeout', duration: 4760, dot: 0, caption: 'For weather-sensitive businesses, it can <em>wipe out</em> one of the busiest days of the month.' },
    { key: 'protect', duration: 4880, dot: 1, caption: 'Anchor Hedger helps businesses <em>protect their revenue</em> before the rain begins.' },
    { key: 'analyze', duration: 3020, dot: 2, caption: "We'll help analyze the dates and operating hours that matter most." },
    { key: 'threshold', duration: 2760, dot: 2, caption: 'Then establish a <em>rainfall threshold</em> and a predetermined payout.' },
    { key: 'trigger', duration: 5340, dot: 2, caption: 'When rainfall occurs, the weather hedge is <em>triggered</em> — helping offset the financial impact of a rainy day.' },
    { key: 'steady', duration: 2080, dot: 3, caption: "Because unpredictable weather shouldn't mean <em>unpredictable revenue</em>." },
    { key: 'tagline', duration: 1080, dot: 3, caption: '<em>Anchor Hedger</em> — Protect your revenue from rain.' },
  ];

  function setDot(i) {
    dotEls.forEach((d, idx) => d.classList.toggle('active', idx === i));
  }

  function render(stage) {
    root.setAttribute('data-stage', stage.key);
    setDot(stage.dot);

    if (reduceMotion) {
      captionEl.innerHTML = stage.caption;
    } else {
      captionEl.classList.add('is-hidden');
      setTimeout(() => {
        captionEl.innerHTML = stage.caption;
        captionEl.classList.remove('is-hidden');
      }, 180);
    }
  }

  // ---- silent auto-loop (pauses while sound is on) ----
  let index = 0;
  let timer = null;
  let soundOn = false;

  function step() {
    render(stages[index]);
    timer = setTimeout(() => {
      index = (index + 1) % stages.length;
      step();
    }, stages[index].duration);
  }
  function startLoop() {
    if (timer || soundOn) return;
    step();
  }
  function stopLoop() {
    clearTimeout(timer);
    timer = null;
  }

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) startLoop();
    else stopLoop();
  }, { threshold: 0.2 }).observe(root);

  // ---- sound toggle, synced to the real audio's timeline ----
  if (audio && soundBtn) {
    const totalWeight = stages.reduce((sum, s) => sum + s.duration, 0);
    const cumulative = [];
    let acc = 0;
    stages.forEach((s) => { acc += s.duration; cumulative.push(acc); });

    function stageIndexForProgress(p) {
      const target = p * totalWeight;
      for (let i = 0; i < cumulative.length; i++) {
        if (target < cumulative[i]) return i;
      }
      return cumulative.length - 1;
    }

    let lastSyncedIndex = -1;

    audio.addEventListener('timeupdate', () => {
      if (!soundOn || !audio.duration) return;
      const idx = stageIndexForProgress(audio.currentTime / audio.duration);
      if (idx !== lastSyncedIndex) {
        lastSyncedIndex = idx;
        render(stages[idx]);
      }
    });

    function turnSoundOff() {
      soundOn = false;
      soundBtn.classList.remove('playing');
      soundBtn.setAttribute('aria-label', 'Turn sound on');
      soundBtn.setAttribute('aria-pressed', 'false');
      lastSyncedIndex = -1;
      startLoop();
    }
    audio.addEventListener('ended', turnSoundOff);

    soundBtn.addEventListener('click', () => {
      if (soundOn) {
        audio.pause();
        turnSoundOff();
        return;
      }
      stopLoop();
      soundOn = true;
      lastSyncedIndex = -1;
      soundBtn.classList.add('playing');
      soundBtn.setAttribute('aria-label', 'Turn sound off');
      soundBtn.setAttribute('aria-pressed', 'true');
      audio.currentTime = 0;
      audio.play().catch(() => turnSoundOff());
    });
  }

  startLoop();
})();

// Sticky CTA — show once past the hero, hide once the contact form is in view
const stickyCta = document.getElementById('stickyCta');
const contactSection = document.getElementById('contact');
const heroSection = document.querySelector('.hero');
if (stickyCta && contactSection && heroSection) {
  let heroVisible = true;
  let contactVisible = false;
  const refreshSticky = () => stickyCta.classList.toggle('show', !heroVisible && !contactVisible);

  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    refreshSticky();
  }).observe(heroSection);

  new IntersectionObserver(([entry]) => {
    contactVisible = entry.isIntersecting;
    refreshSticky();
  }, { threshold: 0.1 }).observe(contactSection);
}
