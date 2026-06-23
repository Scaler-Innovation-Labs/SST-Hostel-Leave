import { Pool } from "@neondatabase/serverless";

const databaseUrl = "postgresql://neondb_owner:npg_AjON8Galm2xf@ep-polished-tree-aqev6vj7-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const pool = new Pool({ connectionString: databaseUrl });
try {
  // Check if audit_logs exists
  const r = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs')");
  console.log("audit_logs exists:", r.rows[0].exists);

  if (r.rows[0].exists) {
    const cols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position");
    for (const c of cols.rows) {
      console.log(`  ${c.column_name} ${c.data_type} nullable=${c.is_nullable}`);
    }
  }
} catch (e) {
  console.error("Error:", e.message);
}
process.exit(0);
