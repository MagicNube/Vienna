mod api;
mod database;
mod engine;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};
use tauri::{Emitter, Manager};

pub type Emit = Arc<dyn Fn(Value) + Send + Sync>;
pub struct Backend {
    db: database::Database,
    engine: Option<PathBuf>,
    engine_id: String,
    interactive: Arc<AtomicU64>,
    review: Arc<AtomicU64>,
    interactive_lock: tokio::sync::Mutex<()>,
    review_lock: tokio::sync::Mutex<()>,
}
impl Backend {
    pub fn new(data: PathBuf, resources: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
        let engine = engine::locate(&resources);
        let engine_id = engine
            .as_ref()
            .and_then(|p| std::fs::read(p).ok())
            .map(|b| format!("{:x}", Sha256::digest(b)))
            .unwrap_or_default();
        Ok(Self {
            db: database::Database::open(&data.join("vienna.sqlite3"))?,
            engine,
            engine_id,
            interactive: Arc::new(AtomicU64::new(0)),
            review: Arc::new(AtomicU64::new(0)),
            interactive_lock: tokio::sync::Mutex::new(()),
            review_lock: tokio::sync::Mutex::new(()),
        })
    }
    pub async fn call(&self, command: &str, args: Value, emit: Emit) -> Result<Value, String> {
        let str_arg = |key: &str| {
            args[key]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| format!("Falta {key}"))
        };
        match command {
            "status" => Ok(
                json!({"available":self.engine.is_some(),"name":"Stockfish 19","engineId":self.engine_id,"cpus":std::thread::available_parallelism().map(|n|n.get()).unwrap_or(2)}),
            ),
            "get" => Ok(self
                .db
                .get(&str_arg("kind")?, &str_arg("id")?)?
                .unwrap_or(Value::Null)),
            "list" => Ok(json!(self.db.list(&str_arg("kind")?)?)),
            "review-index" => Ok(json!(self
                .db
                .reviewed_ids(args["version"].as_i64().ok_or("Falta version")?)?)),
            "statistics-reviews" => {
                let ids: Vec<String> =
                    serde_json::from_value(args["ids"].clone()).map_err(|e| e.to_string())?;
                self.db.statistics_reviews(&ids)
            }
            "cache-statistics-review" => Ok(json!(self.db.cache_statistics_review(
                &str_arg("id")?,
                &args["expected"],
                &args["value"]
            )?)),
            "storage-info" | "clear-old-reviews" => {
                let cutoff = args["cutoff"]
                    .as_i64()
                    .filter(|v| *v > 0)
                    .ok_or("Fecha de limpieza no válida")?;
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis() as i64;
                if cutoff > now {
                    return Err("La fecha de limpieza no puede estar en el futuro".into());
                }
                let protected: Vec<String> =
                    serde_json::from_value(args["protected"].clone()).map_err(|e| e.to_string())?;
                if command == "storage-info" {
                    Ok(json!(self.db.storage_info(cutoff, &protected)?))
                } else {
                    Ok(json!(self.db.clear_old_reviews(cutoff, &protected)?))
                }
            }
            "clear-position-cache" => {
                self.db.clear_position_cache()?;
                Ok(Value::Null)
            }
            "put" => {
                self.db
                    .put(&str_arg("kind")?, &str_arg("id")?, &args["value"])?;
                Ok(Value::Null)
            }
            "sync" => {
                api::sync(
                    &str_arg("username")?,
                    args["months"].as_u64().unwrap_or(2) as usize,
                )
                .await
            }
            "cancel" => {
                let g = if args["lane"] == "review" {
                    &self.review
                } else {
                    &self.interactive
                };
                g.fetch_add(1, Ordering::SeqCst);
                Ok(Value::Null)
            }
            "analyze" => {
                let fen = str_arg("fen")?;
                let history: Vec<String> =
                    serde_json::from_value(args["history"].clone()).map_err(|e| e.to_string())?;
                let options: engine::Options =
                    serde_json::from_value(args["options"].clone()).map_err(|e| e.to_string())?;
                options.validate()?;
                let (g, lock) = if args["lane"] == "review" {
                    (self.review.clone(), &self.review_lock)
                } else {
                    (self.interactive.clone(), &self.interactive_lock)
                };
                let ticket = g.fetch_add(1, Ordering::SeqCst) + 1;
                let _guard = lock.lock().await;
                if g.load(Ordering::SeqCst) != ticket {
                    return Err("cancelled".into());
                }
                let key = engine::cache_key(&fen, &history, &options, &self.engine_id);
                if options.movetime > 0 {
                    if let Some(mut result) = self.db.cached(&key) {
                        result["cached"] = json!(true);
                        return Ok(result);
                    }
                }
                let path=self.engine.as_ref().ok_or("Stockfish 19 no está instalado. Ejecuta npm run engine:install y reinicia Vienna.")?;
                let id = args["requestId"].clone();
                let lines = engine::analyze(
                    path,
                    &fen,
                    &history,
                    &options,
                    g,
                    ticket,
                    args["lane"] == "review",
                    move |lines| emit(json!({"requestId":id,"lines":lines})),
                )
                .await?;
                let result = json!({"lines":lines,"cached":false,"engineId":self.engine_id});
                if options.movetime > 0 {
                    self.db.cache(&key, &result)?;
                }
                Ok(result)
            }
            _ => Err("Comando desconocido".into()),
        }
    }
}
#[tauri::command]
async fn rpc(
    command: String,
    args: Value,
    state: tauri::State<'_, Arc<Backend>>,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    state
        .call(
            &command,
            args,
            Arc::new(move |value| {
                let _ = app.emit("engine-info", value);
            }),
        )
        .await
}
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .setup(|app| {
            let resource = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/stockfish")
            } else {
                app.path().resource_dir()?.join("resources/stockfish")
            };
            let backend = Backend::new(app.path().app_data_dir()?, resource)
                .map_err(std::io::Error::other)?;
            app.manage(Arc::new(backend));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![rpc])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Vienna");
}
