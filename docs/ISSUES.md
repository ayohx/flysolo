# 🐛 FlySolo Issue Tracker

> Active issues, known bugs, and planned fixes.  
> For resolved issues, see [DEVLOG.md](./DEVLOG.md#-issues--solutions)

---

## 🔴 Critical Issues

*None currently*

---

## 🟠 High Priority

### ISS-006: VEO RAI Safety Filter Rejections
**Status**: Open (Partially Mitigated)  
**Reported**: 17 December 2025  
**Updated**: 17 December 2025  
**Symptoms**: Video generation fails with content moderation errors  
**Root Cause**: VEO's RAI filters reject prompts containing people-related terms even when `personGeneration: "dont_allow"` is set. The filter scans the prompt text itself, not just the generated content.  
**Workaround**: 
- Implemented `sanitisePromptForVideo()` to remove terms like "traveller", "customer", "family"
- Added critical requirements to prompts: "NO people, NO faces, NO human figures"
- Using backup API key (VEO_API_KEY_2) when primary fails  
**Success Rate**: ~40% of prompts now succeed (up from ~10%)  
**Planned Fix**: 
1. Pre-filter prompts through Gemini to rewrite people-focused prompts into scenic equivalents
2. Fallback to animated image (GIF) when video fails
3. User notification with option to retry with different prompt

---

## 🟡 Medium Priority

### ISS-007: Video Assets Not Persisted
**Status**: Open  
**Reported**: 17 December 2025  
**Symptoms**: Video generation state lost on page refresh  
**Root Cause**: `pendingVideos` Map not saved to localStorage  
**Planned Fix**: Serialise video operation names to localStorage

---

### ISS-008: Brand Profile Edit Not Reflected
**Status**: Open  
**Reported**: 17 December 2025  
**Symptoms**: Editing brand profile in side panel doesn't regenerate content  
**Expected**: New content should use updated profile  
**Planned Fix**: Add "regenerate with new profile" button

---

## 🟢 Low Priority

### ISS-010: Missing Export Functionality
**Status**: Open  
**Reported**: 17 December 2025  
**Symptoms**: No way to download generated content  
**Planned Fix**: Add export buttons for PNG/JPG/MP4

---

---

## ✅ Recently Resolved

| Issue | Title | Resolved | Solution |
|-------|-------|----------|----------|
| ISS-001 | JSON+Search Incompatibility | Dec 2025 | Two-step analysis |
| ISS-002 | VEO RAI Filter Rejections | Dec 2025 | Prompt sanitisation |
| ISS-003 | LocalStorage Hydration Race | Dec 2025 | isHydrated flag |
| ISS-004 | Silent Image Failures | Dec 2025 | Retry + fallback |
| ISS-005 | VEO URL Authentication | Dec 2025 | Append API key |
| ISS-009 | Calendar View Not Functional | 17 Dec 2025 | CalendarPage + navigation buttons |
| ISS-011 | Calendar Drag-Drop Scheduling | 17 Dec 2025 | Multi-view calendar with drag-drop |
| ISS-012 | Video CORS Playback Failure | 17 Dec 2025 | Blob URL fetch |
| ISS-013 | **Video Not Matching Source Image** | 17 Dec 2025 | Image-to-Video mode + fallback |
| ISS-014 | **Video Using Wrong Prompt** | 17 Dec 2025 | Quick Animate uses user's instruction |
| ISS-015 | **Netlify API Key Invalid** | 17 Dec 2025 | Fixed O vs 0 typo via Netlify CLI |
| ISS-016 | **Blank Screen on Production** | 17 Dec 2025 | Lazy client init + error screen |
| ISS-017 | **VEO RAI Filter Rejections** | 17 Dec 2025 | Safe motion prompts + REST API fallback |
| ISS-018 | **Blank Screen After Swiping All Cards** | 17 Dec 2025 | In-deck empty state card + keep saved assets panel available + “Generate more” CTA |
| ISS-019 | **Off-Brand Images (Random Landscapes)** | 17 Dec 2025 | Replaced Picsum fallback with branded placeholder + added Imagen model fallback list |
| ISS-020 | **Offerings/Strategy Empty** | 17 Dec 2025 | Normalised brand profile output; ensure offerings/strategy always populated (fallback heuristics) |

---

## 📋 Issue Template

```markdown
### ISS-XXX: [Title]
**Status**: Open | In Progress | Resolved  
**Priority**: Critical | High | Medium | Low  
**Reported**: [Date]  
**Symptoms**: [What the user sees]  
**Root Cause**: [Technical reason]  
**Workaround**: [Temporary fix if any]  
**Planned Fix**: [Solution approach]  
**Resolved**: [Date and how]
```

---

*Last Updated: 17 December 2025 - ISS-020 Resolved (Deck Empty State + Imagen Fallback + Profile Normalisation)*

