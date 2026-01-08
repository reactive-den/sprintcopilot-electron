# SprintCopilot App

A professional, modular Electron.js desktop application built for scalability and maintainability. Built with TypeScript and ES modules.

## 📁 Project Structure

```
sprintcopilot-app/
├── src/                         # Source TypeScript files
│   ├── main/                    # Main process (Node.js - ES Modules)
│   │   ├── main.ts             # Application entry point
│   │   ├── handlers/           # IPC handlers
│   │   │   └── IPCHandlers.ts
│   │   ├── windows/            # Window management
│   │   │   └── WindowManager.ts
│   │   ├── services/           # Background services
│   │   │   ├── AppLifecycle.ts
│   │   │   ├── ClickUpAPI.ts
│   │   │   └── TrackerService.ts
│   │   └── utils/              # Main process utilities
│   │       ├── logger.ts
│   │       └── paths.ts
│   ├── preload/                # Preload scripts (CommonJS)
│   │   └── preload.ts
│   ├── renderer/               # Renderer process (Browser - ES Modules)
│   │   ├── index.html          # Main HTML
│   │   ├── scripts/            # Renderer TypeScript
│   │   │   ├── main.ts        # Renderer entry point
│   │   │   ├── app/           # Application logic
│   │   │   │   └── App.ts
│   │   │   ├── components/    # UI components
│   │   │   │   ├── DirectorySelector.ts
│   │   │   │   ├── InfoCard.ts
│   │   │   │   ├── TaskCard.ts
│   │   │   │   ├── TaskList.ts
│   │   │   │   └── WorkspaceSelector.ts
│   │   │   ├── services/      # Renderer services
│   │   │   │   └── VersionInfo.ts
│   │   │   └── utils/         # Renderer utilities
│   │   │       └── logger.ts
│   │   └── assets/            # Static assets
│   │       └── styles/
│   │           └── main.css
│   ├── shared/                 # Shared code between processes
│   │   ├── constants/
│   │   │   ├── index.ts
│   │   │   └── windowConfig.ts
│   │   └── utils/
│   │       └── env.ts
│   └── types/                  # TypeScript type definitions
│       └── index.ts
├── dist/                       # Compiled output (generated)
│   ├── main/                   # Compiled main process (ES Modules)
│   ├── preload/                # Compiled preload (CommonJS as .cjs)
│   └── renderer/               # Compiled renderer (ES Modules)
├── config/                     # Configuration files
│   └── electron-builder.yml
├── tsconfig.base.json          # Base TypeScript config
├── tsconfig.main.json          # Main process TypeScript config
├── tsconfig.preload.json       # Preload TypeScript config
├── tsconfig.renderer.json      # Renderer TypeScript config
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v16 or higher
- **npm**: v7 or higher (or yarn)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
   
   Create a `.env` file in the root directory with your ClickUp API credentials:
   ```env
   CLICKUP_API_TOKEN=your_clickup_api_token_here
   CLICKUP_LIST_ID=your_list_id_here
   CLICKUP_USER_ID=your_user_id_here
   ```
   
   You can find these values:
   - **API Token**: Generate from ClickUp Settings → Apps → API
   - **List ID**: Found in the ClickUp list URL (e.g., `https://app.clickup.com/.../v/li/901814814992/...`)
   - **User ID**: Found in your ClickUp profile or API response

3. **Build and run the application:**
```bash
npm start
```

## 🛠️ Development

### Development Mode

Run in development mode with automatic rebuilds and DevTools:
```bash
npm run dev
```

This will:
- Watch for TypeScript file changes and rebuild automatically
- Start Electron with DevTools open
- Set `NODE_ENV=development`

### Build Commands

**Build for development/testing:**
```bash
npm run build
```

This builds all TypeScript files and copies renderer assets:
- Main process → `dist/main/` (ES Modules)
- Preload script → `dist/preload/preload.cjs` (CommonJS)
- Renderer → `dist/renderer/` (ES Modules)

**Individual build commands:**
```bash
npm run build:main      # Build main process only
npm run build:preload   # Build preload script only
npm run build:renderer  # Build renderer only
```

**Production builds:**
```bash
npm run build:app       # Build for current platform
npm run build:mac       # Build for macOS (DMG)
npm run build:win       # Build for Windows (NSIS installer)
npm run build:linux     # Build for Linux (AppImage)
```

### Other Commands

```bash
npm run lint            # Run ESLint on TypeScript files
npm run clean           # Remove dist/ and out/ directories
```

## 🏗️ Architecture

### Module System

This project uses **ES Modules** throughout, with one exception:

- **Main Process**: ES Modules (`.js` files with `import`/`export`)
- **Renderer Process**: ES Modules (`.js` files with `import`/`export`)
- **Preload Script**: CommonJS (`.cjs` file) - Required by Electron's preload loader

The preload script is compiled to CommonJS (`.cjs`) because Electron's internal preload mechanism uses `require()`, which doesn't work with ES modules.

### Main Process (`src/main/`)

The main process runs in Node.js and manages:
- Application lifecycle
- Window creation and management
- System integration
- IPC communication
- Background services (ClickUp API, Tracker Service)

