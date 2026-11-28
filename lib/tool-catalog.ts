export const INITIAL_TOOL_CATALOG = [
  { name: "Gmail", slug: "gmail", description: "Read and organize email", category: "Communication", isActive: true },
  { name: "Slack", slug: "slack", description: "Work with messages and channels", category: "Communication", isActive: true },
  { name: "Google Calendar", slug: "googlecalendar", description: "Find events and manage your calendar", category: "Planning", isActive: true },
  { name: "Notion", slug: "notion", description: "Search and work with your pages", category: "Knowledge", isActive: true },
  { name: "GitHub", slug: "github", description: "Follow code and project activity", category: "Development", isActive: true },
  { name: "Google Docs", slug: "googledocs", description: "Read and create documents", category: "Knowledge", isActive: true },
  { name: "Reddit", slug: "reddit", description: "Find posts and discussions", category: "Research", isActive: true },
] as const;

export type ToolCatalogItem = { name: string; slug: string; description: string; category: string; isActive: boolean };
export type AgentToolStatus = ToolCatalogItem & { enabled: boolean; connected: boolean; connectionStatus: string };
