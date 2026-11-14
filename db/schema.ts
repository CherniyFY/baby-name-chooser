import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ratings = sqliteTable("ratings", {
  nameId: text("name_id").notNull(),
  person: text("person").notNull(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, table => [primaryKey({ columns: [table.nameId, table.person] })]);

export const notes = sqliteTable("notes", {
  nameId: text("name_id").primaryKey(),
  text: text("text").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const leagues = sqliteTable("leagues", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  nameIds: text("name_ids").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

export const votes = sqliteTable("votes", {
  leagueId: text("league_id").notNull().references(() => leagues.id),
  person: text("person").notNull(),
  a: text("a").notNull(),
  b: text("b").notNull(),
  choice: text("choice").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, table => [primaryKey({ columns: [table.leagueId, table.person, table.a, table.b] })]);

export const tournaments = sqliteTable("tournaments", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  poolJson: text("pool_json").notNull(),
  resultsJson: text("results_json").notNull(),
  votesJson: text("votes_json").notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const familySettings = sqliteTable("family_settings", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const filterViews = sqliteTable("filter_views", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  scope: text("scope").notNull(),
  filtersJson: text("filters_json").notNull(),
  sort: text("sort").notNull(),
  creationJson: text("creation_json").notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});
