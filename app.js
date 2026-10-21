// ============================================================================
// IDEAS BOARD - MAIN APPLICATION MODULE
// Vanilla JS (ES Module) + Supabase JS SDK via CDN
// ============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';
import {
  startCamcorderClock,
  initGlitterTrail,
  triggerSparkleBurst,
  setAudioMuted,
  ensureAudioContext,
  playSubmitChime,
  playUpvoteChime
} from './effects.js';

// ----------------------------------------------------------------------------
// 1. EDITABLE BLOCKLIST FOR SPAM PREVENTION
// ----------------------------------------------------------------------------
const BLOCKLIST = [
  "casino", "viagra", "crypto-airdrop", "poker", "free-tokens",
  "buy-followers", "telegram-group", "whatsapp-group", "discount-pills"
];

// ----------------------------------------------------------------------------
// 2. STATE MANAGEMENT & CONSTANTS
// ----------------------------------------------------------------------------
const COOLDOWN_SECONDS = 30;
const PAGE_SIZE = 20;

let supabase = null;
let ideasMap = new Map(); // Keyed by idea ID for deduplication
let currentPage = 0;
let currentSort = 'newest';
let currentSearch = '';
let hasMorePages = true;
let isLoading = false;
let pollingInterval = null;

// LocalStorage helpers with try/catch
function getVotedIdeaIds() {
  try {
    const raw = localStorage.getItem('voted_idea_ids');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveVotedIdeaId(id) {
  try {
    const current = getVotedIdeaIds();
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem('voted_idea_ids', JSON.stringify(current));
    }
  } catch (e) {
    console.warn("Unable to save voted idea to localStorage:", e);
  }
}

function getLastSubmitTime() {
  try {
    return parseInt(localStorage.getItem('last_submit_timestamp') || '0', 10);
  } catch (e) {
    return 0;
  }
}

function setLastSubmitTime(ts) {
  try {
    localStorage.setItem('last_submit_timestamp', ts.toString());
  } catch (e) {
    console.warn("Unable to save submit timestamp to localStorage:", e);
  }
}

// ----------------------------------------------------------------------------
// 3. INITIALIZATION & SETUP
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Start camcorder clock
  startCamcorderClock('camcorder-clock');

  // Initialize glitter trail
  initGlitterTrail();

  // Setup theme & sound controls
  initThemeAndSound();

  // Setup input character counters
  initCharCounters();

  // Check configuration
  if (!isConfigured()) {
    const banner = document.getElementById('config-warning-banner');
    if (banner) banner.style.display = 'block';
    showState('error');
    const errText = document.querySelector('#error-state p');
    if (errText) errText.textContent = "config.js not set up yet! Please paste your Supabase keys.";
    return;
  }

  // Create Supabase Client
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    showState('error');
    return;
  }

  // Setup form submit listener
  const form = document.getElementById('idea-form');
  if (form) form.addEventListener('submit', handleFormSubmit);

  // Setup search & sort listeners
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearch = e.target.value.trim().toLowerCase();
        resetAndReloadFeed();
      }, 300);
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      resetAndReloadFeed();
    });
  }

  // Load More Button
  const btnLoadMore = document.getElementById('btn-load-more');
  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      if (!isLoading && hasMorePages) {
        currentPage++;
        fetchIdeas(false);
      }
    });
  }

  // Retry Button
  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => resetAndReloadFeed());
  }

  // Initial Fetch & Realtime Subscription
  fetchIdeas(true);
  initRealtimeSubscription();
});

// ----------------------------------------------------------------------------
// 4. THEME & SOUND CONTROLS
// ----------------------------------------------------------------------------

/**
 * Checks whether the current date falls during the Diwali festival season
 */
