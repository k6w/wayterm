; Wayterm NSIS installer hooks — adds "Open in Wayterm" to Windows Explorer context menu

!macro NSIS_HOOK_POSTINSTALL
  ; Right-click on a folder
  WriteRegStr HKCU "Software\Classes\Directory\shell\Wayterm" "" "Open in Wayterm"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Wayterm" "Icon" "$INSTDIR\wayterm.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Wayterm\command" "" '"$INSTDIR\wayterm.exe" "%V"'

  ; Right-click on folder background (inside a folder)
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Wayterm" "" "Open in Wayterm"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Wayterm" "Icon" "$INSTDIR\wayterm.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Wayterm\command" "" '"$INSTDIR\wayterm.exe" "%V"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Clean up context menu entries
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Wayterm"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Wayterm"
!macroend
