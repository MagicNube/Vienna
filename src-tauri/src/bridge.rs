//! Development/testing adapter. Uses exactly the same backend as Tauri; no mock engine.
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Arc};
use tokio::io::{AsyncBufReadExt, BufReader};
#[tokio::main]
async fn main() {
    let data = std::env::var_os("VIENNA_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.vienna-dev"));
    let backend = Arc::new(
        vienna_core::Backend::new(
            data,
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/stockfish"),
        )
        .expect("base de datos"),
    );
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let Ok(req) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let backend = backend.clone();
        tokio::spawn(async move {
            let emit: vienna_core::Emit = Arc::new(|v| println!("{}", json!({"event":v})));
            let result = backend
                .call(
                    req["command"].as_str().unwrap_or(""),
                    req["args"].clone(),
                    emit,
                )
                .await;
            match result {
                Ok(value) => println!("{}", json!({"id":req["id"],"result":value})),
                Err(error) => println!("{}", json!({"id":req["id"],"error":error})),
            }
        });
    }
}
