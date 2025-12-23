# FlySolo Database Migrations

This folder contains SQL migration scripts for the Supabase database.

## Migration Files

| File | Status | Purpose |
|------|--------|---------|
| `001-enable-rls-permissive.sql` | **RUN NOW** | Enable RLS with permissive policies (fixes Security Advisor errors) |
| `002-user-auth-rls-upgrade.sql` | **FUTURE** | Upgrade to user-based RLS when implementing authentication |

---

## 001: Enable RLS (Permissive Mode)

**Status:** Run this now to resolve Supabase Security Advisor errors.

### What it does:
- Enables Row Level Security on `brands`, `brand_assets`, and `saved_posts` tables
- Creates permissive policies that allow all operations (maintains current functionality)
- Satisfies Supabase security requirements

### How to run:
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (FlySoloAI)
3. Go to **SQL Editor** → **New Query**
4. Copy/paste the contents of `001-enable-rls-permissive.sql`
5. Click **Run**
6. Go to **Security Advisor** and click **Refresh** to verify errors are resolved

---

## 002: User-Based RLS Upgrade

**Status:** Ready for when you implement user authentication.

### What it does:
- Adds `user_id` column to the `brands` table
- Removes permissive policies
- Creates strict user-based policies:
  - Users can only see their own brands
  - Users can only access assets/posts belonging to their brands

### Prerequisites before running:
1. ✅ Supabase Auth configured (Google, Email, etc.)
2. ✅ Login/Register flow implemented in React app
3. ✅ Test user account created

### How to run:
1. Implement authentication in the app first
2. Run this migration in SQL Editor
3. Find your user ID: `SELECT id FROM auth.users WHERE email = 'you@email.com';`
4. Assign existing brands: `UPDATE brands SET user_id = 'your-uuid' WHERE user_id IS NULL;`
5. Make user_id required (uncomment the ALTER statement)

### App Code Changes Required:
When implementing auth, update `supabaseService.ts`:

```typescript
// Add this to saveBrand function
const { data: { user } } = await client.auth.getUser();
if (!user) throw new Error('Not authenticated');

const brandData = {
  // ... existing fields
  user_id: user.id,  // Add this line
};
```

---

## Security Model

### Current (Migration 001)
```
┌─────────────────────────────────────────────┐
│  All Users (anon key)                       │
│  ┌─────────────────────────────────────────┐│
│  │  All Brands / Assets / Posts           ││
│  │  (Permissive - everyone can access)    ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### Future (Migration 002)
```
┌─────────────────────────────────────────────┐
│  User A                    User B           │
│  ┌───────────────────┐    ┌───────────────┐ │
│  │ Brand 1           │    │ Brand 3       │ │
│  │  └─ Assets        │    │  └─ Assets    │ │
│  │  └─ Posts         │    │  └─ Posts     │ │
│  │ Brand 2           │    └───────────────┘ │
│  │  └─ Assets        │                      │
│  │  └─ Posts         │    (Isolated)        │
│  └───────────────────┘                      │
└─────────────────────────────────────────────┘
```

---

## Troubleshooting

### "permission denied for table X"
RLS is blocking access. Check:
- Is the user authenticated? (`auth.uid()` returns null for anon)
- Does the brand belong to the user?

### Rolling back Migration 002
If you need to revert to permissive mode:
```sql
-- Drop user-based policies
DROP POLICY IF EXISTS "brands_user_select" ON public.brands;
DROP POLICY IF EXISTS "brands_user_insert" ON public.brands;
-- ... (drop all user policies)

-- Re-create permissive policies
CREATE POLICY "brands_permissive_all" ON public.brands
  FOR ALL USING (true) WITH CHECK (true);
-- ... (repeat for other tables)
```

