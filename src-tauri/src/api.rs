use serde_json::Value;
pub async fn sync(username: &str, months: usize) -> Result<Value, String> {
    if username.is_empty()
        || username.len() > 50
        || !username
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err("Nombre de usuario no válido".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("Vienna-Chess/0.1 (personal local analysis; public games)")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let base = format!(
        "https://api.chess.com/pub/player/{}/games/",
        username.to_lowercase()
    );
    let archives = fetch(&client, &format!("{base}archives")).await?;
    let mut games = Vec::new();
    let urls = archives["archives"]
        .as_array()
        .ok_or("Respuesta de archivos no válida")?;
    for url in urls.iter().rev().take(months.clamp(1, 24)) {
        let url = url.as_str().ok_or("Archivo no válido")?;
        if !url.starts_with(&base) {
            return Err("URL de archivo inesperada".into());
        }
        let data = fetch(&client, url).await?;
        if let Some(entries) = data["games"].as_array() {
            games.extend(entries.iter().filter(|g| g["rules"] == "chess").cloned());
        }
    }
    Ok(serde_json::json!({"games":games,"months":months}))
}
async fn fetch(client: &reqwest::Client, url: &str) -> Result<Value, String> {
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("No se pudo conectar con Chess.com: {e}"))?;
    match res.status().as_u16() {
        404 => return Err("No se encontró ese usuario en Chess.com".into()),
        429 => return Err("Chess.com pide esperar. Vuelve a actualizar en unos minutos".into()),
        _ => {}
    }
    res.error_for_status()
        .map_err(|e| format!("Chess.com: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Respuesta no válida: {e}"))
}
