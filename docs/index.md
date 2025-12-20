# FlySolo Project Documentation

> **Master AI Entry Point** — Comprehensive project documentation for AI agents and developers

---

## 📋 Quick Navigation

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [Project Overview](./project-overview.md) | High-level project context, goals, and scope | 19 Dec 2025 |
| [Architecture](./ARCHITECTURE.md) | Technical architecture, data models, API integration | 20 Dec 2024 |
| [Source Tree Analysis](./source-tree-analysis.md) | Codebase structure and file organisation | 19 Dec 2025 |
| [Development Log](./DEVLOG.md) | Timeline, decisions, issues, and solutions (BMAD) | 20 Dec 2024 |
| [Issues Tracker](./ISSUES.md) | Known bugs and limitations | 19 Dec 2025 |
| [Sprint Status](./sprint-status.yaml) | Current sprint progress and tasks | 20 Dec 2024 |

### 📖 Story Documentation

| Story | Title | Status |
|-------|-------|--------|
| [STORY-011](./stories/STORY-011-rate-limiting-and-caching.md) | Rate Limiting and Content Caching | ✅ Complete |
| [STORY-012](./stories/STORY-012-veo-image-to-video-fix.md) | VEO Image-to-Video Analysis | ✅ Complete |
| [STORY-013](./stories/STORY-013-veo-video-and-brand-navigation.md) | VEO Vertex AI & Brand Navigation | ✅ Complete |

---

## 🎯 Project Summary

**FlySolo** is an AI-powered social media content generator that analyses brand websites, generates platform-optimised posts, and creates visual content using Google Gemini, Imagen 3, and VEO 2.0.

**Key Capabilities:**
- Brand DNA analysis from website URLs
- Multi-platform content generation (Instagram, LinkedIn, Twitter/X, TikTok)
- AI image generation with brand-aware prompts
- Video animation from static images
- Content calendar and scheduling
- Multi-brand workspace management

**Tech Stack:**
- Frontend: React 19 + TypeScript 5.8 + Vite 6
- AI: Google Gemini 2.5 Flash, Imagen 3, VEO 2.0
- Database: Supabase (PostgreSQL)
- Hosting: Netlify
- State: React hooks + LocalStorage + Supabase

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FlySolo Application                   │
├─────────────────────────────────────────────────────────┤
│  App.tsx (State Machine)                                │
│  ├── BrandSelector (Landing Page)                      │
│  ├── Onboarding (URL Input)                            │
│  ├── AnalysisLoader (Progressive Loading)               │
│  ├── SwipeDeck (Content Curation)                       │
│  │   ├── BrandInfoCard (Sidebar)                       │
│  │   └── LikedAssetsPanel (Saved Posts)                 │
│  ├── Editor (Post Refinement)                           │
│  ├── CalendarPage (Scheduling)                          │
│  └── Dashboard (Saved Content)                          │
├─────────────────────────────────────────────────────────┤
│  Services Layer                                         │
│  ├── geminiService.ts (AI Integration)                  │
│  ├── supabaseService.ts (Database)                      │
│  └── pexelsService.ts (Image Fallback)                  │
└─────────────────────────────────────────────────────────┘
```

**State Flow:**
```
BRAND_SELECTOR → ONBOARDING → ANALYZING → SWIPING
                                              ├──→ EDITOR
                                              ├──→ CALENDAR
                                              └──→ DASHBOARD
```

---

## 📁 Project Structure

```
FlySolo/
├── App.tsx                    # Main state machine & orchestration
├── index.tsx                  # React entry point
├── types.ts                   # TypeScript interfaces
├── components/                # React components
│   ├── BrandSelector.tsx      # Multi-brand landing page
│   ├── Onboarding.tsx         # URL input screen
│   ├── AnalysisLoader.tsx     # Progressive loading
│   ├── SwipeDeck.tsx          # Card swiping interface
│   ├── BrandInfoCard.tsx      # Brand profile sidebar
│   ├── LikedAssetsPanel.tsx   # Saved posts panel
│   ├── Editor.tsx             # Post editing modal
│   ├── CalendarPage.tsx       # Calendar wrapper
│   ├── CalendarView.tsx       # Calendar grid component
│   ├── Dashboard.tsx          # Saved content grid
│   ├── Toast.tsx              # Modern notifications
│   └── ...
├── services/                  # Business logic layer
│   ├── geminiService.ts       # Google AI integration
│   ├── supabaseService.ts     # Database operations
│   └── pexelsService.ts       # Image search fallback
├── docs/                      # Documentation
│   ├── index.md               # This file (master entry)
│   ├── project-overview.md    # Project context
│   ├── ARCHITECTURE.md        # Technical architecture
│   ├── source-tree-analysis.md # Code structure
│   ├── DEVLOG.md              # Development timeline
│   └── ISSUES.md              # Bug tracker
└── netlify/                   # Serverless functions
    └── functions/
        └── generate-video.ts  # VEO video proxy
