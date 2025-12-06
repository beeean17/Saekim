"""
Settings Dialog
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel, 
                             QComboBox, QPushButton, QGroupBox, QFormLayout)
from PyQt6.QtCore import Qt
from utils.design_manager import DesignManager

class SettingsDialog(QDialog):
    def __init__(self, parent=None, theme_manager=None):
        super().__init__(parent)
        self.theme_manager = theme_manager
        self.setWindowTitle("Settings")
        self.setFont(DesignManager.get_font("body"))
        self.setFixedSize(400, 300)
        self.setModal(True)
        
        layout = QVBoxLayout(self)
        
        # Appearance Group
        group_appearance = QGroupBox("Appearance")
        form_layout = QFormLayout()
        
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
        
        form_layout.addRow("Theme:", self.combo_theme)
        group_appearance.setLayout(form_layout)
        layout.addWidget(group_appearance)
        
        layout.addStretch()
        
        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.btn_close = QPushButton("Close")
        self.btn_close.clicked.connect(self.accept)
        btn_layout.addWidget(self.btn_close)
        
        layout.addLayout(btn_layout)
        
    def on_theme_changed(self, index):
        if not self.theme_manager:
            return
            
        theme_key = self.combo_theme.itemData(index)
        if theme_key:
            # Apply theme immediately
            if self.parent():
                self.parent().apply_theme(theme_key)