**Key Modules:**
- `main.ts` - Entry point, coordinates app initialization
- `windows/WindowManager.ts` - Manages all windows (singleton pattern)
- `services/AppLifecycle.ts` - Handles app lifecycle events
- `services/ClickUpAPI.ts` - ClickUp API integration
- `services/TrackerService.ts` - Time tracking service
- `handlers/IPCHandlers.ts` - IPC request handlers
- `utils/logger.ts` - Centralized logging
- `utils/paths.ts` - Path resolution utilities

### Preload Scripts (`src/preload/`)

Preload scripts run in a bridge between main and renderer processes:
- Compiled to CommonJS (`.cjs`) for Electron compatibility
- Expose safe APIs to renderer via Context Bridge
- Validate IPC channels
- Prevent direct Node.js access from renderer

### Renderer Process (`src/renderer/`)

The renderer process runs in Chromium and handles:
- UI rendering
- User interactions
- Client-side logic
- Component lifecycle

**Key Modules:**
- `scripts/main.ts` - Renderer entry point
- `scripts/app/App.ts` - Main application class, manages views
- `scripts/components/` - UI components:
  - `DirectorySelector.ts` - Git directory selection
  - `WorkspaceSelector.ts` - ClickUp workspace/space/folder/list selection
  - `TaskList.ts` - Task list display
  - `TaskCard.ts` - Individual task card component
  - `InfoCard.ts` - Version info display
- `scripts/services/VersionInfo.ts` - Version information service
- `scripts/utils/logger.ts` - Renderer-side logging

### Shared Code (`src/shared/`)

Code shared between processes:
- `constants/windowConfig.ts` - Window configuration
- `utils/env.ts` - Environment detection utilities

### Type Definitions (`src/types/`)

Shared TypeScript type definitions used across main, preload, and renderer processes.

## 🔒 Security Features

- **Context Isolation**: Enabled for secure IPC
- **Node Integration**: Disabled in renderer
- **Sandbox**: Enabled where possible
- **IPC Channel Validation**: Whitelist-based IPC channels in preload
- **Navigation Protection**: Prevents external navigation
- **Window Creation Protection**: Blocks unauthorized window creation

## 📦 Build System

### TypeScript Configuration

The project uses multiple TypeScript configurations:

- **`tsconfig.base.json`**: Base configuration shared by all
- **`tsconfig.main.json`**: Main process config (ES Modules)
- **`tsconfig.preload.json`**: Preload config (CommonJS)
- **`tsconfig.renderer.json`**: Renderer config (ES Modules)

### Build Process

1. **TypeScript Compilation**: Each process compiles separately
2. **Preload Renaming**: Preload `.js` → `.cjs` for CommonJS compatibility
3. **Asset Copying**: HTML and CSS files copied to `dist/renderer/`

## 🛠️ Development Guidelines

### Adding a New Window

1. Add window configuration to `src/shared/constants/windowConfig.ts`
2. Create window method in `src/main/windows/WindowManager.ts`
3. Update preload script if new IPC channels needed

### Adding a New Component

1. Create component class in `src/renderer/scripts/components/`
2. Import and initialize in `src/renderer/scripts/app/App.ts`
3. Add corresponding HTML/CSS as needed

### Adding IPC Communication

1. Define channel name in preload script (`src/preload/preload.ts`) whitelist
2. Add handler in `src/main/handlers/IPCHandlers.ts` (or create new service)
3. Expose API in preload script
4. Use in renderer via `window.electronAPI.ipc.invoke()`

### TypeScript Best Practices

- Use `.js` extensions in import paths (required for ES modules)
- Use type-only imports: `import type { ... } from '...'`
- Default exports are supported for services/classes
- Keep main, preload, and renderer types separate when possible

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Build and run the application |
| `npm run dev` | Development mode with watch and DevTools |
| `npm run build` | Build all TypeScript files and assets |
| `npm run build:main` | Build main process only |
| `npm run build:preload` | Build preload script only |
| `npm run build:renderer` | Build renderer only |
| `npm run build:app` | Build distributable for current platform |
| `npm run build:mac` | Build macOS DMG |
| `npm run build:win` | Build Windows NSIS installer |
| `npm run build:linux` | Build Linux AppImage |
| `npm run lint` | Run ESLint on TypeScript files |
| `npm run clean` | Remove build artifacts |

## 🔌 ClickUp Integration

The app integrates with ClickUp API to fetch and display tasks. Features:

- **Directory Selection**: Select Git repository directory
- **Workspace Navigation**: Browse ClickUp workspaces, spaces, folders, and lists
- **Task Display**: Display tasks in a card-based layout
- **Expandable Details**: Click cards to see full task information
- **Task Information**: Shows status, priority, assignees, due dates, tags, and custom fields
- **Real-time Refresh**: Refresh button to fetch latest tasks
- **Error Handling**: Clear error messages if API configuration is missing

### Task Card Features

Each task card displays:
- Task name and description
- Status badge with color
- Priority indicator
- Due date (highlighted if overdue)
- Assignee avatars
- Expandable section with:
  - Full description
  - Task metadata (ID, dates, points, URL)
  - Assignee details
  - Tags
  - Custom fields

## 📄 License

MIT

## 🤝 Contributing

This is a modular structure ready for team collaboration. Follow the architecture patterns when adding new features:
- Keep main, preload, and renderer code separate
- Use TypeScript types for IPC communication
- Follow the existing component and service patterns
- Update this README when adding new features or changing structure