function isDiwaliSeason(now = new Date()) {
  const month = now.getMonth(); // 0-indexed: 9 = Oct, 10 = Nov
  const date = now.getDate();
  const year = now.getFullYear();

  // Known main Diwali dates +/- 2 days festival window
  const diwaliDates = {
    2024: { month: 10, day: 1 },  // Nov 1 2024
    2025: { month: 9, day: 20 },  // Oct 20 2025
    2026: { month: 10, day: 8 },  // Nov 8 2026
    2027: { month: 9, day: 29 },  // Oct 29 2027
    2028: { month: 9, day: 17 },  // Oct 17 2028
    2029: { month: 10, day: 5 },  // Nov 5 2029
    2030: { month: 9, day: 26 },  // Oct 26 2030
  };

  const target = diwaliDates[year];
  if (target) {
    if (month === target.month && Math.abs(date - target.day) <= 2) {
      return true;
    }
  }
  // Fallback check for Diwali festival range (late Oct / early Nov)
  return (month === 9 && date >= 18) || (month === 10 && date <= 12);
}

function initThemeAndSound() {
  const btnTheme = document.getElementById('btn-theme-toggle');
  const btnSound = document.getElementById('btn-sound-toggle');

  // Load saved theme or auto-detect Diwali / system dark mode
  let savedTheme = localStorage.getItem('theme_preference');
  if (!savedTheme) {
    if (isDiwaliSeason()) {
      savedTheme = 'diwali';
    } else {
      savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'daytime';
    }
  }
  applyTheme(savedTheme);

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'daytime';
      // 3-way theme loop: daytime -> night -> diwali -> daytime
      let newTheme = 'daytime';
      if (current === 'daytime') newTheme = 'night';
      else if (current === 'night') newTheme = 'diwali';
      else if (current === 'diwali') newTheme = 'daytime';

      applyTheme(newTheme);
      localStorage.setItem('theme_preference', newTheme);
    });
  }

  // Sound Toggle
  let savedMuted = localStorage.getItem('sound_muted') !== 'false'; // Default OFF
  setAudioMuted(savedMuted);
  updateSoundButtonUI(savedMuted);

  // Global user interaction listener to unlock WebAudio context
  const unlockAudioOnUserGesture = () => {
    ensureAudioContext();
  };
  window.addEventListener('click', unlockAudioOnUserGesture, { once: true });
  window.addEventListener('keydown', unlockAudioOnUserGesture, { once: true });

  if (btnSound) {
    btnSound.addEventListener('click', () => {
      savedMuted = !savedMuted;
      setAudioMuted(savedMuted);
      localStorage.setItem('sound_muted', savedMuted.toString());
      updateSoundButtonUI(savedMuted);

      if (!savedMuted) {
        ensureAudioContext();
        playSubmitChime(); // Play instant test chime when unmuting sound!
      }
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btnTheme = document.getElementById('btn-theme-toggle');
  if (btnTheme) {
    if (theme === 'daytime') {
      btnTheme.textContent = '🌙 Night Cam';
    } else if (theme === 'night') {
      btnTheme.textContent = '🪔 Diwali';
    } else if (theme === 'diwali') {
      btnTheme.textContent = '☀️ Daytime';
    }
  }
}

function updateSoundButtonUI(isMuted) {
  const btnSound = document.getElementById('btn-sound-toggle');
  if (btnSound) {
    btnSound.textContent = isMuted ? '🔇 Sound OFF' : '🔊 Sound ON';
  }
}

// ----------------------------------------------------------------------------
// 5. CHARACTER COUNTERS
// ----------------------------------------------------------------------------
function initCharCounters() {
  setupCounter('input-title', 'title-counter', 80);
  setupCounter('input-description', 'desc-counter', 500);
  setupCounter('input-author', 'author-counter', 30);
}

function setupCounter(inputId, counterId, max) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;

  const update = () => {
    counter.textContent = `${input.value.length} / ${max}`;
  };
  input.addEventListener('input', update);
  update();
}

// ----------------------------------------------------------------------------
// 6. FORM SUBMISSION & SAFETY CHECKS
// ----------------------------------------------------------------------------
async function handleFormSubmit(e) {
  e.preventDefault();
  const statusMsg = document.getElementById('form-status-message');
  const btnSubmit = document.getElementById('btn-submit');
  if (!statusMsg || !btnSubmit) return;

  statusMsg.textContent = '';
  statusMsg.style.color = 'var(--accent-pink)';

  // 1. Honeypot check
  const hpValue = document.getElementById('hp-website')?.value || '';
  if (hpValue.trim().length > 0) {
    // Silent drop: pretend success without contacting DB
    statusMsg.style.color = 'var(--accent-lime)';
    statusMsg.textContent = 'TAPE SAVED ✓ thx 4 ur submission!';
    document.getElementById('idea-form').reset();
    initCharCounters();
    return;
  }

  // 2. Cooldown check
  const now = Date.now();
  const lastSubmit = getLastSubmitTime();
  const secondsPassed = Math.floor((now - lastSubmit) / 1000);
  if (secondsPassed < COOLDOWN_SECONDS) {
    const remaining = COOLDOWN_SECONDS - secondsPassed;
    statusMsg.textContent = `please wait ${remaining}s before posting again (^_^)`;
    return;
  }

  // 3. Inputs extraction & sanitize
  const titleInput = document.getElementById('input-title');
  const descInput = document.getElementById('input-description');
  const authorInput = document.getElementById('input-author');

  const title = titleInput?.value.trim() || '';
  const description = descInput?.value.trim() || '';
  let author_name = authorInput?.value.trim() || 'Anonymous';
  if (author_name.length === 0) author_name = 'Anonymous';

  // Validation
  if (title.length < 1 || title.length > 80) {
    statusMsg.textContent = 'title must be between 1 and 80 characters!';
    return;
  }
  if (description.length > 500) {
    statusMsg.textContent = 'description must be 500 characters or less!';
    return;
  }
  if (author_name.length > 30) {
    statusMsg.textContent = 'name must be 30 characters or less!';
    return;
  }

  // Blocklist spam check
  const combinedText = `${title} ${description} ${author_name}`.toLowerCase();
  for (const term of BLOCKLIST) {
    if (combinedText.includes(term.toLowerCase())) {
      statusMsg.textContent = 'submission contains flagged spam terms. please rephrase!';
      return;
    }
  }

  // Disable button while sending
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'SAVING TAPE... ⏳';

  try {
    const { data, error } = await supabase
      .from('ideas')
      .insert([{ title, description, author_name }])
      .select();

    if (error) throw error;

    // Record submission time for cooldown
    setLastSubmitTime(Date.now());

    // Visual & Sound Feedback
    statusMsg.style.color = 'var(--accent-lime)';
    statusMsg.textContent = 'TAPE SAVED ✓ thx 4 signing the board!';

    // Flash REC dot
    const recDot = document.getElementById('rec-dot');
    if (recDot) {
      recDot.style.color = '#00ff66';
      setTimeout(() => recDot.style.color = '', 2000);
    }

    triggerSparkleBurst(btnSubmit);
    playSubmitChime();

    // Reset Form
    document.getElementById('idea-form').reset();
    initCharCounters();

    // Add new card to feed if returned
    if (data && data.length > 0) {
      addOrUpdateIdeaInMap(data[0]);
      renderFeed();
    }

  } catch (err) {
    console.error("Error submitting idea:", err);
    statusMsg.style.color = 'var(--rec-red)';
    statusMsg.textContent = 'oops! error saving tape. please try again.';
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = '★ Sign the Board! ★';
  }
}

// ----------------------------------------------------------------------------
// 7. FEED FETCHING & PAGINATION
// ----------------------------------------------------------------------------
async function resetAndReloadFeed() {
  currentPage = 0;
  hasMorePages = true;
  ideasMap.clear();
  await fetchIdeas(true);
}

async function fetchIdeas(isInitial = false) {
  if (isLoading) return;
  isLoading = true;

  if (isInitial) {
    showState('loading');
  }

  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  try {
    let query = supabase.from('ideas').select('*');

    // Sorting
    if (currentSort === 'votes') {
      query = query.order('votes', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Search filter
    if (currentSearch.length > 0) {
      query = query.ilike('title', `%${currentSearch}%`);
    }

    query = query.range(start, end);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length < PAGE_SIZE) {
      hasMorePages = false;
    }

    if (data) {
      data.forEach(item => addOrUpdateIdeaInMap(item));
    }

    renderFeed();

  } catch (err) {
    console.error("Error fetching ideas:", err);
    if (ideasMap.size === 0) {
      showState('error');
    }
  } finally {
    isLoading = false;
  }
}

function addOrUpdateIdeaInMap(idea) {
  if (!idea || !idea.id) return;
  ideasMap.set(idea.id, idea);
}

// ----------------------------------------------------------------------------
// 8. ANTI-XSS DOM RENDERER
// STRICT REQUIREMENT: ZERO innerHTML usage with user data!
// ----------------------------------------------------------------------------
function renderFeed() {
  const container = document.getElementById('feed-container');
  const btnLoadMore = document.getElementById('btn-load-more');
  const visitorCounter = document.getElementById('visitor-counter');

  if (!container) return;

  // Filter and sort items from map
  let items = Array.from(ideasMap.values());

  if (currentSearch.length > 0) {
    items = items.filter(item => item.title.toLowerCase().includes(currentSearch));
  }

  if (currentSort === 'votes') {
    items.sort((a, b) => b.votes - a.votes || new Date(b.created_at) - new Date(a.created_at));
  } else {
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Update Visitor / Ideas Count
  if (visitorCounter) {
    const formattedCount = String(ideasMap.size).padStart(6, '0');
    visitorCounter.textContent = `IDEAS: [${formattedCount}]`;
  }

  if (items.length === 0) {
    container.textContent = ''; // Clear container cleanly
    showState('empty');
    if (btnLoadMore) btnLoadMore.style.display = 'none';
    return;
  }

  showState('content');

  // Clear container
  container.textContent = '';

  const votedIds = getVotedIdeaIds();

  // Construct DOM nodes safely
  items.forEach(idea => {
    const card = createIdeaCardNode(idea, votedIds.includes(idea.id));
    container.appendChild(card);
  });

  // Toggle Load More button
  if (btnLoadMore) {
    btnLoadMore.style.display = hasMorePages ? 'inline-flex' : 'none';
  }
}

/**
 * Constructs an idea card DOM tree using purely document.createElement and textContent
 */
function createIdeaCardNode(idea, isVoted) {
  const card = document.createElement('article');
  card.className = 'idea-card';
  card.setAttribute('data-id', idea.id);

  // Card Header (Titlebar / Timecode)
  const header = document.createElement('div');
  header.className = 'card-header';

  const authorSpan = document.createElement('span');
  authorSpan.className = 'card-author';
  authorSpan.textContent = `by ${idea.author_name || 'Anonymous'}`;

  // Check if idea is < 24 hours old for NEW! badge
  const createdDate = new Date(idea.created_at);
  const isNew = (Date.now() - createdDate.getTime()) < 24 * 60 * 60 * 1000;
  if (isNew) {
    const newBadge = document.createElement('span');
    newBadge.className = 'badge-new';
    newBadge.textContent = 'NEW!';
    authorSpan.appendChild(newBadge);
  }

  const rightSpan = document.createElement('span');
  rightSpan.style.display = 'flex';
  rightSpan.style.alignItems = 'center';
  rightSpan.style.gap = '0.5rem';

  const timecodeSpan = document.createElement('span');
  timecodeSpan.textContent = formatCamcorderTimecode(createdDate);

  const controlsSpan = document.createElement('div');
  controlsSpan.className = 'os-controls';
  controlsSpan.setAttribute('aria-hidden', 'true');

  ['_', '□', '✕'].forEach(symbol => {
    const osBtn = document.createElement('span');
    osBtn.className = 'os-btn';
    osBtn.textContent = symbol;
    controlsSpan.appendChild(osBtn);
  });

  rightSpan.appendChild(timecodeSpan);
  rightSpan.appendChild(controlsSpan);

  header.appendChild(authorSpan);
  header.appendChild(rightSpan);

  // Card Body
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = idea.title;

  body.appendChild(title);

  if (idea.description && idea.description.trim().length > 0) {
    const desc = document.createElement('p');
    desc.className = 'card-desc';
    desc.textContent = idea.description;
    body.appendChild(desc);
  }

  // Card Footer (Upvote & Report)
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const relativeTimeSpan = document.createElement('span');
  relativeTimeSpan.textContent = formatRelativeTime(createdDate);

  const rightActions = document.createElement('div');
  rightActions.style.display = 'flex';
  rightActions.style.alignItems = 'center';
  rightActions.style.gap = '0.75rem';

  // Report Link
  const reportBtn = document.createElement('button');
  reportBtn.className = 'btn-report';
  reportBtn.type = 'button';
  reportBtn.textContent = '⚠ report';
  reportBtn.addEventListener('click', () => handleReportIdea(idea.id));

  // Upvote Button
  const voteBtn = document.createElement('button');
  voteBtn.className = 'btn-aqua btn-sm';
  voteBtn.type = 'button';
  voteBtn.disabled = isVoted;

  const starText = isVoted ? '★ Cool! (' : '☆ Cool! (';
  voteBtn.textContent = `${starText}${idea.votes || 0})`;

  if (!isVoted) {
    voteBtn.addEventListener('click', () => handleUpvote(idea.id, voteBtn));
  }

  rightActions.appendChild(reportBtn);
  rightActions.appendChild(voteBtn);

  footer.appendChild(relativeTimeSpan);
  footer.appendChild(rightActions);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);

  return card;
}

// ----------------------------------------------------------------------------
// 9. UPVOTE & REPORT HANDLERS
// ----------------------------------------------------------------------------
async function handleUpvote(ideaId, voteBtn) {
  const idea = ideasMap.get(ideaId);
  if (!idea) return;

  // Optimistic UI Update
  const originalVotes = idea.votes || 0;
  idea.votes = originalVotes + 1;
  saveVotedIdeaId(ideaId);

  voteBtn.disabled = true;
  voteBtn.textContent = `★ Cool! (${idea.votes})`;
  triggerSparkleBurst(voteBtn);
  playUpvoteChime();

  try {
    const { data, error } = await supabase.rpc('upvote_idea', { idea_id: ideaId });
    if (error) throw error;

    if (typeof data === 'number') {
      idea.votes = data;
      voteBtn.textContent = `★ Cool! (${data})`;
    }
  } catch (err) {
    console.error("Error upvoting idea:", err);
    // Rollback on error
    idea.votes = originalVotes;
    voteBtn.disabled = false;
    voteBtn.textContent = `☆ Cool! (${originalVotes})`;
    alert("oops! couldn't register vote. please try again!");
  }
}

async function handleReportIdea(ideaId) {
  const reason = prompt("Why are u reporting this idea? (max 200 chars):");
  if (reason === null) return; // User cancelled

  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    alert("report reason cannot be empty!");
    return;
  }
  if (trimmed.length > 200) {
    alert("report reason is too long (max 200 chars)!");
    return;
  }

  try {
    const { error } = await supabase
      .from('reports')
      .insert([{ idea_id: ideaId, reason: trimmed }]);

    if (error) throw error;

    alert("thx! report submitted 4 review. (^_^)");
  } catch (err) {
    console.error("Error submitting report:", err);
    alert("oops! error submitting report.");
  }
}

// ----------------------------------------------------------------------------
// 10. REALTIME & POLLING FALLBACK
// ----------------------------------------------------------------------------
function initRealtimeSubscription() {
  if (!supabase) return;

  try {
    const channel = supabase.channel('public:ideas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ideas' }, (payload) => {
        if (payload.new) {
          addOrUpdateIdeaInMap(payload.new);
          renderFeed();
          const firstCard = document.querySelector('.idea-card');
          if (firstCard) triggerSparkleBurst(firstCard);
        }
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          startPollingFallback();
        } else {
          stopPollingFallback();
        }
      });
  } catch (e) {
    console.warn("Realtime subscription failed, using polling fallback:", e);
    startPollingFallback();
  }
}

function startPollingFallback() {
  if (pollingInterval) return;
  pollingInterval = setInterval(() => {
    fetchIdeas(false);
  }, 30000); // 30-second polling fallback
}

function stopPollingFallback() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// ----------------------------------------------------------------------------
// 11. HELPER FORMATTERS
// ----------------------------------------------------------------------------
function showState(state) {
  const loading = document.getElementById('loading-state');
  const empty = document.getElementById('empty-state');
  const error = document.getElementById('error-state');

  if (loading) loading.style.display = state === 'loading' ? 'block' : 'none';
  if (empty) empty.style.display = state === 'empty' ? 'block' : 'none';
  if (error) error.style.display = state === 'error' ? 'block' : 'none';
}

function formatCamcorderTimecode(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `REC ${hours}:${mins}:${secs}`;
}

function formatRelativeTime(date) {
  const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSecs < 60) return 'just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
