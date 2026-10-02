use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub threads: u32,
    pub hash: u32,
    pub multi_pv: u32,
    pub movetime: u64,
    pub depth: Option<u32>,
}
impl Options {
    pub fn validate(&self) -> Result<(), String> {
        if !(1..=128).contains(&self.threads)
            || !(16..=2048).contains(&self.hash)
            || !(1..=5).contains(&self.multi_pv)
            || (self.movetime != 0 && self.movetime < 50)
            || self.depth.is_some_and(|d| d == 0 || d > 128)
        {
            return Err("Parámetros del motor fuera de rango".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    pub rank: u32,
    pub depth: u32,
    pub nodes: u64,
    pub cp: Option<i32>,
    pub mate: Option<i32>,
    pub wdl: Option<[u32; 3]>,
    pub pv: Vec<String>,
}
pub fn parse_info(line: &str, white_turn: bool) -> Option<Line> {
    let t: Vec<&str> = line.split_whitespace().collect();
    if t.first() != Some(&"info") || t.contains(&"lowerbound") || t.contains(&"upperbound") {
        return None;
    }
    let num = |key: &str| {
        t.iter()
            .position(|s| *s == key)
            .and_then(|i| t.get(i + 1))
            .and_then(|v| v.parse::<i64>().ok())
    };
    let pv_i = t.iter().position(|s| *s == "pv")?;
    let sign = if white_turn { 1 } else { -1 };
    let cp = num("cp").map(|v| v as i32 * sign);
    let mate = num("mate").map(|v| v as i32 * sign);
    if cp.is_none() && mate.is_none() {
        return None;
    }
    let wdl = t
        .iter()
        .position(|s| *s == "wdl")
        .and_then(|i| {
            Some([
                t.get(i + 1)?.parse().ok()?,
                t.get(i + 2)?.parse().ok()?,
                t.get(i + 3)?.parse().ok()?,
            ])
        })
        .map(|w| if white_turn { w } else { [w[2], w[1], w[0]] });
    Some(Line {
        rank: num("multipv").unwrap_or(1) as u32,
        depth: num("depth")? as u32,
        nodes: num("nodes").unwrap_or(0) as u64,
        cp,
        mate,
        wdl,
        pv: t[pv_i + 1..].iter().map(|s| s.to_string()).collect(),
    })
}
pub fn locate(root: &Path) -> Option<PathBuf> {
    let mut dirs = vec![root.to_owned()];
    while let Some(dir) = dirs.pop() {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs.push(path)
                } else {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.starts_with("stockfish")
                        && (name.ends_with(".exe")
                            || (!cfg!(windows) && path.extension().is_none()))
                    {
                        return Some(path);
                    }
                }
            }
        }
    }
    None
}
pub fn cache_key(fen: &str, history: &[String], options: &Options, engine_id: &str) -> String {
    format!(
        "{:x}",
        Sha256::digest(format!(
            "v3|{engine_id}|{fen}|{}|{}",
            history.join(" "),
            serde_json::to_string(options).unwrap()
        ))
    )
}
pub async fn analyze(
    path: &Path,
    fen: &str,
    history: &[String],
    options: &Options,
    generation: Arc<AtomicU64>,
    ticket: u64,
    background: bool,
    emit: impl Fn(Vec<Line>) + Send,
) -> Result<Vec<Line>, String> {
    options.validate()?;
    if fen.contains(['\n', '\r'])
        || fen.split_whitespace().count() != 6
        || !history
            .iter()
            .all(|m| m.len() >= 4 && m.len() <= 5 && m.bytes().all(|b| b.is_ascii_alphanumeric()))
    {
        return Err("Posición UCI no válida".into());
    }
    let mut cmd = Command::new(path);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    // Keep the background review responsive to other applications without
    // changing its configured thread count or per-position search budget.
    cmd.creation_flags(0x08000000 | if background { 0x00004000 } else { 0 });
    #[cfg(not(windows))]
    let _ = background;
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("No se pudo iniciar Stockfish: {e}"))?;
    let mut input = child.stdin.take().ok_or("Sin entrada UCI")?;
    let mut output = BufReader::new(child.stdout.take().ok_or("Sin salida UCI")?).lines();
    let operation = async {
        input.write_all(b"uci\n").await.map_err(|e| e.to_string())?;
        let mut valid = false;
        loop {
            let l = output
                .next_line()
                .await
                .map_err(|e| e.to_string())?
                .ok_or("Stockfish cerró la conexión")?;
            if l.starts_with("id name Stockfish 19") {
                valid = true;
            }
            if l == "uciok" {
                break;
            }
        }
        if !valid {
            return Err("El ejecutable debe ser Stockfish 19 oficial".into());
        }
        let settings=format!("setoption name Threads value {}\nsetoption name Hash value {}\nsetoption name MultiPV value {}\nsetoption name UCI_ShowWDL value true\nisready\n",options.threads,options.hash,options.multi_pv);
        input
            .write_all(settings.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        loop {
            if output
                .next_line()
                .await
                .map_err(|e| e.to_string())?
                .ok_or("Motor desconectado")?
                == "readyok"
            {
                break;
            }
        }
        let moves = if history.is_empty() {
            String::new()
        } else {
            format!(" moves {}", history.join(" "))
        };
        let mut go = String::from("go");
        if options.movetime > 0 {
            go.push_str(&format!(" movetime {}", options.movetime));
        }
        if let Some(d) = options.depth {
            go.push_str(&format!(" depth {d}"));
        }
        if options.movetime == 0 && options.depth.is_none() {
            go.push_str(" infinite");
        }
        input
            .write_all(format!("position fen {fen}{moves}\n{go}\n").as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        let white_turn = (fen.split_whitespace().nth(1) == Some("w")) == (history.len() % 2 == 0);
        let mut lines = BTreeMap::new();
        let mut depths: BTreeMap<u32, BTreeMap<u32, Line>> = BTreeMap::new();
        let mut complete: Option<Vec<Line>> = None;
        while let Some(l) = output.next_line().await.map_err(|e| e.to_string())? {
            if l.starts_with("bestmove") {
                break;
            }
            if let Some(info) = parse_info(&l, white_turn) {
                let depth = info.depth;
                lines.insert(info.rank, info.clone());
                let iteration = depths.entry(depth).or_default();
                iteration.insert(info.rank, info);
                if iteration.len() == options.multi_pv as usize {
                    let snapshot: Vec<Line> = iteration.values().cloned().collect();
                    emit(snapshot.clone());
                    complete = Some(snapshot);
                    depths.retain(|d, _| *d >= depth);
                }
            }
        }
        if lines.is_empty() {
            return Err("El motor no devolvió líneas para esta posición".into());
        }
        let _ = input.write_all(b"quit\n").await;
        Ok(complete.unwrap_or_else(|| lines.into_values().collect()))
    };
    let result = tokio::select! {
        r=operation=>r,
        _=async {loop {if generation.load(Ordering::SeqCst)!=ticket {break;} tokio::time::sleep(Duration::from_millis(25)).await;}} => Err("cancelled".into()),
        _=async {if options.movetime==0 {std::future::pending::<()>().await} else {tokio::time::sleep(Duration::from_millis(options.movetime.saturating_add(30000))).await}} => Err("El motor no respondió a tiempo".into())
    };
    // kill_on_drop is a fallback, not a completion barrier. Reap the child
    // before releasing the lane lock and starting the next queued position.
    let _ = child.kill().await;
    let _ = child.wait().await;
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalizes_black() {
        let l = parse_info(
            "info depth 18 multipv 2 score cp 84 wdl 600 300 100 nodes 123 pv e7e5 g1f3",
            false,
        )
        .unwrap();
        assert_eq!(l.cp, Some(-84));
        assert_eq!(l.wdl, Some([100, 300, 600]));
        assert_eq!(l.rank, 2);
    }
    #[test]
    fn mate_and_bounds() {
        assert_eq!(
            parse_info("info depth 9 score mate -3 pv a1a2", false)
                .unwrap()
                .mate,
            Some(3)
        );
        assert!(parse_info("info depth 4 score cp 20 lowerbound pv e2e4", true).is_none());
    }
    #[test]
    fn history_is_part_of_cache() {
        let o = Options {
            threads: 1,
            hash: 16,
            multi_pv: 3,
            movetime: 150,
            depth: None,
        };
        assert_ne!(
            cache_key("fen", &[], &o, "19"),
            cache_key("fen", &["e2e4".into()], &o, "19")
        );
    }
}
