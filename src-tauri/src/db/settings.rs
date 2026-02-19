use super::DbPool;
use rusqlite::OptionalExtension;
use serde_json::Value;

pub fn get(pool: &DbPool, key: &str) -> Result<Option<Value>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare("SELECT value, type FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([key], |row| {
            let value: String = row.get(0)?;
            let typ: String = row.get(1)?;
            Ok((value, typ))
        })
        .optional()
        .map_err(|e| e.to_string())?;

    match result {
        Some((value, typ)) => {
            let parsed = match typ.as_str() {
                "string" => Value::String(value),
                "number" => serde_json::from_str(&value).map_err(|e| e.to_string())?,
                "boolean" => Value::Bool(value == "true"),
                "json" => serde_json::from_str(&value).map_err(|e| e.to_string())?,
                _ => Value::String(value),
            };
            Ok(Some(parsed))
        }
        None => Ok(None),
    }
}

pub fn set(pool: &DbPool, key: &str, value: &Value) -> Result<(), String> {
    let conn = pool.lock();
    let (val_str, typ) = match value {
        Value::String(s) => (s.clone(), "string"),
        Value::Number(_) => (value.to_string(), "number"),
        Value::Bool(b) => (b.to_string(), "boolean"),
        _ => (value.to_string(), "json"),
    };

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, type) VALUES (?1, ?2, ?3)",
        rusqlite::params![key, val_str, typ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_all(pool: &DbPool) -> Result<serde_json::Map<String, Value>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare("SELECT key, value, type FROM settings")
        .map_err(|e| e.to_string())?;

    let mut map = serde_json::Map::new();
    let rows = stmt
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            let typ: String = row.get(2)?;
            Ok((key, value, typ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (key, value, typ) = row.map_err(|e| e.to_string())?;
        let parsed = match typ.as_str() {
            "string" => Value::String(value),
            "number" => serde_json::from_str(&value).unwrap_or(Value::String(value)),
            "boolean" => Value::Bool(value == "true"),
            "json" => serde_json::from_str(&value).unwrap_or(Value::String(value)),
            _ => Value::String(value),
        };
        map.insert(key, parsed);
    }

    Ok(map)
}
