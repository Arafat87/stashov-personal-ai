(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const error = document.getElementById('unlockError');
  if (error && params.get('error') === '1') error.hidden = false;
  const next = document.getElementById('unlockNext');
  const requested = params.get('next');
  if (next && requested && requested.startsWith('/') && !requested.startsWith('//')) {
    next.value = requested;
  }
})();
