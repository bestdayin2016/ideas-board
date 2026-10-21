// ============================================================================
// IDEAS BOARD - VISUAL EFFECTS & AUDIO MODULE
// Y2K Retro Camcorder Clock, Glitter Cursor Trail, Sparkles & WebAudio Chime
// ============================================================================

let isAudioMuted = true; // Sound OFF by default
let audioCtx = null;

/**
 * Check if reduced motion is preferred by the OS or user settings
 * @returns {boolean}
 */
export function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if the user is on a touch device
 * @returns {boolean}
 */
export function isTouchDevice() {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

// ----------------------------------------------------------------------------
// 1. CAMCORDER LIVE CLOCK (Y2K retro timestamp format)
// ----------------------------------------------------------------------------
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function startCamcorderClock(clockElementId) {
  const clockEl = document.getElementById(clockElementId);
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();
    const month = MONTH_NAMES[now.getMonth()];
    const day = String(now.getDate()).padStart(2, '0');
    // Visual requirement: show real current month/day/time, but fixed retro year 2002
    const year = "2002";

    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const strHours = String(hours).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    clockEl.textContent = `${month} ${day} ${year} ${strHours}:${minutes}:${seconds} ${ampm}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
}

// ----------------------------------------------------------------------------
// 2. GLITTER CURSOR TRAIL (✦ ✧ ★)
// ----------------------------------------------------------------------------
const SPARKLE_CHARS = ['✦', '✧', '★', '✨', '🪔', '🌟', '･ﾟ'];
const SPARKLE_COLORS = ['#ff77bc', '#70d6ff', '#ffd166', '#ffffff', '#ff9f1c', '#f77f00', '#d62828', '#06d6a0'];
const activeParticles = [];
const MAX_PARTICLES = 15;

export function initGlitterTrail() {
  // Do not initialize on touch devices or if reduced motion is preferred
  if (isTouchDevice() || isReducedMotion()) return;

  let lastX = 0;
  let lastY = 0;

  window.addEventListener('mousemove', (e) => {
    // Only spawn if mouse moved a reasonable distance
    const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    if (dist < 18) return;

    lastX = e.clientX;
    lastY = e.clientY;

    if (activeParticles.length >= MAX_PARTICLES) {
      const oldest = activeParticles.shift();
      if (oldest && oldest.parentNode) {
        oldest.parentNode.removeChild(oldest);
      }
    }

    createGlitterParticle(e.clientX, e.clientY);
  });
}

function createGlitterParticle(x, y) {
  const particle = document.createElement('span');
  particle.className = 'glitter-particle';
  particle.setAttribute('aria-hidden', 'true');
  particle.textContent = SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)];

  const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
  const size = Math.floor(Math.random() * 8) + 12; // 12px to 20px
  const offsetX = (Math.random() - 0.5) * 20;
  const offsetY = (Math.random() - 0.5) * 20;

  particle.style.cssText = `
    position: fixed;
    left: ${x + offsetX}px;
    top: ${y + offsetY}px;
    font-size: ${size}px;
    color: ${color};
    pointer-events: none;
    z-index: 9999;
    user-select: none;
    text-shadow: 0 0 4px ${color};
    transition: transform 0.6s ease-out, opacity 0.6s ease-out;
    transform: scale(1) translate(0, 0);
    opacity: 1;
  `;

  document.body.appendChild(particle);
  activeParticles.push(particle);

  // Trigger floating and fade animation
  requestAnimationFrame(() => {
    const floatY = (Math.random() - 1) * 30; // Float upward
    const floatX = (Math.random() - 0.5) * 20;
    particle.style.transform = `scale(0.2) translate(${floatX}px, ${floatY}px) rotate(${Math.random() * 180}deg)`;
    particle.style.opacity = '0';
  });

  setTimeout(() => {
    if (particle.parentNode) {
      particle.parentNode.removeChild(particle);
    }
    const idx = activeParticles.indexOf(particle);
    if (idx > -1) activeParticles.splice(idx, 1);
  }, 600);
}

// ----------------------------------------------------------------------------
// 3. SPARKLE BURST (For submission / card arrival)
// ----------------------------------------------------------------------------
export function triggerSparkleBurst(targetElement) {
  if (isReducedMotion() || !targetElement) return;

  const rect = targetElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const burstCount = 12;
  for (let i = 0; i < burstCount; i++) {
    const spark = document.createElement('span');
    spark.className = 'sparkle-burst-particle';
    spark.setAttribute('aria-hidden', 'true');
    spark.textContent = SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)];

    const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
    const angle = (i / burstCount) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
    const distance = Math.random() * 60 + 30;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance;

    spark.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      font-size: 16px;
      color: ${color};
      pointer-events: none;
      z-index: 9999;
      user-select: none;
      text-shadow: 0 0 6px ${color};
      transition: transform 0.7s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.7s ease-out;
      transform: translate(0, 0) scale(1);
      opacity: 1;
    `;

    document.body.appendChild(spark);

    requestAnimationFrame(() => {
      spark.style.transform = `translate(${destX}px, ${destY}px) scale(0.1) rotate(360deg)`;
      spark.style.opacity = '0';
    });

    setTimeout(() => {
      if (spark.parentNode) spark.parentNode.removeChild(spark);
    }, 700);
  }
}

/**
 * Fires multi-point festive fireworks burst for Diwali theme activation
 */
export function triggerDiwaliFireworkBurst() {
  if (isReducedMotion()) return;

  const points = [
    { x: window.innerWidth * 0.25, y: window.innerHeight * 0.3 },
    { x: window.innerWidth * 0.50, y: window.innerHeight * 0.2 },
    { x: window.innerWidth * 0.75, y: window.innerHeight * 0.3 }
  ];

  points.forEach((point, pIdx) => {
    setTimeout(() => {
      const dummy = { getBoundingClientRect: () => ({ left: point.x, top: point.y, width: 0, height: 0 }) };
      triggerSparkleBurst(dummy);
    }, pIdx * 180);
  });
}

// ----------------------------------------------------------------------------
// 4. WEBAUDIO SOFT CHIME (Sound feedback on submit & upvote)
// ----------------------------------------------------------------------------
export function setAudioMuted(muted) {
  isAudioMuted = muted;
}

export function ensureAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSubmitChime() {
  if (isAudioMuted || isReducedMotion()) return;

  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const renderSound = () => {
      const now = ctx.currentTime;

      const playNote = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Retro Y2K 4-note ascending bell chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
      playNote(523.25, now, 0.2);
      playNote(659.25, now + 0.08, 0.2);
      playNote(783.99, now + 0.16, 0.22);
      playNote(1046.50, now + 0.24, 0.4);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => renderSound());
    } else {
      renderSound();
    }

  } catch (err) {
    console.warn("WebAudio chime unable to play:", err);
  }
}

export function playUpvoteChime() {
  if (isAudioMuted || isReducedMotion()) return;

  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const renderSound = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => renderSound());
    } else {
      renderSound();
    }
  } catch (err) {
    console.warn("WebAudio upvote chime unable to play:", err);
  }
}
