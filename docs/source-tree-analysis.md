# FlySolo Source Tree Analysis

> Comprehensive codebase structure analysis for AI agents and developers

---

## 📁 Directory Structure

```
FlySolo/
├── App.tsx                          # Main application component (1,195 lines)
├── index.tsx                        # React entry point
├── index.html                       # HTML template
├── index.css                        # Global styles
├── types.ts                         # TypeScript type definitions
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── netlify.toml                     # Netlify deployment config
├── metadata.json                    # Project metadata
│
├── components/                      # React components (13 files)
│   ├── BrandSelector.tsx            # Multi-brand landing page
│   ├── Onboarding.tsx               # URL input screen
│   ├── AnalysisLoader.tsx           # Progressive loading animation
│   ├── SwipeDeck.tsx                # Card swiping interface
│   ├── BrandInfoCard.tsx            # Brand profile sidebar
│   ├── LikedAssetsPanel.tsx         # Saved posts panel
│   ├── Editor.tsx                   # Post editing modal
│   ├── CalendarPage.tsx             # Calendar wrapper
│   ├── CalendarView.tsx             # Calendar grid component
│   ├── Dashboard.tsx                # Saved content grid
│   ├── ScheduleDialog.tsx           # Date/time picker
│   ├── VideoPlayer.tsx              # Video playback modal
│   ├── NotificationBell.tsx         # Notification dropdown
│   ├── NotificationToast.tsx        # Toast notifications (legacy)
│   └── Toast.tsx                    # Modern toast component
│
├── services/                        # Business logic layer (3 files)
│   ├── geminiService.ts             # Google AI integration (900+ lines)
│   ├── supabaseService.ts           # Database operations (400+ lines)
│   └── pexelsService.ts             # Image search fallback (200+ lines)
│
├── docs/                            # Documentation (6 files)
│   ├── index.md                     # Master entry point (BMAD)
│   ├── project-overview.md          # Project context
│   ├── ARCHITECTURE.md              # Technical architecture
│   ├── source-tree-analysis.md      # This file
│   ├── DEVLOG.md                    # Development timeline (BMAD)
│   └── ISSUES.md                    # Bug tracker
│
├── netlify/                         # Serverless functions
│   └── functions/
│       └── generate-video.ts        # VEO video proxy (CORS bypass)
│
├── dist/                            # Build output (generated)
└── node_modules/                    # Dependencies (generated)
```

---

## 🔍 File Analysis

### Core Application Files

#### `App.tsx` (1,195 lines)
**Purpose**: Main application component and state machine

**Key Responsibilities:**
- Application state management (`AppState` enum)
- Brand profile state (`BrandProfile`)
- Generated posts state (`SocialPost[]`)
- Liked posts state (`SocialPost[]`)
- LocalStorage persistence
- Supabase integration
- Background analysis tracking
- Notification system
- Toast notifications

**Key Functions:**
- `handleStartAnalysis()` — Initiate brand analysis
- `handleSelectBrand()` — Load brand workspace
- `handleSwitchBrand()` — Switch between brands
- `startImageGeneration()` — Generate images for posts
- `handleSwipe()` — Process card swipe actions
- `handleLike()` — Save post to liked assets
- `handleSchedulePost()` — Schedule post on calendar

**State Variables:**
```typescript
- appState: AppState
- brandProfile: BrandProfile | null
- generatedPosts: SocialPost[]
- likedPosts: SocialPost[]
- loadingImages: Set<string>
- currentBrandId: string | null
- allBrands: StoredBrand[]
- pendingAnalyses: Map<string, PendingAnalysis>
- notifications: AppNotification[]
```

**Dependencies:**
- `components/*` — All UI components
- `services/geminiService.ts` — AI operations
- `services/supabaseService.ts` — Database operations
- `types.ts` — Type definitions

---

#### `types.ts` (~100 lines)
**Purpose**: TypeScript type definitions

**Key Types:**
```typescript
- AppState (enum) — Application states
- BrandProfile (interface) — Brand data structure
- SocialPost (interface) — Post data structure
- AnalysisStage (interface) — Analysis progress
- PendingAnalysis (interface) — Background analysis
- AppNotification (interface) — Notification data
```

**Usage**: Imported by all components and services

---

### Component Files

#### `components/BrandSelector.tsx` (~450 lines)
**Purpose**: Multi-brand landing page

**Features:**
- Display grid of saved brands
- Brand card with logo, name, industry
- Refresh (soft) and Re-analyze (hard) actions
- Delete brand functionality
- "Add New Brand" button
- Post count display
- Brand colour palette preview

**Key Props:**
```typescript
- onSelectBrand: (brand: StoredBrand) => void
- onNewBrand: () => void
- onHardRefresh: (brand: StoredBrand) => void
- onSoftRefresh: (brand: StoredBrand) => void
```