```

---

## 🔑 Key Concepts

### Brand Workspace
Multi-brand support allowing users to save, switch, and manage multiple brand profiles. Each brand has its own workspace with saved posts, assets, and analysis data stored in Supabase.

### Brand DNA Profile
Structured brand information extracted from website analysis:
- **Identity**: Name, industry, essence
- **Visual**: Colours, logo, visual style
- **Offerings**: Products/services list
- **Strategy**: Marketing approach
- **Intelligence**: Social handles, competitors

### Content Generation Pipeline
1. **Brand Analysis** → Extract brand DNA from website
2. **Content Ideas** → Generate platform-specific posts
3. **Image Generation** → Create visuals (Imagen 3 → Pexels fallback)
4. **Video Animation** → Animate images (VEO 2.0, async)
5. **Scheduling** → Calendar integration

### Image Generation Strategy
**Priority Order:**
1. Supabase stored assets (real product images)
2. Imagen 3 (4 API keys rotation)
3. Pexels API (industry-aware search)
4. Branded placeholder (SVG with brand colours)

---

## 🗄️ Data Models

### BrandProfile
```typescript
interface BrandProfile {
  name: string;
  industry: string;
  colors: string[];
  vibe: string;
  competitors: string[];
  strategy: string;
  services: string[];
  logoUrl?: string;
  assets?: string[];
  essence?: string;
  confidence?: number;
}
```

### SocialPost
```typescript
interface SocialPost {
  id: string;
  platform: 'Instagram' | 'LinkedIn' | 'Twitter/X' | 'TikTok';
  caption: string;
  hashtags: string[];
  visualPrompt: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'generating_image' | 'ready' | 'liked' | 'discarded';
  scheduledDate?: string;
}
```

---

## 🔌 External Integrations

### Google AI Platform
- **Gemini 2.5 Flash**: Brand analysis, content generation, refinement
- **Imagen 3**: Image generation (multiple model fallbacks)
- **VEO 2.0**: Video animation (async with polling)

### Supabase
- **Tables**: `brands`, `brand_assets`, `saved_posts`
- **Purpose**: Persistent storage for brand workspaces
- **Operations**: CRUD for brands, assets, and saved content

### Pexels API
- **Purpose**: Image search fallback when AI generation fails
- **Strategy**: Industry-aware search queries
- **Usage**: Last resort before branded placeholder

---

## 🚀 Development Workflow

### Current Phase
**Active Development** — Feature enhancements and bug fixes

### Recent Updates (v0.9.0 - 20 Dec 2024)
- ✅ VEO video generation via Vertex AI
- ✅ Image-to-video with source image as first frame
- ✅ URL-based brand navigation (`/brand/brand-slug`)
- ✅ Instant brand switching with state clearing
- ✅ Status polling via Netlify serverless function (CORS fix)
- ✅ Rate limiting for API calls
- ✅ Content caching to reduce API usage

### Previous Updates (v0.8.0)
- ✅ Brand workspace with multi-brand support
- ✅ Modern toast notifications
- ✅ Logo fallback with brand initials
- ✅ Industry-aware Pexels search
- ✅ Multi-API key rotation for Imagen

### Next Steps
- [ ] Video playback UI component
- [ ] Video caching/storage
- [ ] Export functionality
- [ ] Performance optimisations (code splitting)

---

## 📚 Documentation Standards

This project follows **BMAD (Big Map of All Decisions)** framework:
- **CommonMark** markdown format
- **Mermaid** diagrams for visualisations
- **ADR** (Architecture Decision Records) in DEVLOG
- **British English** for all documentation

---

## 🔍 For AI Agents

**When working on FlySolo:**
1. **Start here** (`docs/index.md`) for project context
2. **Read** `project-overview.md` for business context
3. **Review** `ARCHITECTURE.md` for technical details
4. **Check** `source-tree-analysis.md` for code structure
5. **Reference** `DEVLOG.md` for historical decisions
6. **Update** `ISSUES.md` when finding bugs

**Key Files to Understand:**
- `App.tsx` — State management and orchestration
- `services/geminiService.ts` — AI integration logic
- `services/supabaseService.ts` — Database operations
- `types.ts` — Type definitions

---

## 📝 Contributing

When making changes:
1. Update relevant documentation
2. Add ADR entries for significant decisions
3. Update ISSUES.md for bug fixes
4. Follow existing code patterns
5. Use British English

---

*Last Updated: 20 December 2024*  
*Documentation Version: 1.1 (BMAD Framework)*

