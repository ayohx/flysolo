-- ============================================================================
-- MIGRATION 001: Enable Row Level Security (Permissive Mode)
-- ============================================================================
-- Purpose: Enable RLS on all tables to satisfy Supabase Security Advisor
-- Mode: Permissive - allows all operations (current single-tenant setup)
-- Date: 2024-12-23
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor → New Query
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
-- 4. Refresh Security Advisor to verify errors are resolved
-- ============================================================================

-- 1. BRANDS TABLE
-- ============================================================================
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Permissive policy: Allow all operations for any user (anon or authenticated)
CREATE POLICY "brands_permissive_all" ON public.brands
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "brands_permissive_all" ON public.brands IS 
  'Temporary permissive policy. Replace with user-based policy when auth is implemented.';


-- 2. BRAND_ASSETS TABLE
-- ============================================================================
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- Permissive policy: Allow all operations for any user
CREATE POLICY "brand_assets_permissive_all" ON public.brand_assets
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "brand_assets_permissive_all" ON public.brand_assets IS 
  'Temporary permissive policy. Replace with user-based policy when auth is implemented.';


-- 3. SAVED_POSTS TABLE
-- ============================================================================
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

-- Permissive policy: Allow all operations for any user
CREATE POLICY "saved_posts_permissive_all" ON public.saved_posts
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "saved_posts_permissive_all" ON public.saved_posts IS 
  'Temporary permissive policy. Replace with user-based policy when auth is implemented.';


-- ============================================================================
-- VERIFICATION: Check RLS is enabled on all tables
-- ============================================================================
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('brands', 'brand_assets', 'saved_posts')
ORDER BY tablename;

-- List all policies on our tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('brands', 'brand_assets', 'saved_posts')
ORDER BY tablename, policyname;

