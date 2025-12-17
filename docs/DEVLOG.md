# 📋 FlySolo Development Log (BMAD)

> **BMAD** = Big Map of All Decisions  
> A living document tracking the evolution, decisions, issues, and solutions throughout the FlySolo project.

---

## 📊 Project Overview

| Attribute | Value |
|-----------|-------|
| **Project Name** | FlySolo |
| **Purpose** | AI-powered social media content generator |
| **Primary AI** | Google Gemini 2.5 Flash |
| **Stack** | React 19 + TypeScript + Vite |
| **Start Date** | November 2025 |
| **Current Phase** | Active Development |

---

## 🗓️ Development Timeline

### Phase 1: Foundation (November 2025)
- [x] Project scaffolding with Vite + React + TypeScript
- [x] Core type definitions (`BrandProfile`, `SocialPost`, `AppState`)
- [x] Basic Gemini service integration
- [x] Onboarding flow with URL input
- [x] Analysis loader with progressive stages

### Phase 2: Core Features (November-December 2025)
- [x] Brand analysis with Google Search grounding
- [x] Content generation for multiple platforms
- [x] Swipe deck UI for content curation
- [x] Image generation with Imagen 3
- [x] Post editing with AI refinement
- [x] Dashboard for saved posts

### Phase 3: Enhanced Features (December 2025)
- [x] Video generation with VEO 2.0
- [x] LocalStorage persistence
- [x] Multi-source brand analysis
- [x] Custom content creation prompts
- [x] Liked assets panel
- [x] Video player component

### Phase 4: Navigation & UX (December 2025)
- [x] Calendar page with dedicated navigation
- [x] Prominent calendar toggle button (PC: text, Mobile: icon)
- [x] Back to assets navigation from calendar
- [x] Drag-drop scheduling on calendar

### Phase 5: Calendar Scheduling (17 December 2025)
- [x] Schedule button (+) on liked assets
- [x] ScheduleDialog with date/time picker (30-min intervals)
- [x] Calendar view modes: Daily / Weekly / Monthly
- [x] Drag-drop post rescheduling (Monthly view)
- [x] 30-minute time slots (Daily view)
- [x] Quick time selection buttons
- [x] Video playback CORS fix (blob URL)

### Phase 6: Polish & Production (Planned)
- [ ] Error handling improvements
- [ ] Rate limiting & quota management
- [ ] Export functionality
- [ ] Performance optimisations

---

## 🏗️ Architecture Decisions

### ADR-001: Single-Page Application with State Machine
**Date**: November 2025  
**Status**: Accepted  
**Context**: Need simple, fast navigation between app states  
**Decision**: Use `AppState` enum to manage application flow  
**Consequences**: Clean state transitions, easy to debug, but requires careful hydration for persistence

```typescript
export enum AppState {
  ONBOARDING = 'ONBOARDING',
  ANALYZING = 'ANALYZING',
  SWIPING = 'SWIPING',
  EDITOR = 'EDITOR',
  CALENDAR = 'CALENDAR',
  DASHBOARD = 'DASHBOARD'
}
```

### ADR-002: Separate AI Clients for Different Services
**Date**: December 2025  
**Status**: Accepted  
**Context**: Different Google AI services have different quotas and billing  
**Decision**: Create separate GoogleGenAI instances for text, image, and video

```typescript
const aiText = new GoogleGenAI({ apiKey: process.env.API_KEY });
const aiImage = new GoogleGenAI({ apiKey: process.env.IMAGEN_API_KEY || process.env.API_KEY });
const aiVideo = new GoogleGenAI({ apiKey: process.env.VEO_API_KEY || process.env.API_KEY });
```

**Consequences**: Allows different API keys per service, better quota management

### ADR-003: Two-Step Brand Analysis
**Date**: December 2025  
**Status**: Accepted  
**Context**: JSON mode + Google Search grounding don't work well together  
**Decision**: Split analysis into research phase (search) and structuring phase (JSON)

**Consequences**: More reliable results, slightly slower, requires two API calls

### ADR-004: Async Video Generation with Polling
**Date**: December 2025  
**Status**: Accepted  
**Context**: VEO 2.0 video generation takes 30-90 seconds  
**Decision**: Return operation name immediately, poll for completion every 10 seconds

**Consequences**: Non-blocking UX, requires cleanup of pending operations

