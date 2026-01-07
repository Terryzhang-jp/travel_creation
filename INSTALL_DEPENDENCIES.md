# Location Library Feature Dependencies

## Required npm packages

Before proceeding, install the following dependencies in the `apps/web` directory:

```bash
cd apps/web

# Install map-related dependencies
pnpm add react-leaflet leaflet

# Install type definitions
pnpm add -D @types/leaflet

# Install drag-and-drop dependencies (required for Phase 10)
pnpm add react-dnd react-dnd-html5-backend
pnpm add -D @types/react-dnd
```

## One-liner installation command

```bash
cd apps/web && pnpm add react-leaflet leaflet react-dnd react-dnd-html5-backend && pnpm add -D @types/leaflet @types/react-dnd
```

## Verify installation

After installation, run:

```bash
pnpm typecheck
```

Ensure there are no type errors.

## Package descriptions

- **react-leaflet**: React wrapper for the Leaflet map library
- **leaflet**: Open-source map library, works with OpenStreetMap
- **react-dnd**: Drag-and-drop library for batch location assignment
- **react-dnd-html5-backend**: HTML5 drag-and-drop backend

These dependencies are required because:
1. Leaflet is used for map display and interaction
2. react-dnd is used to implement batch photo drag-and-drop to locations
