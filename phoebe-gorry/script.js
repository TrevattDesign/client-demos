/* ============================================================
   Phoebe Gorry — script.js
   1. Announce bar dismiss + header offset adjustment
   2. Header: transparent over hero, solid on scroll
   3. FAQ accordion
   4. Scroll reveal (IntersectionObserver)
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. ANNOUNCE BAR
     ---------------------------------------------------------- */
  const announceBar  = document.getElementById('announceBar');
  const announceClose = document.getElementById('announceClose');
  const header       = document.getElementById('header');

  function dismissAnnounce() {
    if (!announceBar) return;
    announceBar.classList.add('hidden');
    header.classList.add('announce-gone');
    // Recalculate scroll state immediately
    checkScroll();
  }

  if (announceClose) {
    announceClose.addEventListener('click', dismissAnnounce);
  }

  /* ----------------------------------------------------------
     2. HEADER SCROLL BEHAVIOUR
     ---------------------------------------------------------- */
  function checkScroll() {
    if (!header) return;
    const heroHeight = document.querySelector('.hero')
      ? document.querySelector('.hero').offsetHeight
      : 200;
    if (window.scrollY > heroHeight * 0.15) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();

  /* ----------------------------------------------------------
     3. FAQ ACCORDION
     ---------------------------------------------------------- */
  const faqButtons = document.querySelectorAll('.faq-q');

  faqButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      const answer   = this.nextElementSibling;

      // Close all others
      faqButtons.forEach(function (other) {
        if (other !== btn) {
          other.setAttribute('aria-expanded', 'false');
          const otherAnswer = other.nextElementSibling;
          if (otherAnswer) otherAnswer.hidden = true;
        }
      });

      // Toggle this one
      this.setAttribute('aria-expanded', String(!expanded));
      if (answer) answer.hidden = expanded;
    });
  });

  /* ----------------------------------------------------------
     4. SCROLL REVEAL
     ---------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealEls.length > 0) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show all immediately
    revealEls.forEach(function (el) {
      el.classList.add('visible');
    });
  }

})();
