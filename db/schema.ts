import { boolean, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  credits: integer("credits").default(5).notNull(),
});

export const agentConfig = pgTable("agentConfig", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId", { length: 36 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description"),
  agentImage: text("agentImage").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  userEmail: text("userEmail").notNull().references(() => users.email),
  tools: jsonb("tools").$type<string[]>().default([]).notNull(),
  composioSessionId: text("composioSessionId"),
});

export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  description: text("description").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AgentConfig = typeof agentConfig.$inferSelect;
