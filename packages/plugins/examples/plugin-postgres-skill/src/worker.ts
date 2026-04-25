import { definePlugin, runWorker, type PluginContext } from "@paperclipai/plugin-sdk";
import { Pool, type PoolClient, type QueryResult } from "pg";

const PLUGIN_NAME = "postgres-skill";

interface PluginState {
  pool: Pool | null;
  config: {
    connectionString: string;
    defaultTimeout: number;
    maxConnections: number;
  } | null;
}

let state: PluginState = {
  pool: null,
  config: null,
};

/**
 * Initialize the connection pool with the provided configuration
 */
async function initializePool(
  ctx: PluginContext,
  connectionString: string,
  maxConnections: number
): Promise<void> {
  if (state.pool) {
    await state.pool.end();
  }

  state.pool = new Pool({
    connectionString,
    max: maxConnections,
  });

  state.pool.on("error", (err: Error) => {
    ctx.logger.error(`Unexpected pool error: ${err.message}`);
  });

  ctx.logger.info(`Postgres pool initialized with max ${maxConnections} connections`);
}

/**
 * Execute a SELECT query and return results
 */
async function handlePostgresQuery(
  ctx: PluginContext,
  query: string,
  timeout?: number
): Promise<unknown> {
  if (!state.pool) {
    throw new Error("Database not configured. Please set connection string in plugin config.");
  }

  const client = await state.pool.connect();
  try {
    const effectiveTimeout = timeout || state.config?.defaultTimeout || 30;
    const result = await client.query({
      text: query,
      timeout: effectiveTimeout * 1000,
    });
    return {
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      fields: result.fields.map((f: any) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    };
  } catch (error) {
    const err = error as Error;
    ctx.logger.error(`Query execution failed: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    client.release();
  }
}

/**
 * Execute a data modification statement (INSERT, UPDATE, DELETE)
 */
async function handlePostgresExecute(
  ctx: PluginContext,
  statement: string,
  timeout?: number
): Promise<unknown> {
  if (!state.pool) {
    throw new Error("Database not configured. Please set connection string in plugin config.");
  }

  const client = await state.pool.connect();
  try {
    const effectiveTimeout = timeout || state.config?.defaultTimeout || 30;
    const result = await client.query({
      text: statement,
      timeout: effectiveTimeout * 1000,
    });
    return {
      success: true,
      rowCount: result.rowCount,
      command: result.command,
    };
  } catch (error) {
    const err = error as Error;
    ctx.logger.error(`Statement execution failed: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    client.release();
  }
}

/**
 * List all tables in a schema
 */
async function handleListTables(
  ctx: PluginContext,
  schema: string = "public"
): Promise<unknown> {
  if (!state.pool) {
    throw new Error("Database not configured. Please set connection string in plugin config.");
  }

  const query = `
    SELECT tablename FROM pg_tables
    WHERE schemaname = $1
    ORDER BY tablename
  `;

  const client = await state.pool.connect();
  try {
    const result = await client.query(query, [schema]);
    return {
      success: true,
      schema,
      tables: result.rows.map((r: any) => r.tablename),
    };
  } catch (error) {
    const err = error as Error;
    ctx.logger.error(`Failed to list tables: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    client.release();
  }
}

/**
 * Get schema information for a specific table
 */
async function handleGetSchema(
  ctx: PluginContext,
  tableName: string,
  schema: string = "public"
): Promise<unknown> {
  if (!state.pool) {
    throw new Error("Database not configured. Please set connection string in plugin config.");
  }

  const query = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = $2
    ORDER BY ordinal_position
  `;

  const client = await state.pool.connect();
  try {
    const result = await client.query(query, [tableName, schema]);
    if (result.rows.length === 0) {
      return {
        success: false,
        error: `Table ${schema}.${tableName} not found`,
      };
    }
    return {
      success: true,
      table: `${schema}.${tableName}`,
      columns: result.rows,
    };
  } catch (error) {
    const err = error as Error;
    ctx.logger.error(`Failed to get schema: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    client.release();
  }
}

/**
 * Execute multiple statements as a transaction
 */
async function handleTransaction(
  ctx: PluginContext,
  statements: string[],
  timeout?: number
): Promise<unknown> {
  if (!state.pool) {
    throw new Error("Database not configured. Please set connection string in plugin config.");
  }

  const client = await state.pool.connect();
  try {
    const effectiveTimeout = timeout || state.config?.defaultTimeout || 30;
    await client.query("BEGIN");
    const results: QueryResult[] = [];

    for (const statement of statements) {
      const result = await client.query({
        text: statement,
        timeout: effectiveTimeout * 1000,
      });
      results.push(result);
    }

    await client.query("COMMIT");

    return {
      success: true,
      statementCount: statements.length,
      results: results.map((r) => ({
        command: r.command,
        rowCount: r.rowCount,
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
      /* ignore rollback errors */
    });
    const err = error as Error;
    ctx.logger.error(`Transaction failed: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    client.release();
  }
}

/**
 * Postgres skill plugin worker
 */
const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup starting`);

    // Load configuration
    const config = ctx.getConfig();
    if (!config || !config.connectionString) {
      ctx.logger.warn("Postgres skill configured but no connection string provided");
      return;
    }

    state.config = {
      connectionString: config.connectionString as string,
      defaultTimeout: (config.defaultTimeout as number) || 30,
      maxConnections: (config.maxConnections as number) || 10,
    };

    // Initialize pool
    try {
      await initializePool(
        ctx,
        state.config.connectionString,
        state.config.maxConnections
      );
      ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);
    } catch (error) {
      const err = error as Error;
      ctx.logger.error(`Failed to initialize postgres pool: ${err.message}`);
    }
  },

  async onHealth() {
    if (!state.pool) {
      return {
        status: "degraded",
        message: "Database not configured",
      };
    }

    try {
      const client = await state.pool.connect();
      await client.query("SELECT 1");
      client.release();
      return {
        status: "ok",
        message: "Postgres connection healthy",
      };
    } catch (error) {
      const err = error as Error;
      return {
        status: "error",
        message: `Database connection failed: ${err.message}`,
      };
    }
  },

  async onToolCall(ctx: PluginContext, toolName: string, params: unknown) {
    ctx.logger.debug(`Tool called: ${toolName}`);

    const paramsObj = params as Record<string, unknown>;

    switch (toolName) {
      case "postgres_query":
        return await handlePostgresQuery(
          ctx,
          paramsObj.query as string,
          paramsObj.timeout as number | undefined
        );

      case "postgres_execute":
        return await handlePostgresExecute(
          ctx,
          paramsObj.statement as string,
          paramsObj.timeout as number | undefined
        );

      case "postgres_list_tables":
        return await handleListTables(
          ctx,
          (paramsObj.schema as string) || "public"
        );

      case "postgres_get_schema":
        return await handleGetSchema(
          ctx,
          paramsObj.tableName as string,
          (paramsObj.schema as string) || "public"
        );

      case "postgres_transaction":
        return await handleTransaction(
          ctx,
          paramsObj.statements as string[],
          paramsObj.timeout as number | undefined
        );

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