### ADR-005: Dedicated Calendar Navigation
**Date**: 17 December 2025  
**Status**: Accepted  
**Context**: Users need quick access to content calendar from the main swiping view  
**Decision**: Add prominent calendar button visible on all devices:
- Desktop: Text button "Calendar" next to Fresh Start button
- Mobile: Fixed floating icon button in top-right corner

**Implementation**:
```typescript
// Desktop - inline with other controls
<button onClick={onCalendar} className="...">
  <Calendar size={16} /> Calendar
</button>

// Mobile - fixed position, always visible
<button onClick={onCalendar} className="lg:hidden fixed top-4 right-4 z-40 p-3 bg-indigo-600 ...">
  <Calendar size={20} />
</button>
```

**Consequences**: 
- Always-visible calendar access improves discoverability
- New `CALENDAR` AppState for dedicated view
- `CalendarPage` component wraps `CalendarView` with navigation

### ADR-006: Multi-View Calendar with Drag-Drop Scheduling
**Date**: 17 December 2025  
**Status**: Accepted  
**Context**: Users need flexible scheduling with different views for different planning needs  
**Decision**: Implement three calendar views with specific behaviours:

| View | Features |
|------|----------|
| **Monthly** | Drag-drop between days, auto-stack on drop, show up to 3 posts per day |
| **Weekly** | 7-column layout, better for weekly planning |
| **Daily** | 30-minute time slots, drag-drop for precise timing |

**Implementation**:
```typescript
type ViewMode = 'daily' | 'weekly' | 'monthly';

// Drag-drop on monthly view - auto-append to end of day
const handleDropOnDate = (date: Date, e: React.DragEvent) => {
  const existingPosts = getPostsForDate(date);
  if (existingPosts.length > 0) {
    const lastPost = existingPosts[existingPosts.length - 1];
    newDate.setMinutes(lastTime.getMinutes() + 30);
  }
  onReschedulePost(draggedPost.id, newDate.toISOString());
};

// Daily view - 30-min slots
const handleDropOnTimeSlot = (date: Date, timeSlot: string, e: React.DragEvent) => {
  const [hour, minute] = timeSlot.split(':').map(Number);
  newDate.setHours(hour, minute, 0, 0);
  onReschedulePost(draggedPost.id, newDate.toISOString());
};
```

**Consequences**:
- Flexible scheduling for different planning workflows
- Intuitive drag-drop interaction
- Auto-stacking prevents time conflicts

### ADR-007: Video Playback via Blob URL
**Date**: 17 December 2025  
**Status**: Accepted  
**Context**: VEO video URLs have CORS restrictions preventing direct browser playback  
**Decision**: Fetch video as blob and create local blob URL

**Implementation**:
```typescript
export const fetchVideoAsBlob = async (videoUrl: string): Promise<string | undefined> => {
  const response = await fetch(videoUrl, { mode: 'cors' });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

// Cleanup when player closes
export const revokeBlobUrl = (blobUrl: string): void => {
  if (blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
};
```

**Consequences**:
- Videos now play in-browser
- Slight delay while fetching blob
- Must revoke blob URLs to prevent memory leaks

### ADR-008: Image-to-Video Mode for VEO 2.0
**Date**: 17 December 2025  
**Status**: Accepted  
**Context**: Generated videos did not match source images at all  
**Problem**: The original implementation used TEXT-TO-VIDEO mode, completely ignoring the source image. VEO generated random videos based on text prompts alone, resulting in completely unrelated content (e.g., a pier image becoming an airport video).

**Decision**: Implement proper IMAGE-TO-VIDEO mode using VEO 2.0's reference image capability

**Implementation**:
```typescript
// Updated generatePostVideo to accept source image
export const generatePostVideo = async (
  visualPrompt: string, 
  profile: BrandProfile, 
  duration: "5s" | "10s" = "5s",
  sourceImage?: string  // NEW: base64 image data
): Promise<...> => {
  
  if (sourceImage && sourceImage.startsWith('data:image/')) {
    // IMAGE-TO-VIDEO mode - animates the actual image
    const requestBody = {
      model: "models/veo-2.0-generate-001",
      generateVideoConfig: {
        prompt: imageToVideoPrompt,
        image: {
          bytesBase64Encoded: imageBase64,
          mimeType: mimeType,
        },
        // ... other config
      },
    };
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideo?key=${apiKey}`,
      { method: 'POST', body: JSON.stringify(requestBody) }
    );
  } else {
    // TEXT-TO-VIDEO fallback
    // ... existing code
  }
};

