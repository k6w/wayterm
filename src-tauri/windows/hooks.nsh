; Nexterm NSIS installer hooks — adds "Open in Nexterm" to Windows Explorer context menu

!macro NSIS_HOOK_POSTINSTALL
  ; Right-click on a folder
  WriteRegStr HKCU "Software\Classes\Directory\shell\Nexterm" "" "Open in Nexterm"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Nexterm" "Icon" "$INSTDIR\nexterm.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Nexterm\command" "" '"$INSTDIR\nexterm.exe" "%V"'

  ; Right-click on folder background (inside a folder)
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Nexterm" "" "Open in Nexterm"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Nexterm" "Icon" "$INSTDIR\nexterm.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Nexterm\command" "" '"$INSTDIR\nexterm.exe" "%V"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Clean up context menu entries
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Nexterm"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Nexterm"
!macroend
