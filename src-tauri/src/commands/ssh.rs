use crate::db::{self, connections::ConnectionProfile, DbPool};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn ssh_list_connections(
    pool: State<'_, DbPool>,
) -> Result<Vec<ConnectionProfile>, String> {
    db::connections::list(&pool)
}

#[tauri::command]
pub async fn ssh_save_connection(
    profile: ConnectionProfile,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    let exists = db::connections::list(&pool)?
        .iter()
        .any(|c| c.id == profile.id);
    if exists {
        db::connections::update(&pool, &profile)
    } else {
        let mut p = profile;
        if p.id.is_empty() {
            p.id = Uuid::new_v4().to_string();
        }
        db::connections::insert(&pool, &p)
    }
}

#[tauri::command]
pub async fn ssh_delete_connection(
    id: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::connections::delete(&pool, &id)
}