**Dependencies:**
- `services/supabaseService.ts` — Load brands
- `types.ts` — StoredBrand type

---

#### `components/SwipeDeck.tsx` (~600 lines)
**Purpose**: Tinder-style card swiping interface

**Features:**
- Card stack with swipe gestures
- Empty state handling
- Image loading states
- Like/dislike actions
- Edit button
- Remaining cards counter
- Background card preview

**Key State:**
```typescript
- currentIndex: number
- isDragging: boolean
- canSwipe: boolean
- isDeckEmpty: boolean
```

**Key Functions:**
- `handleSwipe()` — Process swipe action
- `handleLike()` — Save post
- `handleImageClick()` — Open editor
- `handleMouseDown()` — Start drag
- `handleMouseMove()` — Update drag position
- `handleMouseUp()` — Complete swipe

**Dependencies:**
- `App.tsx` — Props (posts, handlers)
- `components/BrandInfoCard.tsx` — Sidebar
- `components/LikedAssetsPanel.tsx` — Saved panel

---

#### `components/BrandInfoCard.tsx` (~600 lines)
**Purpose**: Brand profile sidebar display

**Features:**
- Brand logo with fallback initials
- Brand name and industry
- Essence description
- Data confidence score
- Social intelligence (handles)
- Brand palette (colours)
- Identified offerings (products/services)
- Strategy section
- Connect knowledge (add URLs)
- Brand switcher dropdown
- Edit profile button

**Key Components:**
- `LogoImage` — Logo with fallback to initials
- Collapsible sections
- Colour swatches
- Social handle links

**Dependencies:**
- `types.ts` — BrandProfile type
- `services/supabaseService.ts` — StoredBrand type

---

#### `components/Editor.tsx` (~400 lines)
**Purpose**: Post editing modal

**Features:**
- Caption editing
- Hashtag editing
- Visual prompt editing
- Image regeneration
- Video animation trigger
- Save changes
- Close/cancel

**Key Functions:**
- `handleSave()` — Save edited post
- `handleAnimate()` — Generate video
- `handleRegenerateImage()` — Create new image

**Dependencies:**
- `services/geminiService.ts` — refinePost, generatePostImage

---

#### `components/CalendarView.tsx` (~500 lines)
**Purpose**: Calendar grid component

**Features:**
- Three view modes: Daily, Weekly, Monthly
- Drag-drop scheduling
- Time slot selection (30-min intervals)
- Post display on dates
- Navigation controls
- View mode switcher

**Key Functions:**
- `handleDrop()` — Process drag-drop
- `handleTimeSlotClick()` — Select time
- `getPostsForDate()` — Filter posts by date
- `renderDayCell()` — Render calendar cell

**Dependencies:**
- `types.ts` — SocialPost type

---

### Service Files

#### `services/geminiService.ts` (~900 lines)
**Purpose**: Google AI platform integration

**Key Functions:**

**Brand Analysis:**
- `analyzeBrand(url)` — Initial brand analysis
- `enrichBrandProfile(profile, url)` — Add more data
- `softRefreshBrand(profile, url)` — Background refresh
- `researchAndExtract()` — Two-step API call (research + extraction)

**Content Generation:**
- `generateContentIdeas(profile, count)` — Create posts
- `refinePost(post, instruction)` — Edit post with AI

**Image Generation:**
- `generatePostImage(post, profile, brandId)` — Create image
- `getBrandedPlaceholderImage(profile)` — Fallback SVG
- Multi-API key rotation (4 keys)
- Model fallback chain (imagen-3.0, imagen-2.0)

**Video Generation:**
- `generatePostVideo(imageUrl, prompt)` — Create video
- `checkVideoStatus(operationName)` — Poll status
- `fetchVideoAsBlob(videoUrl)` — CORS bypass

**Utilities:**
- `normaliseBrandProfile()` — Ensure data completeness
- `buildFallbackOfferings()` — Industry-specific defaults
- `buildFallbackStrategy()` — Marketing strategy defaults

**Dependencies:**
- `@google/genai` — Google AI SDK
- `services/pexelsService.ts` — Image fallback
- `services/supabaseService.ts` — Asset lookup

---

#### `services/supabaseService.ts` (~400 lines)
**Purpose**: Supabase database operations

**Key Functions:**

**Database Setup:**
- `checkDatabaseStatus()` — Verify tables exist
- `initSupabase()` — Initialise client

**Brand Operations:**
- `saveBrandProfile(profile, url)` — Save/update brand
- `getBrandProfile(url)` — Load brand
- `listBrands()` — Get all brands
- `loadBrandWorkspace(brandId)` — Load complete workspace
- `deleteBrand(brandId)` — Remove brand

**Asset Operations:**
- `saveBrandAssets(brandId, assets, sourcePage)` — Save images
- `getBrandAssets(brandId)` — Load assets
- `findRelevantAsset(brandId, searchTerm)` — Search assets

