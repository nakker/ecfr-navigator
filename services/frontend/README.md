# Frontend Service

The Frontend Service is a modern web application for the eCFR Navigator project, providing an intuitive interface for searching, browsing, and analyzing federal regulations.

## Overview

Built with Next.js and Material-UI, this service delivers a responsive, user-friendly experience for exploring the Code of Federal Regulations (CFR). It features real-time search, interactive metrics visualization, AI-powered analysis insights, and comprehensive document management.

## Features

- **Full-text Search**: Fast regulation search with filters and highlighting
- **Document Browser**: Hierarchical navigation through CFR titles and sections
- **Metrics Dashboard**: Interactive charts for regulation analytics
- **AI Analysis**: View AI-generated summaries and business impact scores
- **Chat Interface**: Real-time AI chat for regulation questions
- **Service Monitoring**: Track data refresh and analysis operations
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Optimized for desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 14.0.4
- **UI Library**: Material-UI (MUI) 5.15.0
- **State Management**: React Query 3.39.3
- **Language**: TypeScript
- **Styling**: Emotion (CSS-in-JS)
- **Charts**: Recharts 2.10.3
- **HTTP Client**: Axios 1.6.2

## Project Structure

```
frontend/
├── pages/                    # Next.js pages (routes)
│   ├── index.tsx            # Home page with search
│   ├── analysis.tsx         # AI analysis dashboard
│   ├── settings.tsx         # Application settings
│   ├── title/
│   │   └── [number].tsx     # Individual title details
│   ├── _app.tsx             # App wrapper with theme
│   └── _document.tsx        # HTML document template
├── components/              # React components
│   ├── Navigation.tsx       # Main navigation bar
│   ├── TitlesList.tsx       # CFR titles listing
│   ├── DocumentsList.tsx    # Document tree view
│   ├── SearchResults.tsx    # Search results display
│   ├── AggregateMetrics.tsx # Overall metrics
│   ├── TitleMetrics.tsx     # Title-specific metrics
│   ├── ChatWidget.tsx       # AI chat interface
│   ├── AnalysisStatus.tsx   # Analysis progress
│   └── ... (more components)
├── contexts/                # React contexts
│   └── ThemeContext.tsx     # Theme management
├── public/                  # Static assets
├── styles/                  # Global styles
├── shared/                  # Shared modules (synced)
├── next.config.js          # Next.js configuration
├── package.json            # Dependencies
└── Dockerfile              # Container configuration
```

## Pages

### Home Page (`/`)
- Search interface with real-time results
- Aggregate metrics dashboard
- List of all CFR titles with sorting
- Highlighted AI-analyzed sections

### Analysis Dashboard (`/analysis`)
- Overview of AI analysis results
- Grid/list view of analyzed sections
- Sort by antiquated score or business impact
- Direct navigation to regulation sections

### Settings (`/settings`)
- Theme toggle (light/dark mode)
- Service status monitoring
- Analysis thread management
- Regulatory keywords configuration
- Manual refresh/analysis triggers
- Search index management

### Title Details (`/title/[number]`)
- Title information and metrics
- Hierarchical document browser
- AI analysis insights
- Interactive chat widget
- XML download options

## Key Components

### Data Display
- **TitlesList**: Displays all CFR titles with metrics
- **DocumentsList**: Tree view for navigating documents
- **SearchResults**: Paginated search results with highlighting
- **VersionTimeline**: Visual timeline of document versions

### Metrics & Analytics
- **AggregateMetrics**: System-wide statistics
- **TitleMetrics**: Charts for word count, age, complexity
- **TitleAnalysisInsights**: AI-generated summaries
- **HighlightedSections**: Featured analyzed sections

### Interactive Features
- **ChatWidget**: AI-powered chat for regulation questions
- **AnalysisStatus**: Real-time progress indicators
- **AnalysisThreadsControl**: Manage analysis processes

## Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Application Settings
NEXT_PUBLIC_APP_NAME="eCFR Navigator"
NEXT_PUBLIC_REFRESH_INTERVAL=30000  # 30 seconds

# Feature Flags
NEXT_PUBLIC_ENABLE_CHAT=true
NEXT_PUBLIC_ENABLE_ANALYSIS=true
```

## Development

### Local Setup

1. Ensure backend service is running
2. Copy `.env.example` to `.env.local`
3. Sync shared modules: `../../sync-shared.sh`
4. Install dependencies: `npm install`
5. Start development server: `npm run dev`

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

### Running with Docker

```bash
# From project root
docker-compose up frontend
```

## API Integration

All API calls are proxied through Next.js to the backend service:

- `/api/search` - Full-text search
- `/api/documents` - Document operations
- `/api/titles` - Title information
- `/api/metrics` - Analytics data
- `/api/analysis` - AI analysis results
- `/api/chat` - Chat completions
- `/api/services` - Service management

## UI/UX Features

### Theme Support
- Light and dark mode
- Persistent theme selection
- System preference detection

### Responsive Design
- Mobile-first approach
- Breakpoints: xs, sm, md, lg, xl
- Touch-friendly interfaces

### Performance
- Server-side rendering (SSR)
- Automatic code splitting
- Optimized bundle size
- Image optimization

### Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- High contrast mode compatible

## State Management

- **React Query**: Server state caching and synchronization
- **React Context**: Theme and global UI state
- **Local State**: Component-specific state with hooks

## Styling

- **Material-UI Theme**: Consistent design system
- **Emotion**: CSS-in-JS for component styles
- **Responsive**: Flexbox and Grid layouts
- **Animations**: Smooth transitions

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Verify backend is running on port 3001
   - Check NEXT_PUBLIC_API_URL in `.env.local`
   - Ensure no CORS issues

2. **Build Errors**
   - Run `npm install` to ensure dependencies
   - Check TypeScript errors: `npm run type-check`
   - Clear `.next` folder and rebuild

3. **Slow Performance**
   - Enable production mode: `NODE_ENV=production`
   - Check browser console for errors
   - Monitor API response times

### Development Tips

- Use React Developer Tools for component debugging
- Monitor Network tab for API calls
- Check console for error messages
- Use `npm run dev` for hot module replacement

## Related Documentation

- [Backend API Documentation](/services/backend/README.md)
- [API Endpoints Reference](/documentation/API.md)
- [Deployment Guide](/documentation/DEPLOY.md)