# 🏗️ FlySolo Architecture

> Technical architecture and design documentation.

---

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FlySolo App                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │Onboarding│──▶│Analysing │──▶│ Swiping  │──▶│Dashboard │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    App.tsx (State Machine)               │   │
│  │  - brandProfile    - generatedPosts   - likedPosts      │   │
│  │  - appState        - pendingVideos    - loadingImages   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                geminiService.ts                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │   │
│  │  │  aiText    │  │  aiImage   │  │  aiVideo   │        │   │
│  │  │ (Gemini)   │  │ (Imagen 3) │  │  (VEO 2)   │        │   │
│  │  └────────────┘  └────────────┘  └────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │      Google AI Platform        │
              │  ┌──────────────────────────┐  │
              │  │ Gemini 2.5 Flash         │  │
              │  │ - Brand analysis         │  │
              │  │ - Content generation     │  │
              │  │ - Post refinement        │  │
              │  │ - Scheduling             │  │
              │  └──────────────────────────┘  │
              │  ┌──────────────────────────┐  │
              │  │ Imagen 3.0               │  │
              │  │ - Image generation       │  │
              │  └──────────────────────────┘  │
              │  ┌──────────────────────────┐  │
              │  │ VEO 2.0                  │  │
              │  │ - Video generation       │  │
              │  │ - Async (polling)        │  │
              │  └──────────────────────────┘  │
              └────────────────────────────────┘
```

---

## 🔄 State Flow

```
ONBOARDING ──▶ ANALYSING ──▶ SWIPING ◀──▶ EDITOR
                                │
                         ┌──────┴──────┐
                         ▼             ▼
                     CALENDAR      DASHBOARD
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| ONBOARDING | ANALYSING | User submits URL |
| ANALYSING | SWIPING | Analysis complete |
| ANALYSING | ONBOARDING | Analysis error |
| SWIPING | DASHBOARD | All cards swiped or "Skip" |
| SWIPING | CALENDAR | User clicks Calendar button |
| SWIPING | EDITOR | User clicks edit |
| CALENDAR | SWIPING | User clicks "Back to Assets" |
| CALENDAR | EDITOR | User selects scheduled post |
| EDITOR | SWIPING | Editor closed (from swiping) |
| EDITOR | CALENDAR | Editor closed (from calendar) |
| DASHBOARD | EDITOR | User clicks edit on saved post |

---

## 📁 Component Hierarchy

```
App.tsx
├── Onboarding.tsx              # URL input screen
├── AnalysisLoader.tsx          # Progressive loading
├── SwipeDeck.tsx               # Card swiping interface
│   ├── BrandInfoCard.tsx       # Side panel: brand info
│   ├── LikedAssetsPanel.tsx    # Side panel: saved posts
│   │   ├── VideoPlayer.tsx     # Video playback modal
│   │   └── ScheduleDialog.tsx  # Date/time picker modal
│   └── [Calendar Button]       # Desktop text / Mobile icon
├── CalendarPage.tsx            # Calendar wrapper with nav
│   └── CalendarView.tsx        # Multi-view calendar (Daily/Weekly/Monthly)
├── Editor.tsx                  # Post editing modal
│   └── VideoPlayer.tsx         # Video preview
└── Dashboard.tsx               # Saved posts grid
    └── CalendarView.tsx        # Embedded calendar
```

### Calendar Navigation UI