**Post Operations:**
- `saveSocialPost(brandId, post)` — Save post
- `getSavedPosts(brandId)` — Load posts
- `getBrandPostCount(brandId)` — Count posts

**Dependencies:**
- `@supabase/supabase-js` — Supabase client
- `types.ts` — BrandProfile, SocialPost types

---

#### `services/pexelsService.ts` (~200 lines)
**Purpose**: Pexels image search fallback

**Key Functions:**
- `searchPexelsImage(profile, visualPrompt, orientation)` — Search images
- `getIndustrySearchTerms(industry)` — Map industry to keywords
- `searchPexelsFallback(industry, orientation)` — Broader search

**Features:**
- Industry-aware search queries
- 30+ industry mappings
- Orientation support (landscape/portrait/square)
- Error handling with fallbacks

**Dependencies:**
- Pexels API (fetch)
- `types.ts` — BrandProfile type

---

### Configuration Files

#### `vite.config.ts`
**Purpose**: Vite build configuration

**Key Settings:**
- React plugin
- Environment variable injection
- Build optimisations

**Environment Variables:**
```typescript
- VITE_GEMINI_API_KEY
- VITE_IMAGEN_API_KEY
- VITE_VEO_API_KEY
- VITE_PEXELS_API_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
```

---

#### `tsconfig.json`
**Purpose**: TypeScript compiler configuration

**Key Settings:**
- Target: ES2020
- Module: ESNext
- JSX: React
- Strict mode enabled
- Path aliases (if any)

---

#### `netlify.toml`
**Purpose**: Netlify deployment configuration

**Settings:**
- Build command: `npm run build`
- Publish directory: `dist`
- Function directory: `netlify/functions`
- Environment variables (production)

---

## 🔗 Component Dependencies

```
App.tsx
├── BrandSelector
│   └── supabaseService (listBrands)
├── Onboarding
│   └── geminiService (analyzeBrand)
├── AnalysisLoader
│   └── geminiService (analyzeBrand, generateContentIdeas)
├── SwipeDeck
│   ├── BrandInfoCard
│   │   └── supabaseService (loadBrandWorkspace)
│   ├── LikedAssetsPanel
│   │   ├── VideoPlayer
│   │   └── ScheduleDialog
│   └── Editor
│       └── geminiService (refinePost, generatePostImage)
├── CalendarPage
│   └── CalendarView
└── Dashboard
    └── CalendarView
```

---

## 📊 Code Statistics

| Category | Count | Lines (approx) |
|----------|-------|----------------|
| Components | 15 | ~4,500 |
| Services | 3 | ~1,500 |
| Types | 1 | ~100 |
| Config Files | 4 | ~200 |
| Documentation | 6 | ~2,000 |
| **Total** | **29** | **~8,300** |

---

## 🎯 Key Patterns

### State Management
- **React Hooks**: useState, useEffect, useCallback
- **LocalStorage**: Persistence for user data
- **Supabase**: Persistent storage for brands/posts
- **State Machine**: AppState enum for navigation

### API Integration
- **Google AI**: Separate clients for text/image/video
- **Supabase**: Single client instance
- **Pexels**: Direct fetch calls
- **Error Handling**: Try-catch with fallbacks

### Component Patterns
- **Functional Components**: All components are functions
- **Props Drilling**: Data passed via props
- **Event Handlers**: Callbacks passed from App.tsx
- **Conditional Rendering**: Based on appState

### Code Organisation
- **Separation of Concerns**: Components vs Services
- **Type Safety**: TypeScript interfaces throughout
- **Reusability**: Shared components (VideoPlayer, Toast)
- **Documentation**: Inline comments + external docs

---

## 🔍 Code Quality Indicators

### Strengths
✅ **Type Safety**: Full TypeScript coverage
✅ **Component Structure**: Clear separation of concerns
✅ **Error Handling**: Comprehensive try-catch blocks
✅ **Documentation**: Well-documented functions
✅ **State Management**: Centralised in App.tsx

### Areas for Improvement
⚠️ **File Size**: App.tsx is large (1,195 lines) — consider splitting
⚠️ **Service Size**: geminiService.ts is large (900+ lines) — consider modules
⚠️ **Prop Drilling**: Some deep prop passing — consider context
⚠️ **Test Coverage**: No automated tests — add unit/integration tests

---

## 🚀 Entry Points

### For Developers
1. **Start**: `App.tsx` — Main application logic
2. **Components**: `components/` — UI components
3. **Services**: `services/` — Business logic
4. **Types**: `types.ts` — Type definitions

### For AI Agents
1. **Documentation**: `docs/index.md` — Master entry
2. **Architecture**: `docs/ARCHITECTURE.md` — Technical details
3. **Source Tree**: This file — Code structure
4. **DevLog**: `docs/DEVLOG.md` — Historical context

---

*Last Updated: 19 December 2025*  
*Analysis Version: 1.0*

