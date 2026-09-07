package com.beeean17.saekim

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebView

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    configureAndroidWindow()
  }

  override fun onResume() {
    super.onResume()
    configureAndroidWindow()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) applyImmersiveFullscreen()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.isFocusable = true
    webView.isFocusableInTouchMode = true
  }

  private fun configureAndroidWindow() {
    window.setSoftInputMode(
      WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
        WindowManager.LayoutParams.SOFT_INPUT_STATE_UNSPECIFIED,
    )
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val attributes = window.attributes
      attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      window.attributes = attributes
    }

    applyImmersiveFullscreen()
  }

  private fun applyImmersiveFullscreen() {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  }
}