// App.tsx now passes the source image
const result = await generatePostVideo(videoPrompt, brandProfile, '5s', editingPost.imageUrl);
```

**Consequences**:
- Videos now animate the actual source image
- Consistent visual identity between image and video
- Falls back to text-to-video if no image available
- Requires base64 image data (already stored in `imageUrl`)

---

## 🐛 Issues & Solutions

### Issue #001: Google Search + JSON Mode Incompatibility
**Date**: December 2025  
**Severity**: High  
**Symptom**: Brand analysis returning empty or malformed JSON when using Google Search grounding with `responseMimeType: "application/json"`  

**Root Cause**: Gemini's Google Search tool doesn't work reliably with structured JSON output mode.

**Solution**: Implemented two-step analysis:
1. First call: Research with Google Search (plain text response)
2. Second call: Structure into JSON (no search tool)

```typescript
// Step 1: Research
const researchResponse = await aiText.models.generateContent({
  model: modelId,
  contents: researchPrompt,
  config: { tools: [{ googleSearch: {} }] },  // No JSON mode
});

// Step 2: Structure
const structureResponse = await aiText.models.generateContent({
  model: modelId,
  contents: structurePrompt,
  config: { responseMimeType: "application/json", responseSchema: schema },
});
```

---

### Issue #002: VEO RAI Safety Filter Rejections
**Date**: December 2025  
**Severity**: Medium  
**Symptom**: Video generation failing with content moderation errors even with `personGeneration: "dont_allow"`

**Root Cause**: VEO still rejects prompts that *mention* people-related terms, even if instructed not to generate them.

**Solution**: Prompt sanitisation function to remove people-related terms:

```typescript
const sanitisePromptForVideo = (prompt: string): string => {
  const peopleTerms = [
    /\b(person|people|man|woman|traveller|customer|family)\b/gi,
    // ... more patterns
  ];
  let sanitised = prompt;
  peopleTerms.forEach(regex => {
    sanitised = sanitised.replace(regex, '');
  });
  return sanitised.replace(/\s+/g, ' ').trim();
};
```

---

### Issue #003: LocalStorage Hydration Race Condition
**Date**: December 2025  
**Severity**: Medium  
**Symptom**: App sometimes shows onboarding even when state is saved

**Root Cause**: State updates from localStorage happening after initial render

**Solution**: Added `isHydrated` flag to prevent saving during hydration:

```typescript
const [isHydrated, setIsHydrated] = useState(false);

useEffect(() => {
  // Load from localStorage
  setIsHydrated(true);
}, []);

useEffect(() => {
  if (!isHydrated) return; // Don't save during hydration
  // Save state changes
}, [brandProfile, isHydrated]);
```

---

### Issue #004: Image Generation Failing Silently
**Date**: December 2025  
**Severity**: Low  
**Symptom**: Some cards showing blank images

**Root Cause**: Imagen 3 occasionally returns undefined without throwing

**Solution**: Retry loop with exponential backoff + fallback to Lorem Picsum:

```typescript
while (!b64Image && retries < MAX_RETRIES) {
  b64Image = await generatePostImage(post.visualPrompt, profile);
  if (!b64Image) {
    retries++;
    await new Promise(r => setTimeout(r, 1000 * retries));
  }
}
if (!b64Image) {
  b64Image = `https://picsum.photos/seed/${seed}/800/800`;
}
```

---

### Issue #005: VEO Video URL Authentication
**Date**: December 2025  
**Severity**: Medium  
**Symptom**: Video URLs returned by VEO not playable in browser

**Root Cause**: VEO video URLs require API key authentication

**Solution**: Append API key to video URL:

```typescript
const authenticatedUrl = videoUri.includes('?') 
  ? `${videoUri}&key=${apiKey}` 
  : `${videoUri}?key=${apiKey}`;
