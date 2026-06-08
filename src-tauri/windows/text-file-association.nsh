!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Saekim.txt" "" "Text Document"
  WriteRegStr SHCTX "Software\Classes\Saekim.txt\DefaultIcon" "" "$SYSDIR\imageres.dll,-102"
  WriteRegStr SHCTX "Software\Classes\Saekim.txt\shell\open\command" "" "$\"$INSTDIR\Saekim.exe$\" $\"%1$\""
  WriteRegStr SHCTX "Software\Classes\.txt\OpenWithProgids" "Saekim.txt" ""
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue SHCTX "Software\Classes\.txt\OpenWithProgids" "Saekim.txt"
  DeleteRegKey SHCTX "Software\Classes\Saekim.txt"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