```
┌─────────────────────────────────────────────────────────────┐
│  DESKTOP (lg:flex)                                          │
│  ┌────────────────┐ ┌──────────┐ ┌─────────────┐          │
│  │ ⊕ Create Custom│ │📅Calendar│ │↻ Fresh Start│          │
│  └────────────────┘ └──────────┘ └─────────────┘          │
│                     (indigo bg)   (red/danger)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MOBILE (lg:hidden, fixed top-right)                        │
│                                              ┌────┐         │
│                                              │ 📅 │  z-40   │
│                                              └────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 Data Models

### BrandProfile
```typescript
interface BrandProfile {
  name: string;           // Business name
  industry: string;       // e.g., "Travel & Airport Services"
  colors: string[];       // Brand hex codes
  vibe: string;           // Brand voice/tone
  competitors: string[];  // 3 competitor names
  strategy: string;       // Marketing strategy
  products: string;       // Overview paragraph
  services: string[];     // 10-20 specific offerings
  socialHandles?: string[]; // Social URLs/handles
  visualStyle: string;    // Art direction for images
  essence?: string;       // One-line summary
  confidence?: number;    // 0-100 data quality score
}
```

### SocialPost
```typescript
interface SocialPost {
  id: string;
  platform: 'Instagram' | 'LinkedIn' | 'Twitter/X' | 'TikTok';
  caption: string;
  hashtags: string[];
  visualPrompt: string;   // AI image generation prompt
  imageUrl?: string;      // Base64 or URL
  status: 'pending' | 'generating_image' | 'ready' | 'liked' | 'discarded';
  scheduledDate?: string;
  videoUrl?: string;      // For animated content
  videoStatus?: 'pending' | 'generating' | 'ready' | 'failed';
  videoOperationName?: string; // VEO polling reference
}
```

---

## 🔌 API Integration

### Gemini Text (gemini-2.5-flash)

| Function | Purpose | Tools |
|----------|---------|-------|
| `analyzeBrand()` | Research website | Google Search |
| `generateContentIdeas()` | Create posts | None |
| `refinePost()` | Edit post | None |
| `autoSchedulePosts()` | Create schedule | None |
| `mergeSourceUrl()` | Add data source | Google Search |

### Imagen 3 (imagen-3.0-generate-001)

| Function | Purpose | Aspect Ratios |
|----------|---------|---------------|
| `generatePostImage()` | Create visuals | 1:1, 9:16, 16:9 |

### VEO 2.0 (veo-2.0-generate-001)

| Function | Purpose | Duration |
|----------|---------|----------|
| `generatePostVideo()` | Create videos | 5s, 10s |
| `checkVideoStatus()` | Poll completion | N/A |
| `fetchVideoAsBlob()` | CORS bypass | N/A |
| `revokeBlobUrl()` | Memory cleanup | N/A |

---

## 📅 Calendar System

### View Modes

| Mode | Grid | Drag-Drop Behaviour |
|------|------|---------------------|
| **Monthly** | 7-column grid | Drop on day → auto-append to end of day |
| **Weekly** | 7-column (7 days) | Drop on day → keep original time |
| **Daily** | 30-min slots | Drop on slot → set exact time |

### Scheduling Flow

```
LikedAssetsPanel
      │
      ▼ [+ Schedule Button]
ScheduleDialog
      │
      ▼ [Date + Time Selection]
handleSchedulePost(postId, isoDate)
      │
      ▼
likedPosts updated with scheduledDate
      │
      ▼
CalendarView displays post on date
```

### Drag-Drop Implementation

```typescript
// Monthly: Auto-stack on drop
const handleDropOnDate = (date: Date, e: React.DragEvent) => {
  const existingPosts = getPostsForDate(date);
  if (existingPosts.length > 0) {
    // Append 30 mins after last post
    newDate.setMinutes(lastPost.getMinutes() + 30);
  }
  onReschedulePost(draggedPost.id, newDate.toISOString());
};

// Daily: Exact time slot
const handleDropOnTimeSlot = (date: Date, timeSlot: string) => {
  const [hour, minute] = timeSlot.split(':').map(Number);
  newDate.setHours(hour, minute, 0, 0);
  onReschedulePost(draggedPost.id, newDate.toISOString());
};
```

---

## 💾 Persistence (LocalStorage)

| Key | Data | Purpose |
|-----|------|---------|
| `flysolo_brand_profile` | BrandProfile | Restore brand |
| `flysolo_generated_posts` | SocialPost[] | Restore deck |
| `flysolo_liked_posts` | SocialPost[] | Restore likes |
| `flysolo_app_state` | string | Restore screen |

---

## ⚡ Performance Optimisations

1. **Lazy Image Loading**: Generate images in parallel (max 3 concurrent)
2. **Retry with Backoff**: Imagen failures retry with exponential delay
3. **Fallback Images**: Lorem Picsum if Imagen fails
4. **Async Video**: VEO runs in background with polling
5. **Video Blob Caching**: Fetch once, play multiple times
6. **Blob URL Cleanup**: Revoke blob URLs on component unmount

---

## 🔒 Security Considerations

1. **API Keys**: Stored in `.env`, never committed
2. **Client-Side Only**: No backend, all API calls from browser
3. **VEO Auth**: Video URLs include API key for playback
4. **Prompt Sanitisation**: Remove people-related terms for VEO
5. **Blob URLs**: Local browser memory, no external exposure

---

*Last Updated: 17 December 2025 - v0.5.0 Full Calendar Scheduling*

