-- ============================================================================
-- MIGRATION 002: Upgrade to User-Based Row Level Security
-- ============================================================================
-- Purpose: Add user authentication and restrict data access per user
-- Status: READY TO RUN - Execute when implementing user login
-- 
-- PREREQUISITES:
-- 1. Supabase Auth must be configured
-- 2. User registration/login flow must be implemented in the app
-- 3. All existing brands should be assigned to a user (see Step 2)
--
-- INSTRUCTIONS:
-- 1. First, implement auth in your app (login/register)
-- 2. Run this migration to add user_id columns
-- 3. Assign existing data to your user account
-- 4. Update supabaseService.ts to use authenticated client
-- ============================================================================

-- ============================================================================
-- STEP 1: Add user_id column to brands table
-- ============================================================================

-- Add the user_id column (nullable initially to handle existing data)
ALTER TABLE public.brands 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance on user queries
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON public.brands(user_id);

COMMENT ON COLUMN public.brands.user_id IS 
  'Owner of this brand. Links to Supabase auth.users table.';


-- ============================================================================
-- STEP 2: Migrate existing data (MANUAL STEP)
-- ============================================================================
-- After running Step 1, you need to assign existing brands to a user.
-- Replace 'YOUR_USER_UUID' with your actual user ID from auth.users table.
-- 
-- To find your user ID after logging in:
-- SELECT id, email FROM auth.users WHERE email = 'your@email.com';
--
-- Then run:
-- UPDATE public.brands SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;


-- ============================================================================
-- STEP 3: Make user_id required (run AFTER migrating existing data)
-- ============================================================================
-- Uncomment and run after all existing brands have user_id assigned:
--
-- ALTER TABLE public.brands 
--   ALTER COLUMN user_id SET NOT NULL;


-- ============================================================================
-- STEP 4: Drop permissive policies and create user-based policies
-- ============================================================================

-- Drop the old permissive policies
DROP POLICY IF EXISTS "brands_permissive_all" ON public.brands;
DROP POLICY IF EXISTS "brand_assets_permissive_all" ON public.brand_assets;
DROP POLICY IF EXISTS "saved_posts_permissive_all" ON public.saved_posts;


-- BRANDS: User can only see and manage their own brands
-- ============================================================================
CREATE POLICY "brands_user_select" ON public.brands
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "brands_user_insert" ON public.brands
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brands_user_update" ON public.brands
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brands_user_delete" ON public.brands
  FOR DELETE
  USING (auth.uid() = user_id);


-- BRAND_ASSETS: User can access assets for their brands only
-- ============================================================================
CREATE POLICY "brand_assets_user_select" ON public.brand_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = brand_assets.brand_id 
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_assets_user_insert" ON public.brand_assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = brand_assets.brand_id 
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_assets_user_update" ON public.brand_assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = brand_assets.brand_id 
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "brand_assets_user_delete" ON public.brand_assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = brand_assets.brand_id 
        AND brands.user_id = auth.uid()
    )
  );


-- SAVED_POSTS: User can access posts for their brands only
-- ============================================================================
CREATE POLICY "saved_posts_user_select" ON public.saved_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = saved_posts.brand_id 
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "saved_posts_user_insert" ON public.saved_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = saved_posts.brand_id 
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "saved_posts_user_update" ON public.saved_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = saved_posts.brand_id 
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "saved_posts_user_delete" ON public.saved_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = saved_posts.brand_id 
        AND brands.user_id = auth.uid()
    )
  );


-- ============================================================================
-- VERIFICATION: Check policies are correctly applied
-- ============================================================================
SELECT 
  tablename,
  policyname,
  permissive,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('brands', 'brand_assets', 'saved_posts')
ORDER BY tablename, policyname;

