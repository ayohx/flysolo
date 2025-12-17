# 📚 FlySolo Documentation

> Comprehensive documentation for the FlySolo AI-powered social media content generator.

---

## 📖 Documentation Index

| Document | Purpose |
|----------|---------|
| [DEVLOG.md](./DEVLOG.md) | Development timeline, decisions, changelog (BMAD) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture and data models |
| [ISSUES.md](./ISSUES.md) | Bug tracker and known issues |

---

## 🚀 Quick Links

- **[Main README](../README.md)** — Getting started guide
- **[Environment Setup](../.env.example)** — API key configuration

---

## 📋 How to Use This Documentation

### For Developers
1. Start with [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system
2. Check [ISSUES.md](./ISSUES.md) for known problems and workarounds
3. Review [DEVLOG.md](./DEVLOG.md) for context on past decisions

### For Contributors
1. Read the Architecture to understand code structure
2. Check Issues for things to work on
3. Update DEVLOG when making significant changes

### For Project Managers
1. DEVLOG contains timeline and progress
2. Issues tracks outstanding work
3. Architecture explains technical choices

---

## ✍️ Contributing to Documentation

When making changes to FlySolo, please update the relevant documentation:

| Change Type | Update |
|-------------|--------|
| New feature | DEVLOG.md (Timeline + ADR if significant) |
| Bug fix | DEVLOG.md (Issues & Solutions) |
| New bug found | ISSUES.md |
| Architecture change | ARCHITECTURE.md + DEVLOG.md (ADR) |
| Configuration change | .env.example + relevant docs |

### DEVLOG Entry Format

```markdown
### Issue #XXX: [Title]
**Date**: [Date]  
**Severity**: Critical | High | Medium | Low  
**Symptom**: [What user sees]  
**Root Cause**: [Technical reason]  
**Solution**: [How it was fixed]

[Code snippet if helpful]
```

### ADR Format (Architecture Decision Record)

```markdown
### ADR-XXX: [Title]
**Date**: [Date]  
**Status**: Proposed | Accepted | Deprecated  
**Context**: [Why decision was needed]  
**Decision**: [What was decided]  
**Consequences**: [Trade-offs and implications]
```

---

*Last Updated: 17 December 2025*

