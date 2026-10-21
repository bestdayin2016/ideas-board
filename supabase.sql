-- ============================================================================
-- IDEAS BOARD DATABASE SETUP FOR SUPABASE
-- Run this entire script in the Supabase SQL Editor (https://app.supabase.com)
-- ============================================================================

-- 1. Ensure uuid generation function is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create the ideas table
CREATE TABLE IF NOT EXISTS public.ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL DEFAULT 'Anonymous',
    votes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Validation Constraints
    CONSTRAINT chk_title_length CHECK (length(trim(title)) >= 1 AND length(title) <= 80),
    CONSTRAINT chk_description_length CHECK (length(description) <= 500),
    CONSTRAINT chk_author_length CHECK (length(trim(author_name)) >= 1 AND length(author_name) <= 30),
    CONSTRAINT chk_votes_non_negative CHECK (votes >= 0)
);

-- 3. BEFORE INSERT Trigger to prevent clients from falsifying votes or created_at
CREATE OR REPLACE FUNCTION public.sanitize_new_idea()
RETURNS TRIGGER AS $$
BEGIN
    NEW.votes := 0;
    NEW.created_at := now();
    -- Default empty or whitespace author name to Anonymous
    IF NEW.author_name IS NULL OR length(trim(NEW.author_name)) = 0 THEN
        NEW.author_name := 'Anonymous';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sanitize_new_idea ON public.ideas;
CREATE TRIGGER trg_sanitize_new_idea
    BEFORE INSERT ON public.ideas
    FOR EACH ROW
    EXECUTE FUNCTION public.sanitize_new_idea();

-- 4. Create the reports table for content moderation
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_reason_length CHECK (length(reason) <= 200)
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 6. Clean up existing policies if re-running
DROP POLICY IF EXISTS "Anyone can view ideas" ON public.ideas;
DROP POLICY IF EXISTS "Anyone can submit an idea" ON public.ideas;
DROP POLICY IF EXISTS "Anyone can submit a report" ON public.reports;

-- 7. Define RLS Policies for `ideas` table
-- Public can read all ideas
CREATE POLICY "Anyone can view ideas"
    ON public.ideas
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Public can submit new ideas
CREATE POLICY "Anyone can submit an idea"
    ON public.ideas
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- NOTE: No UPDATE or DELETE policy is created for ideas.
-- Clients cannot directly UPDATE or DELETE idea rows!

-- 8. Define RLS Policies for `reports` table
-- Public can submit reports
CREATE POLICY "Anyone can submit a report"
    ON public.reports
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- NOTE: No SELECT policy for reports on anon/authenticated.
-- Reports can only be read from the Supabase Dashboard by project admins.

-- 9. Explicit Grant / Revoke Permissions
REVOKE ALL ON public.ideas FROM PUBLIC;
REVOKE ALL ON public.reports FROM PUBLIC;

GRANT SELECT, INSERT ON public.ideas TO anon, authenticated;
GRANT INSERT ON public.reports TO anon, authenticated;

-- 10. Atomic Upvote RPC Function
-- Allows anonymous users to safely increment vote count without direct UPDATE access
CREATE OR REPLACE FUNCTION public.upvote_idea(idea_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_votes INTEGER;
BEGIN
    UPDATE public.ideas
    SET votes = votes + 1
    WHERE id = idea_id
    RETURNING votes INTO new_votes;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Idea with id % not found', idea_id;
    END IF;

    RETURN new_votes;
END;
$$;

-- Grant execution permissions for the upvote function
REVOKE EXECUTE ON FUNCTION public.upvote_idea(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upvote_idea(UUID) TO anon, authenticated;

-- 11. Enable Realtime Broadcasting on the ideas table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ideas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;
    END IF;
END $$;
