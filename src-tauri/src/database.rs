use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::{path::Path, sync::Mutex};

pub struct Database(pub Mutex<Connection>);
impl Database {
    pub fn open(path: &Path) -> Result<Self, String> {
        let db = Connection::open(path).map_err(|e| e.to_string())?;
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind,id));
            CREATE TABLE IF NOT EXISTS positions (cache_key TEXT PRIMARY KEY, value TEXT NOT NULL);
            PRAGMA user_version=1;").map_err(|e| e.to_string())?;
        Ok(Self(Mutex::new(db)))
    }
    pub fn get(&self, kind: &str, id: &str) -> Result<Option<Value>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let raw: Option<String> = db
            .query_row(
                "SELECT value FROM documents WHERE kind=?1 AND id=?2",
                params![kind, id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        raw.map(|v| serde_json::from_str(&v).map_err(|e| e.to_string()))
            .transpose()
    }
    pub fn list(&self, kind: &str) -> Result<Vec<Value>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare("SELECT value FROM documents WHERE kind=?1 ORDER BY id")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([kind], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.map(|r| {
            serde_json::from_str(&r.map_err(|e| e.to_string())?).map_err(|e| e.to_string())
        })
        .collect()
    }
    pub fn put(&self, kind: &str, id: &str, value: &Value) -> Result<(), String> {
        self.0.lock().map_err(|e|e.to_string())?.execute("INSERT INTO documents VALUES (?1,?2,?3) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value", params![kind,id,value.to_string()]).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn cached(&self, key: &str) -> Option<Value> {
        let raw: Option<String> = self
            .0
            .lock()
            .ok()?
            .query_row(
                "SELECT value FROM positions WHERE cache_key=?1",
                [key],
                |r| r.get(0),
            )
            .optional()
            .ok()?;
        raw.and_then(|s| serde_json::from_str(&s).ok())
    }
    pub fn cache(&self, key: &str, value: &Value) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|e| e.to_string())?
            .execute(
                "INSERT OR REPLACE INTO positions VALUES (?1,?2)",
                params![key, value.to_string()],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
