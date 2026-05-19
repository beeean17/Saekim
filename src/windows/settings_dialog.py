"""
Settings Dialog
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel, 
                             QComboBox, QPushButton, QGroupBox, QFormLayout)
from PyQt6.QtCore import Qt
from utils.design_manager import DesignManager
from windows.license_dialog import LicenseDialog

class SettingsDialog(QDialog):
    def __init__(self, parent=None, theme_manager=None):
        super().__init__(parent)
        self.theme_manager = theme_manager
        self.setObjectName("SettingsDialog")
        self.setWindowTitle("설정")
        self.setFont(DesignManager.get_font("body"))
        self.setFixedSize(440, 360)
        self.setModal(True)
        self.setStyleSheet("""
            QDialog#SettingsDialog {
                background: palette(window);
            }
            QGroupBox#SettingsSection {
                border: 1px solid palette(mid);
                border-radius: 8px;
                margin-top: 12px;
                padding: 16px 12px 12px 12px;
                font-weight: 600;
            }
            QGroupBox#SettingsSection::title {
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 6px;
            }
            QComboBox {
                min-height: 28px;
                padding: 4px 8px;
                border-radius: 6px;
            }
            QPushButton {
                min-height: 30px;
                padding: 4px 12px;
                border-radius: 6px;
            }
            QPushButton#PrimaryAction {
                font-weight: 600;
            }
        """)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 18, 18, 14)
        layout.setSpacing(12)

        title_label = QLabel("설정")
        title_label.setObjectName("DialogTitle")
        title_font = DesignManager.get_font("header")
        title_font.setBold(True)
        title_label.setFont(title_font)
        layout.addWidget(title_label)
        
        # Appearance Group
        group_appearance = QGroupBox("화면")
        group_appearance.setObjectName("SettingsSection")
        form_layout = QFormLayout()
        form_layout.setContentsMargins(0, 4, 0, 0)
        form_layout.setSpacing(10)
        
        self.combo_theme = QComboBox()
        if self.theme_manager:
            # Add themes
            for key, data in self.theme_manager.THEMES.items():
                self.combo_theme.addItem(data['name'], key)
            
            # Select current theme
            index = self.combo_theme.findData(self.theme_manager.current_theme)
            if index >= 0:
                self.combo_theme.setCurrentIndex(index)
                
        self.combo_theme.currentIndexChanged.connect(self.on_theme_changed)
        
        form_layout.addRow("테마", self.combo_theme)
        group_appearance.setLayout(form_layout)
        layout.addWidget(group_appearance)
        
        # About / License Group
        group_about = QGroupBox("정보")
        group_about.setObjectName("SettingsSection")
        about_layout = QVBoxLayout()
        about_layout.setContentsMargins(0, 4, 0, 0)
        about_layout.setSpacing(8)
        
        btn_license = QPushButton("라이선스 및 오픈소스 정보")
        btn_license.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        btn_license.clicked.connect(self.open_license_dialog)
        about_layout.addWidget(btn_license)
        
        btn_check_update = QPushButton("업데이트 확인")
        btn_check_update.setObjectName("PrimaryAction")
        btn_check_update.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        btn_check_update.clicked.connect(self.check_for_updates)
        about_layout.addWidget(btn_check_update)
        
        group_about.setLayout(about_layout)
        layout.addWidget(group_about)
        
        layout.addStretch()
        
        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.btn_close = QPushButton("닫기")
        self.btn_close.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.btn_close.clicked.connect(self.accept)
        btn_layout.addWidget(self.btn_close)
        
        layout.addLayout(btn_layout)
        
    def open_license_dialog(self):
        """Open the license information dialog"""
        dialog = LicenseDialog(self)
        dialog.exec()
    
    def check_for_updates(self):
        """Check for updates and show appropriate dialog"""
        from PyQt6.QtWidgets import QMessageBox
        from utils.update_manager import UpdateManager
        
        self.setCursor(Qt.CursorShape.WaitCursor)
        
        try:
            manager = UpdateManager()
            update_info = manager.check_for_updates()
            
            self.setCursor(Qt.CursorShape.ArrowCursor)
            
            if update_info:
                # Update available - show update dialog
                from windows.update_dialog import UpdateDialog
                dialog = UpdateDialog(update_info, parent=self.parent())
                self.close()  # Close settings first
                dialog.exec()
            else:
                # Already up to date
                QMessageBox.information(
                    self,
                    "업데이트 확인",
                    f"최신 버전입니다! (v{UpdateManager.CURRENT_VERSION})\n\n"
                    "You are using the latest version."
                )
        except Exception as e:
            self.setCursor(Qt.CursorShape.ArrowCursor)
            QMessageBox.warning(
                self,
                "업데이트 확인 실패",
                f"업데이트를 확인할 수 없습니다.\n\n{str(e)}"
            )
        
    def on_theme_changed(self, index):
        if not self.theme_manager:
            return
            
        theme_key = self.combo_theme.itemData(index)
        if theme_key:
            # Apply theme immediately
            if self.parent():
                self.parent().apply_theme(theme_key)
