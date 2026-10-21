# Ideas Board ✦ Y2K Retro Public Board

A public, static "Ideas Board" website built in a 2002 Internet Dream / Camcorder aesthetic for hosting on GitHub Pages. Anyone can visit and submit or upvote ideas with no login required!

Live URL: `https://bestdayin2016.github.io/ideas-board/`

---

## 🚀 Quick Setup Guide

Follow these step-by-step instructions to connect your Supabase database and launch on GitHub Pages:

### Step 1: Create a Supabase Project
1. Go to [Supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, choose a project name (e.g. `ideas-board`), set a database password, and choose your region.

### Step 2: Run the Database Migration SQL
1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Copy the entire contents of [`supabase.sql`](./supabase.sql) in this repository and paste it into the editor.
4. Click **Run** (or press `Ctrl+Enter`). You should see `Success. No rows returned`.

### Step 3: Copy API Credentials
1. In Supabase, go to **Project Settings** (gear icon) > **API**.
2. Copy your **Project URL** (e.g. `https://xyzcompany.supabase.co`).
3. Copy your **`anon` `public` key** (starts with `eyJ...`).

> ⚠️ **IMPORTANT**: Never copy or use the `service_role` key! The `anon` key is designed for frontend code and security is strictly managed via Row Level Security (RLS).

### Step 4: Configure `config.js`
Open `config.js` in your editor and replace the placeholders:

```javascript
export const SUPABASE_URL = "https://your-project-id.supabase.co";
export const SUPABASE_ANON_KEY = "your-actual-anon-key-here";
```

### Step 5: Commit & Push to GitHub
In your local terminal or IDE (Android Studio / VS Code):

```bash
git add .
git commit -m "Configure Supabase and launch Ideas Board"
git push origin main
```

### Step 6: Enable GitHub Pages
1. Go to your repository on GitHub: `https://github.com/bestdayin2016/ideas-board`
2. Click **Settings** > **Pages** (in the left sidebar).
3. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
4. Select **Branch: `main`** and **Folder: `/ (root)`**, then click **Save**.
5. Wait 1-2 minutes for GitHub Pages to build. Your site will be live at:
   `https://bestdayin2016.github.io/ideas-board/`

---

## 🛡️ Content Moderation Guide

When users flag an idea using the **`⚠ report`** button on a card, an entry is inserted into the `reports` table.

### How to Review Reports & Delete Abusive Content:
1. Open your **Supabase Dashboard**.
2. Click on **Table Editor** (grid icon) in the left menu.
3. Select the **`reports`** table to view reported idea IDs and reasons.
4. Select the **`ideas`** table. Find the reported idea by its ID and click **Delete Row**.
   *(Deleting an idea automatically deletes all associated reports due to the `ON DELETE CASCADE` foreign key rule).*

---

## 🎨 Customizing the Vibe

All styling, colors, and animations are configurable directly in CSS and JavaScript:

- **Colors & Theme Gradients**: Edit the CSS variables at the top of [`style.css`](./style.css) (`:root` for Daytime, `[data-theme="night"]` for Night Cam).
- **Marquee Text**: Edit the text inside the `.marquee-content` div in [`index.html`](./index.html).
- **Spam Blocklist**: Add or remove banned terms in the `BLOCKLIST` array near the top of [`app.js`](./app.js).
- **Disabling Effects**: Turn off glitter trail or sound by default in [`effects.js`](./effects.js).
- **Accessibility**: All animations automatically disable when the user's device prefers reduced motion (`prefers-reduced-motion: reduce`).

---

## 🔒 Security & Known Limitations

- **No Auth / Anonymous Posting**: The board is designed for open public participation. Spam is minimized via client-side cooldowns (30s per browser), honeypot fields, blocklists, and SQL CHECK constraints.
- **Vote Rate Limiting**: Voted idea IDs are tracked in `localStorage`. Clearing browser storage allows repeat upvoting. Votes are atomically incremented via a PostgreSQL `SECURITY DEFINER` function (`upvote_idea`), preventing clients from modifying other card properties.
- **Public `anon` Key**: The `anon` key is public by design. Row Level Security policies permit only `SELECT` and `INSERT` operations on `ideas`, and `INSERT` operations on `reports`. Clients cannot execute `UPDATE` or `DELETE` queries directly.

### 🛡️ Optional Hardening Suggestions

For high-traffic environments, you can implement additional protection:

1. **Cloudflare Turnstile / reCAPTCHA**: Add a widget to `index.html` and verify the token server-side via a Supabase Edge Function before inserting into `ideas`.
2. **Supabase Rate Limiting / Edge Functions**: Replace direct client insertions with a Supabase Edge Function that uses Redis / Upstash to rate-limit submissions by IP address.

---

## 📄 License & Attribution

Built with plain HTML, CSS, and Vanilla JS ES Modules. No build steps, no Node.js dependencies, and no npm packages required.
