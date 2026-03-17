/* ============================================================
   Jack Brenman — script.js
   Motion language: "Unhurried emergence — content appears as
   if slowly becoming visible, gentle and assured."
   ============================================================ */

(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     IMAGE ERROR HANDLERS
     Wired up immediately (before DOMContentLoaded) so they
     catch errors on images that load early.
     ---------------------------------------------------------- */
  function wireImageErrors() {
    document.querySelectorAll('img').forEach(function (img) {
      img.onerror = function () {
        var ph = document.createElement('div');
        ph.setAttribute('role', 'img');
        ph.setAttribute('aria-label', 'Image placeholder');
        ph.style.cssText = [
          'background:#FFF3CD',
          'color:#856404',
          'font-family:sans-serif',
          'font-size:0.8rem',
          'padding:1.25rem',
          'border:1px dashed #ffc107',
          'border-radius:4px',
          'min-height:80px',
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'text-align:center',
          'width:100%'
        ].join(';');
        ph.textContent = 'PLACEHOLDER \u2014 image could not be loaded';
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
      };
    });
  }

  wireImageErrors();

  /* ----------------------------------------------------------
     DOMCONTENTLOADED
     ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {

    /* 1. HEADER ENTRANCE — slide in from -68px
       -------------------------------------------------- */
    var header = document.getElementById('header');

    if (header) {
      requestAnimationFrame(function () {
        header.classList.add('ready');
      });

      /* 2. HEADER SCROLL BEHAVIOUR
         -------------------------------------------------- */
      function updateHeader() {
        if (window.scrollY > 70) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }

      window.addEventListener('scroll', updateHeader, { passive: true });
      updateHeader();
    }

    /* If reduced motion, stop here — no scroll animations */
    if (prefersReduced) return;

    /* 3. HERO WORD-BY-WORD REVEAL
       Split h1 words into animated spans, preserving
       any child elements (e.g. .hero-em italic span).
       -------------------------------------------------- */
    var heroH1 = document.querySelector('.hero-h1');
    if (heroH1) {
      var wordIndex = 0;

      function splitNodeWords(node, container) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent.split(/(\s+)/).forEach(function (chunk) {
            if (/^\s+$/.test(chunk)) {
              container.appendChild(document.createTextNode(chunk));
            } else if (chunk) {
              var span = document.createElement('span');
              span.className = 'word';
              span.textContent = chunk;
              span.style.animationDelay = (wordIndex * 55) + 'ms';
              container.appendChild(span);
              wordIndex++;
            }
          });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          var clone = document.createElement(node.tagName);
          node.className && (clone.className = node.className);
          Array.from(node.childNodes).forEach(function (child) {
            splitNodeWords(child, clone);
          });
          container.appendChild(clone);
        }
      }

      var fragment = document.createDocumentFragment();
      Array.from(heroH1.childNodes).forEach(function (node) {
        splitNodeWords(node, fragment);
      });
      heroH1.textContent = '';
      heroH1.appendChild(fragment);
    }

    /* 4. HERO SUB-ELEMENTS STAGGER (label, sub, foot)
       -------------------------------------------------- */
    var heroSubs = [
      document.querySelector('.hero-label'),
      document.querySelector('.hero-sub'),
      document.querySelector('.hero-foot')
    ];

    heroSubs.forEach(function (el, i) {
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(14px)';
      el.style.transition = [
        'opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94)',
        'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)'
      ].join(',');
      el.style.transitionDelay = ((i + 1) * 200 + 350) + 'ms';
      requestAnimationFrame(function () {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    });

    /* 5. SECTION HEADING WORD SPLITS
       Applied to all h2 elements outside the hero.
       Words start invisible; triggered by observer.
       -------------------------------------------------- */
    function splitH2Words(h2) {
      if (h2._wordSplit) return;
      h2._wordSplit = true;
      var words = h2.textContent.trim().split(/\s+/);
      h2.textContent = '';
      words.forEach(function (w, i) {
        var span = document.createElement('span');
        span.className = 'word';
        span.textContent = w;
        span.style.opacity = '0';
        span.style.animation = 'none';
        h2.appendChild(span);
        if (i < words.length - 1) h2.appendChild(document.createTextNode(' '));
      });
    }

    function triggerH2(h2) {
      if (!h2._wordSplit) splitH2Words(h2);
      h2.querySelectorAll('.word').forEach(function (span, i) {
        span.style.animation = 'wordIn 0.42s cubic-bezier(0.25,0.46,0.45,0.94) ' + (i * 58) + 'ms forwards';
      });
    }

    document.querySelectorAll('h2').forEach(function (h2) {
      splitH2Words(h2);
    });

    /* 6. SECTION-LEVEL INTERSECTION OBSERVER
       -------------------------------------------------- */
    var sectionTargets = [
      '.recog-head',
      '.about-aside',
      '.about-text',
      '.pull-quote',
      '.approach .eyebrow',
      '.approach h2',
      '.approach-lead',
      '.specialisms .eyebrow',
      '.specialisms h2',
      '.spec-lead',
      '.fees .eyebrow-lt',
      '.fees-h2',
      '.fee-panel',
      '.consult-panel',
      '.contact-left',
      '.contact-form'
    ];

    sectionTargets.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.classList.contains('about-aside')) {
          el.classList.add('reveal-left');
        } else {
          el.classList.add('reveal');
        }
      });
    });

    var sectionObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('in');
        el.querySelectorAll('h2').forEach(triggerH2);
        if (el.tagName === 'H2') triggerH2(el);
        sectionObs.unobserve(el);
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal, .reveal-left').forEach(function (el) {
      sectionObs.observe(el);
    });

    /* Standalone h2s (not inside a .reveal container) */
    document.querySelectorAll('h2').forEach(function (h2) {
      if (!h2.closest('.reveal, .reveal-left')) {
        var h2Obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            triggerH2(entry.target);
            h2Obs.unobserve(entry.target);
          });
        }, { threshold: 0.2 });
        h2Obs.observe(h2);
      }
    });

    /* 7. STAGGERED CARD ANIMATIONS
       recog-card, modality, spec-col
       -------------------------------------------------- */
    function staggerItems(selector, delayMs) {
      var items = document.querySelectorAll(selector);
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var siblings = Array.prototype.slice.call(entry.target.parentElement.children);
          var idx = siblings.indexOf(entry.target);
          entry.target.style.transitionDelay = (idx * delayMs) + 'ms';
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.07 });
      items.forEach(function (item) { obs.observe(item); });
    }

    staggerItems('.recog-card', 90);
    staggerItems('.modality',   110);
    staggerItems('.spec-col',   80);
    staggerItems('.cpill',      70);

    /* 8. PARALLAX ON IMAGE STRIP (ambient continuous)
       Slow vertical drift tied to scroll position.
       -------------------------------------------------- */
    var stripImg = document.querySelector('.strip-img');
    if (stripImg) {
      function updateParallax() {
        var rect = stripImg.getBoundingClientRect();
        var progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        var offset = (progress - 0.5) * 28;
        stripImg.style.transform = 'scale(1.05) translateY(' + offset + 'px)';
      }
      window.addEventListener('scroll', updateParallax, { passive: true });
      updateParallax();
    }

  });

}());
