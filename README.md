# 🚀 FlySolo

> **AI-Powered Social Media Content Generator** — Analyse your brand, generate stunning posts, and schedule content across platforms with the power of Google Gemini.

![FlySolo](https://img.shields.io/badge/Powered%20by-Gemini%202.5-blue?style=for-the-badge&logo=google)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite)

---

## ✨ Features

- **🔍 Brand Analysis** — Input any website URL and let AI extract brand identity, colours, tone, products/services, and competitors
- **🎨 Content Generation** — Generate platform-optimised social media posts (Instagram, LinkedIn, Twitter/X, TikTok)
- **🖼️ AI Image Generation** — Create on-brand visuals using Imagen 3
- **🎬 AI Video Generation** — Animate images into short-form videos using VEO 2.0
- **👆 Swipe Interface** — Tinder-style card swiping to curate your content library
- **📝 Smart Editing** — Refine posts with natural language instructions
- **📅 Content Calendar** — View and schedule your content with prominent calendar navigation
- **➕ Multi-Source Analysis** — Add additional URLs to enrich brand understanding
- **💾 Auto-Save** — All your work persists locally between sessions

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
│   ├── SwipeDeck.tsx         # Tinder-style content curation
│   ├── Editor.tsx            # Post refinement modal
│   ├── Dashboard.tsx         # Saved posts & scheduling view
│   ├── CalendarPage.tsx      # Calendar wrapper with navigation
│   ├── CalendarView.tsx      # Calendar grid component
│   ├── BrandInfoCard.tsx     # Brand profile display
│   ├── LikedAssetsPanel.tsx  # Saved assets side panel
│   └── VideoPlayer.tsx       # Video playback component
├── services/
│   └── geminiService.ts      # Gemini API integration layer
├── docs/
│   ├── DEVLOG.md             # Development log (BMAD)
│   ├── ISSUES.md             # Issue tracker
│   └── ARCHITECTURE.md       # Technical architecture
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

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/FlySolo.git
   cd FlySolo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

---

## 🤖 AI Capabilities

FlySolo leverages **Google AI** models:

| Feature | Model | Description |
|---------|-------|-------------|
| Brand Analysis | `gemini-2.5-flash` | Website crawling with Google Search grounding |
| Content Generation | `gemini-2.5-flash` | Platform-specific post creation |
| Post Refinement | `gemini-2.5-flash` | Natural language editing |
| Image Generation | `imagen-3.0` | On-brand visual creation |
| Video Generation | `veo-2.0` | Animated short-form content |
| Auto-Scheduling | `gemini-2.5-flash` | Strategic posting timeline |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key |

> ⚠️ **Security Note**: Never commit your `.env` file. It's included in `.gitignore` by default.

---

## 📱 Supported Platforms

FlySolo generates optimised content for:

- 📸 **Instagram** — Visual-first, short punchy captions
- 💼 **LinkedIn** — Long-form professional content (100-200 words)
- 🐦 **Twitter/X** — Short, provocative, news-centric
- 🎵 **TikTok** — Video-style, trend-aware content

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.8
- **Build Tool**: Vite 6
- **AI**: Google Gemini (`@google/genai`)
- **Icons**: Lucide React
- **Styling**: Tailwind CSS (inline)

---

## 📚 Documentation

Comprehensive documentation is available in the `/docs` folder:

| Document | Description |
|----------|-------------|
| [DEVLOG.md](./docs/DEVLOG.md) | Development timeline, decisions, issues & solutions (BMAD) |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical architecture, data models, API integration |
| [ISSUES.md](./docs/ISSUES.md) | Bug tracker and known issues |

---

## 📄 Licence

This project is private and proprietary.

---

## 🙏 Acknowledgements

- [Google AI Studio](https://aistudio.google.com/) — For the Gemini API
- [Lucide](https://lucide.dev/) — Beautiful open-source icons
- [Vite](https://vitejs.dev/) — Next-generation frontend tooling

---

<div align="center">
  <strong>Built with ❤️ and AI</strong>
</div>
