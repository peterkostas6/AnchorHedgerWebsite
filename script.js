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
const form = document.getElementById('auditForm');
const formSuccess = document.getElementById('formSuccess');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const business = form.business.value.trim();
    form._subject.value = `New Rain Revenue Report request — ${business}`;

    try {
      const endpoint = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error('FormSubmit request failed');
      form.hidden = true;
      if (formSuccess) formSuccess.hidden = false;
    } catch (err) {
      // HTMLFormElement.submit() bypasses the 'submit' event, so this won't re-enter this handler
      form.submit();
    }
  });
}

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
