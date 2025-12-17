# 🚀 FlySolo

> **AI-Powered Social Media Content Generator** — Analyse your brand, generate stunning posts, and schedule content across platforms with the power of Google Gemini.

![FlySolo](https://img.shields.io/badge/Powered%20by-Gemini%202.5-blue?style=for-the-badge&logo=google)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite)

---

## 🎉 Recent Updates (Dec 17, 2025)

### ✅ Bug Fixes - Commit a880e3d

**1. Fixed Blank Screen Bug** 🐛
- **Problem**: Rapid swiping caused blank screen when cards exhausted before generation completed
- **Solution**: 
  - Eager loading (triggers at 10 cards instead of 5)
  - Improved loading state logic with race condition handling
  - Added "View Saved Assets" escape button during loading
  - Better UX with asset counts
- **Impact**: Smooth, uninterrupted swiping experience

**2. Enhanced Image Quality & Brand Alignment** 🎨
- **Problem**: AI-generated images were generic and didn't match brand DNA
- **Solution**:
  - Restructured image generation prompts with explicit brand enforcement
  - Implemented 6-step mandatory structure for visual composition
  - Forces 30-50 word detailed prompts with specific colors, lighting, and style
  - Provides good/bad examples to AI for quality control
- **Impact**: Professional, on-brand imagery that matches company identity

**Testing**: See [TESTING_REPORT.md](./TESTING_REPORT.md) for comprehensive test cases

---

## ✨ Features

- **🔍 Brand Analysis** — Input any website URL and let AI extract brand identity, colours, tone, products/services, and competitors
- **🎨 Content Generation** — Generate platform-optimised social media posts (Instagram, LinkedIn, Twitter/X, TikTok)
- **🖼️ AI Image Generation** — Create on-brand visuals using Imagen 3 with enhanced prompt engineering
- **🎬 AI Video Generation** — Animate images into short-form videos using VEO 2.0
- **👆 Swipe Interface** — Tinder-style card swiping with intelligent eager loading
- **📝 Smart Editing** — Refine posts with natural language instructions
- **📅 Content Calendar** — View and schedule your content with prominent calendar navigation
- **➕ Multi-Source Analysis** — Add additional URLs to enrich brand understanding
- **💾 Auto-Save** — All your work persists locally between sessions
- **🚀 Progressive Loading** — Smart image generation with fallbacks

---
## 🏗️ Project Structure

```
FlySolo/
├── App.tsx                   # Main application component & state management
├── index.tsx                 # React entry point
├── index.html                # HTML template
├── types.ts                  # TypeScript interfaces & types
├── components/
│   ├── Onboarding.tsx        # Initial URL input screen
│   ├── AnalysisLoader.tsx    # Progressive loading animation
│   ├── SwipeDeck.tsx         # Tinder-style content curation (UPDATED)
│   ├── Editor.tsx            # Post refinement modal
│   ├── Dashboard.tsx         # Saved posts & scheduling view
│   ├── CalendarPage.tsx      # Calendar wrapper with navigation
│   ├── CalendarView.tsx      # Calendar grid component
│   ├── BrandInfoCard.tsx     # Brand profile display
│   ├── LikedAssetsPanel.tsx  # Saved assets side panel
│   └── VideoPlayer.tsx       # Video playback component
├── services/
│   └── geminiService.ts      # Gemini API integration layer (UPDATED)
├── docs/
│   ├── DEVLOG.md             # Development log (BMAD)
│   ├── ISSUES.md             # Issue tracker
│   └── ARCHITECTURE.md       # Technical architecture
├── TESTING_REPORT.md         # Comprehensive testing guide (NEW)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env                      # Environment variables (not tracked)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Gemini API Key** — [Get yours here](https://aistudio.google.com/app/apikey)
- **Imagen API Key** (optional) — For dedicated image generation quota
- **VEO API Key** (optional) — For video generation

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ayohx/flysolo.git
   cd flysolo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   For **local development**, create a `.env` file:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env`:
   ```
   API_KEY=your_gemini_api_key_here
   IMAGEN_API_KEY=your_imagen_key_here  # Optional, defaults to API_KEY
   VEO_API_KEY=your_veo_key_here        # Optional, defaults to API_KEY
   ```

   For **Netlify deployment**, set these as build environment variables:
   - `VITE_GEMINI_API_KEY` (required)
   - `VITE_IMAGEN_API_KEY` (optional)
   - `VITE_VEO_API_KEY` (optional)

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:5173](http://localhost:5173)

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 5173 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run tests (if configured) |

---

## 🤖 AI Capabilities

FlySolo leverages **Google AI** models with enhanced prompt engineering:

| Feature | Model | Description |
|---------|-------|-------------|
| Brand Analysis | `gemini-2.5-flash` | Website crawling with Google Search grounding |
| Content Generation | `gemini-2.5-flash` | Platform-specific post creation with structured prompts |
| Post Refinement | `gemini-2.5-flash` | Natural language editing |
| Image Generation | `imagen-3.0-generate-001` | On-brand visual creation with enforced brand DNA |
| Video Generation | `veo-2.0-generate-001` | Animated short-form content (async) |
| Auto-Scheduling | `gemini-2.5-flash` | Strategic posting timeline |

### Prompt Engineering Enhancements

**Image Generation**:
- Structured brand DNA enforcement
- Explicit color palette integration
- Creative direction sections (composition, lighting, mood)
- Professional industry-specific styling
- Fallback to Lorem Picsum on failures

**Content Generation**:
- 6-step mandatory visual prompt structure
- 30-50 word detailed compositions required
- Forces specific: composition type, colors, lighting, style keywords
- Good/bad examples provided to AI

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key (Netlify) |
| `VITE_IMAGEN_API_KEY` | ⚪ Optional | Dedicated Imagen API key (defaults to GEMINI_API_KEY) |
| `VITE_VEO_API_KEY` | ⚪ Optional | VEO video generation key (defaults to GEMINI_API_KEY) |
| `VITE_VEO_API_KEY_2` | ⚪ Optional | Backup VEO key for failover |

**Local Development** (`.env`):
```
API_KEY=your_key_here
IMAGEN_API_KEY=your_key_here
VEO_API_KEY=your_key_here
```

> ⚠️ **Security Note**: Never commit your `.env` file. It's included in `.gitignore` by default.

---

## 📱 Supported Platforms

FlySolo generates optimised content for:

- 📸 **Instagram** — Visual-first, short punchy captions (< 30 words)
- 💼 **LinkedIn** — Long-form professional content (100-200 words)
- 🐦 **Twitter/X** — Short, provocative, news-centric
- 🎵 **TikTok** — Video-style, trend-aware content

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.8
- **Build Tool**: Vite 6
- **AI**: Google Gemini (`@google/genai` SDK)
- **Icons**: Lucide React
- **Styling**: Tailwind CSS (utility-first)
- **Hosting**: Netlify (continuous deployment)
- **State**: React useState + LocalStorage persistence

---

## 📚 Documentation

Comprehensive documentation is available in the repository:

| Document | Description |
|----------|-------------|
| [TESTING_REPORT.md](./TESTING_REPORT.md) | Comprehensive testing guide for recent fixes |
| [DEVLOG.md](./docs/DEVLOG.md) | Development timeline, decisions, issues & solutions (BMAD) |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical architecture, data models, API integration |
| [ISSUES.md](./docs/ISSUES.md) | Bug tracker and known issues |

---

## 🐛 Known Issues & Limitations

1. **Image Generation Speed**: Imagen 3 can be slow (5-15 seconds per image)
2. **Video Generation**: VEO 2.0 is async and can take minutes; polling every 10 seconds
3. **Brand Analysis**: Accuracy depends on website scrapability; some sites block crawlers
4. **Content Filters**: VEO rejects prompts with people/faces (RAI safety filters)

See [TESTING_REPORT.md](./TESTING_REPORT.md) for detailed limitations.

---

## 🧪 Testing

### Manual Testing
See [TESTING_REPORT.md](./TESTING_REPORT.md) for:
- Comprehensive test cases for Holiday Extras and Nike
- Blank screen bug verification steps
- Image quality checklist
- Edge case scenarios
- Observability checks

### Recommended Test Brands
- **Holiday Extras** (https://www.holidayextras.com) - Travel services
- **Nike** (https://www.nike.com) - Athletic apparel
- Your own company website!

---

## 🚢 Deployment

FlySolo is configured for **Netlify** with automatic deployments:

1. **Connect GitHub repo** to Netlify
2. **Set build command**: `npm run build`
3. **Set publish directory**: `dist`
4. **Add environment variables** in Netlify dashboard
5. **Push to main** → Auto-deploy

**Live URL**: https://flysolo-ai.netlify.app/

---

## 📄 License

This project is private and proprietary.

---

## 🙏 Acknowledgements

- [Google AI Studio](https://aistudio.google.com/) — For the Gemini, Imagen, and VEO APIs
- [Lucide](https://lucide.dev/) — Beautiful open-source icons
- [Vite](https://vitejs.dev/) — Next-generation frontend tooling
- [Netlify](https://www.netlify.com/) — Seamless deployment platform

---

<div align="center">
  <strong>Built with ❤️ and AI</strong>
  
  **Latest Update**: December 17, 2025 | **Commit**: a880e3d
</div>