use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use std::{collections::HashSet, path::Path, sync::Mutex};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    analysis_bytes: u64,
    analyses: usize,
    cache_bytes: u64,
    cached_positions: u64,
    eligible_bytes: u64,
    eligible_analyses: usize,
}

fn analysis_entries(db: &Connection) -> Result<Vec<(String, u64, Option<i64>)>, String> {
    let mut stmt = db
        .prepare(
            "SELECT r.id,length(CAST(r.value AS BLOB)),json_extract(g.value,'$.date')
        FROM documents r LEFT JOIN documents g ON g.kind='games' AND g.id=r.id
        WHERE r.kind IN ('reviews','review-drafts','review-summaries')",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((r.get(0)?, r.get::<_, i64>(1)? as u64, r.get(2)?))
        })
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

fn eligible(date: Option<i64>, cutoff: i64, id: &str, protected: &[String]) -> bool {
    date.is_some_and(|date| date > 0 && date < cutoff) && !protected.iter().any(|p| p == id)
}

pub struct Database(pub Mutex<Connection>);
fn review_summary(review: &Value) -> Value {
    let moves: Vec<Value> = review["moves"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|m| {
            serde_json::json!({"ply":m["ply"],"color":m["color"],"category":m["category"],
            "loss":m["loss"],"best":"","explanation":""})
        })
        .collect();
    serde_json::json!({"version":review["version"],"classificationVersion":review["classificationVersion"],
        "engineId":review["engineId"],"options":review["options"],"complete":review["complete"],
        "moves":moves,"positions":{}})
}
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
    pub fn reviewed_ids(&self, version: i64) -> Result<Vec<String>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        // Return only IDs instead of transferring every saved position to the UI.
        let mut stmt = db
            .prepare(
                "SELECT id FROM documents WHERE kind='reviews'
             AND json_extract(value, '$.complete')=1
             AND json_extract(value, '$.version')=?1 ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([version], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.map(|r| r.map_err(|e| e.to_string())).collect()
    }
    pub fn statistics_reviews(&self, ids: &[String]) -> Result<Value, String> {
        if ids.is_empty() {
            return Ok(serde_json::json!({}));
        }
        let mut db = self.0.lock().map_err(|e| e.to_string())?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        let requested = serde_json::to_string(ids).map_err(|e| e.to_string())?;
        // Lazy backfill for older installations: never transfer engine positions to the UI.
        tx.execute("INSERT OR IGNORE INTO documents(kind,id,value)
            SELECT 'review-summaries',r.id,json_set(r.value,'$.positions',json('{}'))
            FROM documents r JOIN json_each(?1) requested ON requested.value=r.id
            WHERE r.kind='reviews' AND NOT EXISTS (
                SELECT 1 FROM documents cached WHERE cached.kind='review-summaries' AND cached.id=r.id
            )", [&requested]).map_err(|e| e.to_string())?;
        let rows: Vec<(String, String)> = {
            let mut stmt = tx
                .prepare(
                    "SELECT s.id,s.value FROM documents s
                JOIN json_each(?1) requested ON requested.value=s.id
                WHERE s.kind='review-summaries'",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([&requested], |r| Ok((r.get(0)?, r.get(1)?)))
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };
        let mut result = serde_json::Map::new();
        for (id, raw) in rows {
            let value: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
            let compact = review_summary(&value);
            if compact != value {
                tx.execute(
                    "UPDATE documents SET value=?1 WHERE kind='review-summaries' AND id=?2",
                    params![compact.to_string(), id],
                )
                .map_err(|e| e.to_string())?;
            }
            result.insert(id, compact);
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(Value::Object(result))
    }
    pub fn cache_statistics_review(
        &self,
        id: &str,
        expected: &Value,
        value: &Value,
    ) -> Result<bool, String> {
        let mut db = self.0.lock().map_err(|e| e.to_string())?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        let raw: Option<String> = tx
            .query_row(
                "SELECT value FROM documents WHERE kind='review-summaries' AND id=?1",
                [id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let matches = raw
            .map(|raw| {
                serde_json::from_str::<Value>(&raw)
                    .map(|v| review_summary(&v) == review_summary(expected))
            })
            .transpose()
            .map_err(|e| e.to_string())?
            .unwrap_or(false);
        if matches {
            tx.execute(
                "UPDATE documents SET value=?1 WHERE kind='review-summaries' AND id=?2",
                params![review_summary(value).to_string(), id],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(matches)
    }
    pub fn put(&self, kind: &str, id: &str, value: &Value) -> Result<(), String> {
        let mut db = self.0.lock().map_err(|e| e.to_string())?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO documents VALUES (?1,?2,?3) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value", params![kind,id,value.to_string()]).map_err(|e|e.to_string())?;
        if kind == "reviews" {
            tx.execute(
                "INSERT INTO documents VALUES ('review-summaries',?1,?2)
                ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
                params![id, review_summary(value).to_string()],
            )
            .map_err(|e| e.to_string())?;
        }
        if kind == "reviews" && value["complete"] == true {
            tx.execute(
                "DELETE FROM documents WHERE kind='review-cleaned' AND id=?1",
                [id],
            )
            .map_err(|e| e.to_string())?;
            tx.execute(
                "DELETE FROM documents WHERE kind='review-drafts' AND id=?1",
                [id],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn storage_info(&self, cutoff: i64, protected: &[String]) -> Result<StorageInfo, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let entries = analysis_entries(&db)?;
        let old: Vec<_> = entries
            .iter()
            .filter(|(id, _, date)| eligible(*date, cutoff, id, protected))
            .collect();
        let (cache_bytes, cached_positions) = db
            .query_row(
                "SELECT COALESCE(SUM(length(CAST(value AS BLOB))),0),COUNT(*) FROM positions",
                [],
                |r| Ok((r.get::<_, i64>(0)? as u64, r.get::<_, i64>(1)? as u64)),
            )
            .map_err(|e| e.to_string())?;
        Ok(StorageInfo {
            analysis_bytes: entries.iter().map(|(_, bytes, _)| bytes).sum(),
            analyses: entries
                .iter()
                .map(|(id, _, _)| id)
                .collect::<HashSet<_>>()
                .len(),
            cache_bytes,
            cached_positions,
            eligible_bytes: old.iter().map(|(_, bytes, _)| bytes).sum(),
            eligible_analyses: old
                .iter()
                .map(|(id, _, _)| id)
                .collect::<HashSet<_>>()
                .len(),
        })
    }
    pub fn clear_old_reviews(
        &self,
        cutoff: i64,
        protected: &[String],
    ) -> Result<Vec<String>, String> {
        let mut db = self.0.lock().map_err(|e| e.to_string())?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        let mut ids: Vec<_> = analysis_entries(&tx)?
            .into_iter()
            .filter(|(id, _, date)| eligible(*date, cutoff, id, protected))
            .map(|(id, _, _)| id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        ids.sort();
        for id in &ids {
            tx.execute("DELETE FROM documents WHERE kind IN ('reviews','review-drafts','review-summaries','game-seen') AND id=?1",[id]).map_err(|e|e.to_string())?;
            tx.execute(
                "INSERT OR REPLACE INTO documents(kind,id,value) VALUES('review-cleaned',?1,?2)",
                params![id, serde_json::json!({"gameId":id}).to_string()],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(ids)
    }
    pub fn clear_position_cache(&self) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|e| e.to_string())?
            .execute("DELETE FROM positions", [])
            .map_err(|e| e.to_string())?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn storage_db() -> Database {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("CREATE TABLE documents (kind TEXT,id TEXT,value TEXT,PRIMARY KEY(kind,id)); CREATE TABLE positions (cache_key TEXT PRIMARY KEY,value TEXT);").unwrap();
        Database(Mutex::new(connection))
    }

    #[test]
    fn fresh_database_contains_no_profile_or_games() {
        let db = Database::open(Path::new(":memory:")).unwrap();
        for id in ["preferences", "lastGame", "freeBoard"] {
            assert!(db.get("settings", id).unwrap().is_none());
        }
        for kind in ["games", "reviews", "variants", "game-seen", "settings"] {
            assert!(db.list(kind).unwrap().is_empty());
        }
    }

    #[test]
    fn storage_cleanup_preserves_games_unknown_dates_and_protected_jobs() {
        let db = storage_db();
        for (id, date) in [("old", 100), ("new", 300), ("running", 100), ("no-date", 0)] {
            db.put("games", id, &json!({"date":date,"pgn":"1. e4 *"}))
                .unwrap();
            db.put("reviews", id, &json!({"complete":true,"text":"Análisis ♟"}))
                .unwrap();
            db.put("game-seen", id, &json!({"gameId":id,"seen":true}))
                .unwrap();
        }
        db.put("reviews", "orphan", &json!({"complete":true}))
            .unwrap();
        db.put("review-drafts", "old", &json!({"complete":false}))
            .unwrap();
        db.put("variants", "old", &json!({"nodes":[1,2,3]}))
            .unwrap();
        db.put("settings", "preferences", &json!({"username":"Me"}))
            .unwrap();
        db.cache("position", &json!({"pv":["e2e4"]})).unwrap();
        let protected = vec!["running".to_string()];
        let info = db.storage_info(200, &protected).unwrap();
        assert_eq!(info.analyses, 5);
        assert_eq!(info.eligible_analyses, 1);
        assert!(info.eligible_bytes > 0);
        assert_eq!(info.cached_positions, 1);
        let initial_bytes = info.analysis_bytes;
        assert_eq!(db.clear_old_reviews(200, &protected).unwrap(), vec!["old"]);
        assert!(db.get("reviews", "old").unwrap().is_none());
        assert!(db.get("review-drafts", "old").unwrap().is_none());
        assert!(db.get("review-summaries", "old").unwrap().is_none());
        assert!(db.get("game-seen", "old").unwrap().is_none());
        assert!(db.get("review-cleaned", "old").unwrap().is_some());
        for id in ["new", "running", "no-date", "orphan"] {
            assert!(db.get("reviews", id).unwrap().is_some());
        }
        assert!(db.get("games", "old").unwrap().is_some());
        assert!(db.get("variants", "old").unwrap().is_some());
        assert!(db.get("settings", "preferences").unwrap().is_some());
        assert!(db.cached("position").is_some());
        assert_eq!(
            db.storage_info(200, &protected).unwrap().analysis_bytes,
            initial_bytes - info.eligible_bytes
        );
        assert!(db.clear_old_reviews(200, &protected).unwrap().is_empty());
        db.clear_position_cache().unwrap();
        let after = db.storage_info(200, &protected).unwrap();
        assert_eq!(after.cache_bytes, 0);
        assert_eq!(after.cached_positions, 0);
        assert_eq!(after.analyses, 4);
    }

    #[test]
    fn completed_review_removes_stale_draft_and_allows_auto_review_again() {
        let db = storage_db();
        db.put("review-cleaned", "a", &json!({"gameId":"a"}))
            .unwrap();
        db.put("review-drafts", "a", &json!({"complete":false}))
            .unwrap();
        db.put("reviews", "a", &json!({"complete":false})).unwrap();
        assert!(db.get("review-cleaned", "a").unwrap().is_some());
        assert!(db.get("review-drafts", "a").unwrap().is_some());
        db.put("reviews", "a", &json!({"complete":true})).unwrap();
        assert!(db.get("review-cleaned", "a").unwrap().is_none());
        assert!(db.get("review-drafts", "a").unwrap().is_none());
    }

    #[test]
    fn review_index_only_returns_complete_current_reviews() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE documents (kind TEXT, id TEXT, value TEXT, PRIMARY KEY(kind,id));",
            )
            .unwrap();
        let db = Database(Mutex::new(connection));
        for (kind, id, value) in [
            (
                "reviews",
                "ready",
                json!({"version":1,"complete":true,"positions":{"m0":{"lines":[1,2,3]}}}),
            ),
            ("reviews", "pending", json!({"version":1,"complete":false})),
            ("reviews", "old", json!({"version":0,"complete":true})),
            ("reviews", "missing", json!({"version":1})),
            (
                "review-drafts",
                "draft",
                json!({"version":1,"complete":true}),
            ),
            ("games", "game", json!({"version":1,"complete":true})),
        ] {
            db.put(kind, id, &value).unwrap();
        }
        assert_eq!(db.reviewed_ids(1).unwrap(), vec!["ready"]);
        assert_eq!(db.reviewed_ids(0).unwrap(), vec!["old"]);
        db.put("reviews", "pending", &json!({"version":1,"complete":true}))
            .unwrap();
        assert_eq!(db.reviewed_ids(1).unwrap(), vec!["pending", "ready"]);
        // Reading the index never replaces or truncates the saved analysis.
        assert_eq!(
            db.get("reviews", "ready").unwrap().unwrap()["positions"]["m0"]["lines"],
            json!([1, 2, 3])
        );
    }

    fn saved_review(category: &str) -> Value {
        json!({"version":1,"classificationVersion":11,"complete":true,"engineId":"test",
            "options":{"threads":8,"hash":512,"multiPv":5,"movetime":5000,"depth":null},
            "moves":[{"ply":1,"color":"w","category":category,"loss":0.02,"best":"e4",
                "explanation":"Descripción larga"},
                {"ply":2,"color":"b","category":"book","loss":0,"best":"e5","explanation":"Libro"}],
            "positions":{"m0":{"lines":[{"pv":["e2e4","e7e5"],"depth":22}]}}})
    }

    #[test]
    fn statistics_summary_preserves_labels_without_transferring_positions_or_descriptions() {
        let db = storage_db();
        let original = saved_review("excellent");
        db.put("reviews", "a", &original).unwrap();
        let summaries = db
            .statistics_reviews(&["a".into(), "missing".into()])
            .unwrap();
        assert_eq!(summaries.as_object().unwrap().len(), 1);
        let summary = &summaries["a"];
        assert_eq!(summary["positions"], json!({}));
        assert_eq!(summary["moves"][0]["best"], "");
        assert_eq!(summary["moves"][0]["explanation"], "");
        assert_eq!(summary["moves"][0]["loss"], 0.02);
        assert_eq!(summary["moves"][1]["color"], "b");
        assert_eq!(summary["options"], original["options"]);
        assert_eq!(db.get("reviews", "a").unwrap(), Some(original));
        assert_eq!(db.statistics_reviews(&["a".into()]).unwrap(), summaries);
    }

    #[test]
    fn legacy_summary_backfill_is_scoped_and_preserves_derived_classification() {
        let db = storage_db();
        let original = saved_review("best");
        for id in ["a", "foreign"] {
            db.0.lock()
                .unwrap()
                .execute(
                    "INSERT INTO documents VALUES('reviews',?1,?2)",
                    params![id, original.to_string()],
                )
                .unwrap();
        }
        let summary = db.statistics_reviews(&["a".into()]).unwrap();
        assert_eq!(summary["a"], review_summary(&original));
        assert!(db.get("review-summaries", "foreign").unwrap().is_none());
        let upgraded = saved_review("brilliant");
        assert!(db
            .cache_statistics_review("a", &original, &upgraded)
            .unwrap());
        assert_eq!(
            db.statistics_reviews(&["a".into()]).unwrap()["a"]["moves"][0]["category"],
            "brilliant"
        );
        assert_eq!(db.get("reviews", "a").unwrap(), Some(original));
        assert_eq!(db.statistics_reviews(&[]).unwrap(), json!({}));
    }

    #[test]
    fn summary_updates_are_atomic_with_reviews_and_do_not_replace_a_newer_analysis() {
        let db = storage_db();
        let original = saved_review("best");
        db.put("reviews", "a", &original).unwrap();
        db.put("review-drafts", "a", &json!({"complete":false,"moves":[]}))
            .unwrap();
        assert_eq!(
            db.statistics_reviews(&["a".into()]).unwrap()["a"],
            review_summary(&original)
        );
        let latest = saved_review("great");
        db.put("reviews", "a", &latest).unwrap();
        assert!(!db
            .cache_statistics_review("a", &original, &saved_review("brilliant"))
            .unwrap());
        assert_eq!(
            db.statistics_reviews(&["a".into()]).unwrap()["a"],
            review_summary(&latest)
        );
        assert_eq!(db.get("reviews", "a").unwrap(), Some(latest));
        assert!(!db
            .cache_statistics_review("missing", &original, &original)
            .unwrap());
    }
}
