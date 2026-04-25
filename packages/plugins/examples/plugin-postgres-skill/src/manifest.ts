import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "paperclip.postgres-skill";
const PLUGIN_VERSION = "0.1.0";

/**
 * Postgres skill plugin that enables agents to query and interact with databases
 */
const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Postgres Skill",
  description: "Enables agents to query and interact with Postgres databases. Provides tools for executing queries, inspecting schemas, and managing database connections.",
  author: "Paperclip",
  categories: ["connector", "database"],
  capabilities: [
    "agent.tools.register",
    "http.outbound",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      connectionString: {
        type: "string",
        title: "Postgres Connection String",
        description: "PostgreSQL connection string (e.g., postgresql://user:password@host:5432/dbname)",
      },
      defaultTimeout: {
        type: "number",
        title: "Query Timeout (seconds)",
        description: "Default timeout for database queries",
        default: 30,
      },
      maxConnections: {
        type: "number",
        title: "Max Connections",
        description: "Maximum number of concurrent database connections",
        default: 10,
      },
    },
    required: ["connectionString"],
  },
  tools: [
    {
      name: "postgres_query",
      displayName: "Execute Postgres Query",
      description: "Execute a SELECT query against the Postgres database and return results",
      parametersSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The SQL SELECT query to execute",
          },
          timeout: {
            type: "number",
            description: "Query timeout in seconds (optional, uses default if not specified)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "postgres_execute",
      displayName: "Execute Postgres Statement",
      description: "Execute a data modification statement (INSERT, UPDATE, DELETE) against the database",
      parametersSchema: {
        type: "object",
        properties: {
          statement: {
            type: "string",
            description: "The SQL statement to execute (INSERT, UPDATE, DELETE, or other non-SELECT)",
          },
          timeout: {
            type: "number",
            description: "Statement timeout in seconds (optional)",
          },
        },
        required: ["statement"],
      },
    },
    {
      name: "postgres_list_tables",
      displayName: "List Postgres Tables",
      description: "List all tables in the connected database",
      parametersSchema: {
        type: "object",
        properties: {
          schema: {
            type: "string",
            description: "Database schema to list tables from (optional, defaults to 'public')",
          },
        },
      },
    },
    {
      name: "postgres_get_schema",
      displayName: "Get Table Schema",
      description: "Get the schema/structure of a specific table including column names, types, and constraints",
      parametersSchema: {
        type: "object",
        properties: {
          tableName: {
            type: "string",
            description: "Name of the table to inspect",
          },
          schema: {
            type: "string",
            description: "Database schema (optional, defaults to 'public')",
          },
        },
        required: ["tableName"],
      },
    },
    {
      name: "postgres_transaction",
      displayName: "Execute Postgres Transaction",
      description: "Execute multiple SQL statements as a transaction (all or nothing)",
      parametersSchema: {
        type: "object",
        properties: {
          statements: {
            type: "array",
            items: { type: "string" },
            description: "Array of SQL statements to execute in a transaction",
          },
          timeout: {
            type: "number",
            description: "Transaction timeout in seconds (optional)",
          },
        },
        required: ["statements"],
      },
    },
  ],
  ui: {
    slots: [],
  },
};

export default manifest;
