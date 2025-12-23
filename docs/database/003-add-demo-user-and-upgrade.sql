-- ============================================================================
-- MIGRATION 003: Add Demo User & Upgrade to User-Based RLS
-- ============================================================================
-- Prerequisites: Migration 001 already run (RLS enabled)
--
-- This script:
-- 1. Creates demo user account
-- 2. Adds user_id column to brands
-- 3. Assigns existing brands to demo user
-- 4. Upgrades from permissive to hybrid RLS policies
--
-- Demo User Credentials:
--   Email: user@flysolo.ai
--   Password: FlySolo!23
-- ============================================================================


-- ============================================================================
-- STEP 1: Create demo user account
-- ============================================================================
-- First check if user already exists

DO $$
DECLARE
  demo_user_id UUID;
BEGIN
  -- Check if demo user already exists
  SELECT id INTO demo_user_id FROM auth.users WHERE email = 'user@flysolo.ai';
  
  IF demo_user_id IS NULL THEN
    -- Generate a new UUID for the user
    demo_user_id := gen_random_uuid();
    
    -- Insert the demo user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      demo_user_id,
      '00000000-0000-0000-0000-000000000000',
      'user@flysolo.ai',
      crypt('FlySolo!23', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "FlySolo Demo User"}',
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );
    
    -- Add identity record (required for Supabase Auth login)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      demo_user_id,
      jsonb_build_object('sub', demo_user_id::text, 'email', 'user@flysolo.ai'),
      'email',
      demo_user_id::text,
      NOW(),
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Demo user created with ID: %', demo_user_id;
  ELSE
    RAISE NOTICE 'Demo user already exists with ID: %', demo_user_id;
  END IF;
END $$;


-- ============================================================================
-- STEP 2: Add user_id column to brands table
-- ============================================================================

ALTER TABLE public.brands 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_brands_user_id ON public.brands(user_id);


-- ============================================================================
-- STEP 3: Assign ALL existing brands to the demo user
-- ============================================================================

UPDATE public.brands 
SET user_id = (SELECT id FROM auth.users WHERE email = 'user@flysolo.ai' LIMIT 1)
WHERE user_id IS NULL;


-- ============================================================================
-- STEP 4: Drop old permissive policies and create hybrid policies
-- ============================================================================

-- Drop the permissive policies from Migration 001
DROP POLICY IF EXISTS "brands_permissive_all" ON public.brands;
DROP POLICY IF EXISTS "brand_assets_permissive_all" ON public.brand_assets;
DROP POLICY IF EXISTS "saved_posts_permissive_all" ON public.saved_posts;

-- BRANDS: Allow access if user owns the brand OR if using anon key (for now)
CREATE POLICY "brands_access_policy" ON public.brands
  FOR ALL
  USING (
    -- Allow if authenticated user owns this brand
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    -- Also allow anon access (temporary, until app uses auth)
    (auth.uid() IS NULL)
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    (auth.uid() IS NULL)
  );

-- BRAND_ASSETS: Allow access based on parent brand ownership
CREATE POLICY "brand_assets_access_policy" ON public.brand_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = brand_assets.brand_id 
        AND (
          (auth.uid() IS NOT NULL AND brands.user_id = auth.uid())
          OR (auth.uid() IS NULL)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = brand_assets.brand_id 
        AND (
          (auth.uid() IS NOT NULL AND brands.user_id = auth.uid())
          OR (auth.uid() IS NULL)
        )
    )
  );

-- SAVED_POSTS: Allow access based on parent brand ownership
CREATE POLICY "saved_posts_access_policy" ON public.saved_posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = saved_posts.brand_id 
        AND (
          (auth.uid() IS NOT NULL AND brands.user_id = auth.uid())
          OR (auth.uid() IS NULL)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands 
      WHERE brands.id = saved_posts.brand_id 
        AND (
          (auth.uid() IS NOT NULL AND brands.user_id = auth.uid())
          OR (auth.uid() IS NULL)
        )
    )
  );


-- ============================================================================
-- VERIFICATION: Check everything is set up correctly
-- ============================================================================

-- Check demo user was created
SELECT id, email, created_at FROM auth.users WHERE email = 'user@flysolo.ai';

-- Check RLS is enabled
SELECT tablename, rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('brands', 'brand_assets', 'saved_posts');

-- Check brands are assigned to demo user
SELECT id, name, user_id FROM public.brands;

-- Check policies exist
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('brands', 'brand_assets', 'saved_posts');

