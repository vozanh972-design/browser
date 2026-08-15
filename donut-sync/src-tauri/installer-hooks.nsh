!macro NSIS_HOOK_PREINSTALL
  IfFileExists "$INSTDIR\prfnoir-proxy.exe" 0 prfnoir_proxy_preinstall_done

  DetailPrint "Stopping PrfNoir proxy workers before replacing application files"
  nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /F /T /IM "prfnoir-proxy.exe"'
  Pop $0
  Pop $1
  Sleep 1000

  ; Removing the old sidecar first prevents NSIS from retaining a same-version
  ; or previously locked executable while updating the main application.
  Delete "$INSTDIR\prfnoir-proxy.exe"

  prfnoir_proxy_preinstall_done:
!macroend
