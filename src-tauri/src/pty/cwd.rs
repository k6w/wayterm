//! Current working directory of a process, looked up from the OS.

/// Working directory of `pid`, or `None` when unknown or unsupported (Windows).
pub fn cwd_of_pid(pid: i32) -> Option<String> {
    if pid <= 0 {
        return None;
    }
    platform::cwd_of_pid(pid)
}

#[cfg(target_os = "macos")]
mod platform {
    pub fn cwd_of_pid(pid: i32) -> Option<String> {
        // SAFETY: proc_vnodepathinfo is plain-old-data; zeroed is a valid value and
        // proc_pidinfo writes at most `size` bytes into it.
        let mut info: libc::proc_vnodepathinfo = unsafe { std::mem::zeroed() };
        let size = std::mem::size_of::<libc::proc_vnodepathinfo>() as libc::c_int;
        let written = unsafe {
            libc::proc_pidinfo(
                pid,
                libc::PROC_PIDVNODEPATHINFO,
                0,
                &mut info as *mut _ as *mut libc::c_void,
                size,
            )
        };
        if written != size {
            return None;
        }
        let raw = &info.pvi_cdir.vip_path;
        let bytes: Vec<u8> = raw
            .iter()
            .flat_map(|row| row.iter())
            .take_while(|c| **c != 0)
            .map(|c| *c as u8)
            .collect();
        if bytes.is_empty() {
            return None;
        }
        String::from_utf8(bytes).ok()
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
mod platform {
    pub fn cwd_of_pid(pid: i32) -> Option<String> {
        std::fs::read_link(format!("/proc/{pid}/cwd"))
            .ok()
            .map(|p| p.to_string_lossy().into_owned())
    }
}

#[cfg(not(unix))]
mod platform {
    pub fn cwd_of_pid(_pid: i32) -> Option<String> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn own_cwd_matches_current_dir() {
        let expected = std::env::current_dir().unwrap().canonicalize().unwrap();
        let got = cwd_of_pid(std::process::id() as i32).expect("cwd for own pid");
        assert_eq!(std::path::Path::new(&got).canonicalize().unwrap(), expected);
    }

    #[test]
    fn invalid_pid_is_none() {
        assert_eq!(cwd_of_pid(0), None);
        assert_eq!(cwd_of_pid(-5), None);
    }

    #[cfg(unix)]
    #[test]
    fn child_cwd_is_reported() {
        let dir = std::env::temp_dir().canonicalize().unwrap();
        let mut child = std::process::Command::new("sleep")
            .arg("5")
            .current_dir(&dir)
            .spawn()
            .unwrap();
        let got = cwd_of_pid(child.id() as i32);
        let _ = child.kill();
        let _ = child.wait();
        assert_eq!(std::path::Path::new(&got.unwrap()).canonicalize().unwrap(), dir);
    }
}