```

---

### Issue #006: Video CORS Playback Failure
**Date**: 17 December 2025  
**Severity**: High  
**Symptom**: Videos show "Unable to load video" even with authenticated URL

**Root Cause**: VEO video URLs (storage.googleapis.com) have CORS restrictions that prevent direct `<video>` element playback.

**Solution**: Fetch video as blob and create local blob URL:

```typescript
// In geminiService.ts
export const fetchVideoAsBlob = async (videoUrl: string): Promise<string | undefined> => {
  const response = await fetch(videoUrl, { mode: 'cors' });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

// In VideoPlayer.tsx
useEffect(() => {
  const loadVideo = async () => {
    const blob = await fetchVideoAsBlob(videoUrl);
    setBlobUrl(blob);
  };
  loadVideo();
  return () => revokeBlobUrl(blobUrl); // Cleanup
}, [videoUrl]);
```

**Result**: Videos now play correctly in-browser with fallback to download/external link.

---

### Issue #007: Video Content Not Matching Source Image
**Date**: 17 December 2025  
**Severity**: Critical  
**Symptom**: Generated video shows completely unrelated content to the source image (e.g., pier/ocean image generates airport/cars video)

**Root Cause**: The `generatePostVideo()` function was using TEXT-TO-VIDEO mode exclusively. It only passed the text prompt and brand profile to VEO, completely ignoring the actual source image. VEO generated entirely new content based on the text description alone.

**Solution**: Implemented proper IMAGE-TO-VIDEO mode:

```typescript
// Updated function signature to accept source image
export const generatePostVideo = async (
  visualPrompt: string, 
  profile: BrandProfile, 
  duration: "5s" | "10s" = "5s",
  sourceImage?: string  // NEW: base64 image data URL
): Promise<...> => {
  
  if (sourceImage && sourceImage.startsWith('data:image/')) {
    // Extract base64 and mime type
    const matches = sourceImage.match(/^data:(image\/\w+);base64,(.+)$/);
    const mimeType = matches[1];
    const imageBase64 = matches[2];
    
    // Use VEO 2.0 image-to-video API
    const requestBody = {
      model: "models/veo-2.0-generate-001",
      generateVideoConfig: {
        prompt: imageToVideoPrompt,
        image: {
          bytesBase64Encoded: imageBase64,
          mimeType: mimeType,
        },
        aspectRatio: "9:16",
        numberOfVideos: 1,
        durationSeconds: duration === "5s" ? 5 : 10,
        personGeneration: "dont_allow",
      },
    };
    
    // Call VEO directly for image-to-video
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideo?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
    );
  }
};

