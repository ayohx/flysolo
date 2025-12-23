# STORY-014: User Authentication System

## Status: Backlog

## Priority: Medium

## Prerequisites
- [ ] App functioning with all current bugs fixed
- [ ] RLS Migration 003 executed in Supabase (`docs/database/003-add-demo-user-and-upgrade.sql`)

---

## Overview

Implement full user authentication for FlySolo so each user has their own private workspace with their brands, posts, and assets.

---

## Database Preparation (Already Done)

The following SQL migrations have been created and are ready:

| File | Purpose | Status |
|------|---------|--------|
| `001-enable-rls-permissive.sql` | Enable RLS with permissive policies | ✅ Run |
| `002-user-auth-rls-upgrade.sql` | Reference: User-based RLS upgrade | 📄 Docs |
| `003-add-demo-user-and-upgrade.sql` | Create demo user + hybrid RLS | ⏳ Run when ready |

**Demo Credentials:**
- Email: `user@flysolo.ai`
- Password: `FlySolo!23`

---

## Implementation Tasks

### 1. Create Auth Components

```
components/
  auth/
    LoginPage.tsx       # Login form
    RegisterPage.tsx    # Registration form  
    AuthGuard.tsx       # Protects routes, redirects if not logged in
    UserMenu.tsx        # User avatar + dropdown in header
```

### 2. Create Auth Service

```typescript
// services/authService.ts

import { getSupabase } from './supabaseService';

export const signUp = async (email: string, password: string) => {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  await getSupabase().auth.signOut();
};

export const getCurrentUser = async () => {
  const { data: { user } } = await getSupabase().auth.getUser();
  return user;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return getSupabase().auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
};
```

### 3. Update Brand Creation

```typescript
// In supabaseService.ts - saveBrand function

export const saveBrand = async (url: string, profile: BrandProfile): Promise<StoredBrand | null> => {
  const client = getSupabase();
  
  // Get current user
  const { data: { user } } = await client.auth.getUser();
  
  const brandData = {
    url: normalisedUrl,
    name: profile.name,
    industry: profile.industry,
    profile_json: profile,
    logo_url: profile.logoUrl,
    user_id: user?.id,  // <-- ADD THIS
    updated_at: new Date().toISOString(),
  };
  
  // ... rest of function
};
```

### 4. Add Routes

```typescript
// In App.tsx or router config

<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  
  {/* Protected routes */}
  <Route element={<AuthGuard />}>
    <Route path="/" element={<BrandSelector />} />
    <Route path="/brand/:slug" element={<Dashboard />} />
    {/* ... other protected routes */}
  </Route>
</Routes>
```

---

## Acceptance Criteria

- [ ] User can register with email and password
- [ ] User can log in with email and password
- [ ] User session persists across page refreshes
- [ ] Logged-out users are redirected to login page
- [ ] Each user only sees their own brands
- [ ] New brands are automatically linked to logged-in user
- [ ] User can log out (clears session, redirects to login)
- [ ] Header shows user email/avatar when logged in

---

## UI Design Notes

### Login Page
- Clean, centred card layout
- FlySolo logo at top
- Email + password fields
- "Log In" button
- Link to register page
- Error messages for invalid credentials

### Register Page
- Similar layout to login
- Email + password + confirm password
- "Create Account" button
- Link back to login
- Success message on registration

### Header (Logged In)
- User avatar/initials in top-right
- Dropdown: Profile, Settings, Logout

---

## Security Considerations

- Passwords handled by Supabase (bcrypt hashing)
- Session tokens stored securely by Supabase client
- RLS ensures data isolation between users
- No sensitive data in localStorage (use Supabase session)

---

## Testing Checklist

1. [ ] Register new user
2. [ ] Log in with registered user
3. [ ] Refresh page - still logged in
4. [ ] Create brand - verify user_id is set
5. [ ] Log out - verify redirect to login
6. [ ] Try accessing protected route while logged out - redirect works
7. [ ] Log in as different user - verify only see own brands

