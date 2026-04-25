# Postgres Skill Plugin

A Paperclip plugin that enables agents to query and interact with Postgres databases.

## Features

Provides the following tools for agent use:

- **postgres_query**: Execute SELECT queries and retrieve results
- **postgres_execute**: Execute data modification statements (INSERT, UPDATE, DELETE)
- **postgres_list_tables**: List all tables in a schema
- **postgres_get_schema**: Get table structure and column information
- **postgres_transaction**: Execute multiple statements as an atomic transaction

## Configuration

The plugin requires the following configuration:

- **connectionString** (required): PostgreSQL connection string (e.g., `postgresql://user:password@host:5432/dbname`)
- **defaultTimeout** (optional): Default timeout for queries in seconds (default: 30)
- **maxConnections** (optional): Maximum concurrent connections (default: 10)

## Usage

Agents can invoke the tools directly to:

- Query data from any table
- Insert, update, or delete records
- Inspect database schemas
- Perform multi-statement transactions with rollback on error

## Example Tool Calls

### Query Example
```
Tool: postgres_query
Query: SELECT * FROM users WHERE status = 'active' LIMIT 10
```

### Insert Example
```
Tool: postgres_execute
Statement: INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')
```

### Schema Inspection
```
Tool: postgres_get_schema
Table: users
```

## Development

Build the plugin:
```bash
pnpm build
```

Type checking:
```bash
pnpm typecheck
```

## Dependencies

- `pg`: PostgreSQL client library for Node.js
- `@paperclipai/plugin-sdk`: Paperclip plugin SDK