// App.tsx updated to pass the source image
const result = await generatePostVideo(videoPrompt, brandProfile, '5s', editingPost.imageUrl);
```

**Result**: Videos now animate the actual source image content, maintaining visual consistency.

---

## ⚙️ Configuration Reference

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | ✅ Yes | Primary API key for text generation |
| `IMAGEN_API_KEY` | Optional | Separate key for image generation (falls back to GEMINI_API_KEY) |
| `VEO_API_KEY` | Optional | Primary key for video generation |
| `VEO_API_KEY_2` | Optional | Backup key for video (failover) |

### Vite Configuration

```typescript
// vite.config.ts - Key settings
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.IMAGEN_API_KEY': JSON.stringify(env.IMAGEN_API_KEY),
  'process.env.VEO_API_KEY': JSON.stringify(env.VEO_API_KEY),
  'process.env.VEO_API_KEY_2': JSON.stringify(env.VEO_API_KEY_2),
}
```

---

## 📁 Component Index

| Component | Lines | Purpose |
|-----------|-------|---------|
| `App.tsx` | ~620 | Main state machine, all handlers |
| `Onboarding.tsx` | ~170 | URL input, error display |
| `AnalysisLoader.tsx` | ~220 | Progressive loading animation |
| `SwipeDeck.tsx` | ~550 | Card swiping interface |
| `Editor.tsx` | ~TBD | Post refinement modal |
| `Dashboard.tsx` | ~TBD | Saved posts grid |
| `BrandInfoCard.tsx` | ~TBD | Brand profile display |
| `CalendarPage.tsx` | ~85 | Calendar wrapper with navigation |
| `CalendarView.tsx` | ~380 | Multi-view calendar (Daily/Weekly/Monthly) |
| `ScheduleDialog.tsx` | ~170 | Date/time picker for scheduling |
| `LikedAssetsPanel.tsx` | ~280 | Side panel with schedule button |
| `VideoPlayer.tsx` | ~300 | Video playback with blob fetch |
| `geminiService.ts` | ~705 | All AI integration + blob utilities |

---

## 🔮 Future Roadmap

### Short-term (Q1 2025)
- [ ] Export to PNG/JPG/MP4
- [ ] Direct social media posting
- [ ] Analytics dashboard
- [ ] Team collaboration

### Medium-term (Q2 2025)
- [ ] Campaign management
- [ ] A/B testing suggestions
- [ ] Trend integration
- [ ] Multi-brand support

### Long-term
- [ ] White-label solution
- [ ] Agency dashboard
- [ ] AI learning from engagement
- [ ] Auto-optimisation

---

## 📅 Session Logs (BMAD)

### Session: 17 December 2025 (Night) — Full Calendar Scheduling System
**Duration**: ~2 hours  
**Focus**: Complete scheduling workflow, video playback fix

#### ✅ Work Completed
| Time | Task | Status |
|------|------|--------|
| 21:00 | Diagnosed video CORS playback issue | ✅ |
| 21:15 | Implemented `fetchVideoAsBlob()` utility | ✅ |
| 21:30 | Updated VideoPlayer with blob URL loading | ✅ |
| 21:45 | Created `ScheduleDialog.tsx` with date/time picker | ✅ |
| 22:00 | Added schedule button (+) to LikedAssetsPanel | ✅ |
| 22:15 | Rebuilt `CalendarView.tsx` with 3 view modes | ✅ |
| 22:30 | Implemented drag-drop for monthly view | ✅ |
| 22:45 | Implemented 30-min time slots for daily view | ✅ |
| 23:00 | Wired up `handleSchedulePost` & `handleReschedulePost` | ✅ |
| 23:15 | Updated all BMAD documentation | ✅ |

#### 🐛 Issues Encountered
- **Video CORS**: VEO URLs blocked by browser - solved with blob fetch (Issue #006)
- **Calendar UX**: Needed different behaviours for each view mode

#### 💡 Decisions Made
- ADR-006: Multi-view calendar with view-specific drag-drop behaviour
- ADR-007: Blob URL approach for video playback
- Auto-stack posts when dropping on day with existing posts
- 30-min intervals for precise scheduling in daily view

#### 📊 New Components
| Component | Lines | Purpose |
|-----------|-------|---------|
| `ScheduleDialog.tsx` | ~170 | Date/time picker modal |

---

### Session: 17 December 2025 (Evening) — Calendar & Documentation
**Duration**: ~2 hours  
**Focus**: Calendar navigation, documentation enhancement

#### ✅ Work Completed
| Time | Task | Status |
|------|------|--------|
| 18:00 | Identified calendar accessibility issue | ✅ |
| 18:15 | Created `CalendarPage.tsx` with sticky navigation | ✅ |
| 18:30 | Added calendar button to `SwipeDeck` (desktop + mobile) | ✅ |
| 18:45 | Added `CALENDAR` state to `AppState` enum | ✅ |
| 19:00 | Updated `App.tsx` with calendar routing | ✅ |
| 19:30 | Enhanced all documentation files | ✅ |

#### 🐛 Issues Encountered
- **Calendar Toggle**: Initial implementation used modal; changed to dedicated page for better UX

#### 💡 Decisions Made
- Chose dedicated `CALENDAR` state over modal overlay (ADR-005)
- Different UI for desktop (text) vs mobile (icon-only)

---

### Session: 17 December 2025 (Afternoon) — Video & Persistence
**Duration**: ~3 hours  
**Focus**: VEO video generation debugging, localStorage

#### ✅ Work Completed
| Time | Task | Status |
|------|------|--------|
| 14:00 | Investigated VEO video failures | ✅ |
| 14:30 | Created `sanitisePromptForVideo()` function | ✅ |
| 15:00 | Enhanced `checkVideoStatus()` with detailed logging | ✅ |
| 15:30 | Added `failureReason` to video status response | ✅ |
| 16:00 | Implemented localStorage persistence | ✅ |
| 16:30 | Added `isHydrated` flag to prevent race conditions | ✅ |
| 17:00 | Added "Fresh Start" button to clear saved data | ✅ |

#### 🐛 Issues Encountered
- **VEO RAI Filters**: Videos failing even with `personGeneration: "dont_allow"`
- **Solution**: Prompt sanitisation to remove people-related terms
- **Result**: Some prompts now succeed, but ~60% still rejected

#### 💡 Lessons Learned
- VEO's RAI filters scan prompt text, not just generated content
- Terms like "traveller", "customer", "family" trigger rejection
- Abstract/scenic prompts have highest success rate

---

### Session: 16 December 2025 — Multi-API & UX Polish
**Duration**: ~4 hours  
**Focus**: Multiple API keys, swipe UX improvements

#### ✅ Work Completed
- Implemented separate API clients (`aiText`, `aiImage`, `aiVideo`, `aiVideoBackup`)
- Added drag-to-swipe gesture with 150ms hold threshold
- Fixed click-to-edit vs swipe detection
- Added matrix rain effect to `AnalysisLoader`
- Enhanced `BrandInfoCard` with collapsible sections
- Added inline editing for brand profile fields

---

## 📝 Changelog

### v0.5.3 (17 December 2025) - Video Motion Prompt Complete Fix
- 🐛 **CRITICAL FIX**: Video prompts now use user's actual motion instructions
- 🐛 **Fixed**: Quick Animate button was ignoring user's typed instruction
- 🐛 **Fixed**: URL images (placeholders) are now converted to base64 for VEO
- ✨ **URL→Base64**: Auto-converts https:// images to base64 for video API
- ✨ **Graceful Fallback**: SDK image-to-video → text-to-video with motion prompt
- ✨ **Improved Logging**: Full debug trail for video generation flow
- 📝 Video now generates based on YOUR motion description, not generic text

### v0.5.2 (17 December 2025) - Image-to-Video Prompt Fix
- 🐛 **CRITICAL FIX**: Motion prompts now focus ONLY on animation, not image description
- 🐛 **Fixed**: App was sending image description text to VEO instead of motion instructions
- ✨ **Improved Logging**: Better console output for debugging VEO API calls
- ✨ **Better Error Handling**: Clear failure reasons when image-to-video fails
- 📝 Updated ADR-008 with prompt best practices

### v0.5.1 (17 December 2025) - Image-to-Video Mode
- 🐛 **CRITICAL FIX**: Videos now animate source images instead of generating unrelated content
- ✨ **Image-to-Video Mode**: VEO 2.0 now uses source image as reference for animation
- 📝 Added ADR-008 (Image-to-Video Mode)
- 📝 Added Issue #007 (Video Content Mismatch)

### v0.5.0 (17 December 2025) - Full Calendar Scheduling
- ✨ **Schedule Dialog**: Date/time picker with 30-min intervals
- ✨ **Schedule Button**: (+) on each liked asset opens schedule dialog
- ✨ **Multi-View Calendar**: Daily / Weekly / Monthly view modes
- ✨ **Drag-Drop Scheduling**: Drag posts between days (Monthly) or time slots (Daily)
- ✨ **Auto-Stack**: Dropping on a day with posts auto-appends to end
- ✨ **Video Playback Fix**: Fetch as blob to bypass CORS restrictions
- ✨ **Quick Time Buttons**: 9AM, 12PM, 3PM, 6PM, 8PM presets
- 📝 Added ADR-006 (Multi-View Calendar) and ADR-007 (Video Blob)
- 📝 Full BMAD documentation update

### v0.4.0 (17 December 2025) - Calendar Navigation
- ✨ Added dedicated Calendar page with sticky header
- ✨ Added prominent calendar button (Desktop: text, Mobile: icon)
- ✨ Added "Back to Assets" navigation from calendar
- ✨ Added CALENDAR to AppState enum
- ✨ Added CalendarPage wrapper component
- 📝 Updated all BMAD documentation

### v0.3.0 (December 2025) - Video Generation
- Added VEO 2.0 video generation
- Added video player component
- Added prompt sanitisation for RAI compliance
- Added backup API key failover for video
- Fixed video URL authentication
- Added separate video/image asset handling in liked posts

### v0.2.0 (December 2025) - Persistence & Polish
- Added LocalStorage persistence
- Added liked assets panel
- Added custom content creation
- Added multi-source brand analysis
- Fixed JSON+Search incompatibility

### v0.1.0 (November 2025) - Initial Release
- Initial release
- Brand analysis with Google Search
- Content generation for 4 platforms
- Image generation with Imagen 3
- Swipe deck interface
- Basic dashboard

---

## 👥 Contributors

| Name | Role | Since |
|------|------|-------|
| Ayo Ogunrekun | Project Lead | November 2025 |

---

*Last Updated: 17 December 2025 - v0.5.0 Full Calendar Scheduling*

