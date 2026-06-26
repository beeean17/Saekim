package com.beeean17.saekim

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class AndroidImagePickerPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun pickImage(invoke: Invoke) {
    try {
      val intent = PickVisualMedia().createIntent(
        activity,
        PickVisualMediaRequest(PickVisualMedia.ImageOnly),
      )
      intent.addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
      )
      startActivityForResult(invoke, intent, "pickImageResult")
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to open image picker")
    }
  }

  @ActivityCallback
  fun pickImageResult(invoke: Invoke, result: ActivityResult) {
    try {
      val response = JSObject()
      if (result.resultCode != Activity.RESULT_OK) {
        response.put("path", null)
        response.put("name", null)
        response.put("displayPath", null)
        invoke.resolve(response)
        return
      }

      val data = result.data
      val uri = data?.data
      if (uri == null) {
        response.put("path", null)
        response.put("name", null)
        response.put("displayPath", null)
        invoke.resolve(response)
        return
      }

      persistReadPermission(uri, data)
      val name = displayName(uri) ?: imageNameFromUri(uri)
      response.put("path", uri.toString())
      response.put("name", name)
      response.put("displayPath", contentUriDisplayPath(uri, name))
      invoke.resolve(response)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to read image picker result")
    }
  }

  private fun persistReadPermission(uri: Uri, data: Intent) {
    val persistableFlags = data.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION
    if (persistableFlags == 0) return

    try {
      activity.contentResolver.takePersistableUriPermission(uri, persistableFlags)
    } catch (_: SecurityException) {
      return
    }
  }

  private fun displayName(uri: Uri): String? {
    val projection = arrayOf(OpenableColumns.DISPLAY_NAME)
    activity.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
      if (!cursor.moveToFirst()) return null
      val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (index < 0) return null
      return cursor.getString(index)?.takeIf { it.isNotBlank() }
    }
    return null
  }

  private fun imageNameFromUri(uri: Uri): String {
    return uri.lastPathSegment
      ?.substringAfterLast('/')
      ?.takeIf { it.isNotBlank() }
      ?: "image"
  }

  private fun contentUriDisplayPath(uri: Uri, name: String): String {
    return when (uri.authority) {
      "com.android.providers.downloads.documents" -> "Downloads / $name"
      "com.android.externalstorage.documents" -> "Storage / $name"
      "com.android.providers.media.documents", "media" -> "Media / $name"
      null, "" -> name
      else -> "${uri.authority} / $name"
    }
  }
}
