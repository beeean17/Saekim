package com.beeean17.saekim

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.MimeTypeMap
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.Locale

@InvokeArg
class DisplayNameArgs {
  lateinit var uri: String
}

@InvokeArg
class FolderListArgs {
  lateinit var uri: String
  var depth: Int = 0
}

@InvokeArg
class CopyImageToAssetsArgs {
  lateinit var sourceUri: String
  lateinit var currentFileUri: String
}

@InvokeArg
class ImportImageBytesToAssetsArgs {
  lateinit var data: String
  var fileName: String? = null
  var mimeType: String? = null
  lateinit var currentFileUri: String
}

@TauriPlugin
class AndroidDocumentMetadataPlugin(private val activity: Activity) : Plugin(activity) {
  private data class DocumentRow(
    val documentId: String,
    val name: String,
    val mimeType: String,
    val modifiedAt: Long,
    val uri: Uri,
  ) {
    val isDirectory: Boolean
      get() = mimeType == DocumentsContract.Document.MIME_TYPE_DIR
  }

  private val treeGrantFlags =
    Intent.FLAG_GRANT_READ_URI_PERMISSION or
      Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
      Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
      Intent.FLAG_GRANT_PREFIX_URI_PERMISSION

  @Command
  fun getDisplayName(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(DisplayNameArgs::class.java)
      val result = JSObject()
      result.put("displayName", displayName(args.uri))
      invoke.resolve(result)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to read document metadata")
    }
  }

  @Command
  fun openFolder(invoke: Invoke) {
    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
      intent.addFlags(treeGrantFlags)
      startActivityForResult(invoke, intent, "openFolderResult")
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to open folder picker")
    }
  }

  @ActivityCallback
  fun openFolderResult(invoke: Invoke, result: ActivityResult) {
    try {
      val response = JSObject()
      if (result.resultCode != Activity.RESULT_OK) {
        response.put("uri", null)
        response.put("displayName", null)
        invoke.resolve(response)
        return
      }

      val data = result.data
      val uri = data?.data
      if (uri == null) {
        response.put("uri", null)
        response.put("displayName", null)
        invoke.resolve(response)
        return
      }

      val persistableFlags =
        (data.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION) or
          (data.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      if (persistableFlags != 0) {
        try {
          activity.contentResolver.takePersistableUriPermission(uri, persistableFlags)
        } catch (_: SecurityException) {
          // Some providers grant access for this session only.
        }
      }

      response.put("uri", uri.toString())
      response.put("displayName", folderDisplayName(uri))
      invoke.resolve(response)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to read folder picker result")
    }
  }

  @Command
  fun readFolder(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(FolderListArgs::class.java)
      val uri = Uri.parse(args.uri)
      val response = JSObject()
      response.put("rootPath", args.uri)
      response.put("tree", readChildren(uri, 0, args.depth.coerceAtLeast(0), true, false))
      invoke.resolve(response)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to read folder")
    }
  }

  @Command
  fun readFolderChildren(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(FolderListArgs::class.java)
      val uri = Uri.parse(args.uri)
      val response = JSObject()
      response.put("tree", readChildren(uri, 0, args.depth.coerceAtLeast(0), false, false))
      invoke.resolve(response)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to read folder children")
    }
  }

  @Command
  fun copyImageToAssets(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(CopyImageToAssetsArgs::class.java)
      val sourceUri = Uri.parse(args.sourceUri)
      val currentFileUri = Uri.parse(args.currentFileUri)
      val sourceName = displayName(args.sourceUri)
      val mimeType = imageMimeType(sourceUri, sourceName)
      val extension = imageExtension(sourceName, mimeType)
      val baseName = imageBaseName(sourceName, "image")
      val bytes =
        activity.contentResolver.openInputStream(sourceUri)?.use { input -> input.readBytes() }
          ?: throw IllegalStateException("Failed to read selected image")
      val relativePath = writeImageBytesToAssets(currentFileUri, bytes, baseName, extension, mimeType)
      val response = JSObject()
      response.put("path", relativePath)
      invoke.resolve(response)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to copy image to assets")
    }
  }

  @Command
  fun importImageBytesToAssets(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(ImportImageBytesToAssetsArgs::class.java)
      val bytes = Base64.decode(args.data, Base64.DEFAULT)
      val mimeType = normalizedImageMimeType(args.mimeType, args.fileName)
      val extension = imageExtension(args.fileName, mimeType)
      val baseName = imageBaseName(args.fileName, "image")
      val relativePath = writeImageBytesToAssets(Uri.parse(args.currentFileUri), bytes, baseName, extension, mimeType)
      val response = JSObject()
      response.put("path", relativePath)
      invoke.resolve(response)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Failed to import image to assets")
    }
  }

  private fun readChildren(
    folderUri: Uri,
    depth: Int,
    maxDepth: Int,
    openRootFolders: Boolean,
    insideAssets: Boolean,
  ): JSArray {
    val folderDocumentId = documentIdFor(folderUri)
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(folderUri, folderDocumentId)
    val projection =
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
      )

    val rows = mutableListOf<DocumentRow>()
    activity.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
      val documentIdColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val nameColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val mimeColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE)
      val modifiedColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)

      while (cursor.moveToNext()) {
        val documentId = cursor.getStringOrNull(documentIdColumn) ?: continue
        val name = cursor.getStringOrNull(nameColumn) ?: continue
        val mimeType = cursor.getStringOrNull(mimeColumn) ?: ""
        val modifiedAt = cursor.getLongOrNull(modifiedColumn) ?: 0L
        val documentUri = DocumentsContract.buildDocumentUriUsingTree(folderUri, documentId)
        val row = DocumentRow(documentId, name, mimeType, modifiedAt, documentUri)
        if (shouldInclude(row, insideAssets)) {
          rows.add(row)
        }
      }
    }

    rows.sortWith(
      compareByDescending<DocumentRow> { it.isDirectory }
        .thenBy { it.name.lowercase(Locale.ROOT) },
    )

    val nodes = JSArray()
    rows.take(MAX_ENTRIES_PER_FOLDER).forEach { row ->
      nodes.put(buildTreeNode(row, depth, maxDepth, openRootFolders, insideAssets))
    }
    return nodes
  }

  private fun writeImageBytesToAssets(
    currentFileUri: Uri,
    bytes: ByteArray,
    baseName: String,
    extension: String,
    mimeType: String,
  ): String {
    if (bytes.isEmpty()) {
      throw IllegalArgumentException("selected image is empty")
    }

    val currentDocumentId = documentIdForTreeDocument(currentFileUri)
    val parentDocumentId =
      currentDocumentId.substringBeforeLast('/', missingDelimiterValue = "")
        .ifBlank { throw IllegalArgumentException("Current document does not have a writable parent folder. Open a folder workspace first.") }
    val parentUri = DocumentsContract.buildDocumentUriUsingTree(currentFileUri, parentDocumentId)
    val assetsUri = findOrCreateAssetsDirectory(parentUri)
    val fileName = uniqueChildName(assetsUri, baseName, extension)
    val targetUri =
      DocumentsContract.createDocument(activity.contentResolver, assetsUri, mimeType, fileName)
        ?: throw IllegalStateException("Failed to create image asset")

    activity.contentResolver.openOutputStream(targetUri, "w")?.use { output ->
      output.write(bytes)
    } ?: throw IllegalStateException("Failed to write image asset")

    return "./.assets/$fileName"
  }

  private fun findOrCreateAssetsDirectory(parentUri: Uri): Uri {
    findChild(parentUri, ".assets", DocumentsContract.Document.MIME_TYPE_DIR)?.let { return it.uri }
    return DocumentsContract.createDocument(
      activity.contentResolver,
      parentUri,
      DocumentsContract.Document.MIME_TYPE_DIR,
      ".assets",
    ) ?: throw IllegalStateException("Failed to create .assets folder")
  }

  private fun uniqueChildName(folderUri: Uri, baseName: String, extension: String): String {
    val existingNames = childNames(folderUri)
    val safeBaseName = baseName.ifBlank { "image" }
    val normalizedExtension = extension.trim().lowercase(Locale.ROOT).ifBlank { "png" }
    val first = "$safeBaseName.$normalizedExtension"
    if (!existingNames.contains(first)) return first

    var suffix = 2
    while (suffix < 10_000) {
      val candidate = "$safeBaseName-$suffix.$normalizedExtension"
      if (!existingNames.contains(candidate)) return candidate
      suffix += 1
    }

    throw IllegalStateException("Failed to choose a unique image asset name")
  }

  private fun findChild(folderUri: Uri, name: String, mimeType: String? = null): DocumentRow? {
    val folderDocumentId = documentIdFor(folderUri)
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(folderUri, folderDocumentId)
    val projection =
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
      )
    activity.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
      val documentIdColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val nameColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val mimeColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE)
      val modifiedColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)

      while (cursor.moveToNext()) {
        val childName = cursor.getStringOrNull(nameColumn) ?: continue
        val childMimeType = cursor.getStringOrNull(mimeColumn) ?: ""
        if (childName != name || (mimeType != null && childMimeType != mimeType)) continue

        val documentId = cursor.getStringOrNull(documentIdColumn) ?: continue
        val modifiedAt = cursor.getLongOrNull(modifiedColumn) ?: 0L
        val documentUri = DocumentsContract.buildDocumentUriUsingTree(folderUri, documentId)
        return DocumentRow(documentId, childName, childMimeType, modifiedAt, documentUri)
      }
    }
    return null
  }

  private fun childNames(folderUri: Uri): Set<String> {
    val folderDocumentId = documentIdFor(folderUri)
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(folderUri, folderDocumentId)
    val names = mutableSetOf<String>()
    activity.contentResolver.query(
      childrenUri,
      arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME),
      null,
      null,
      null,
    )?.use { cursor ->
      val nameColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      while (cursor.moveToNext()) {
        cursor.getStringOrNull(nameColumn)?.let(names::add)
      }
    }
    return names
  }

  private fun buildTreeNode(
    row: DocumentRow,
    depth: Int,
    maxDepth: Int,
    openRootFolders: Boolean,
    insideAssets: Boolean,
  ): JSObject {
    val node = JSObject()
    node.put("id", row.uri.toString())
    node.put("name", row.name)
    node.put("path", row.uri.toString())
    if (row.modifiedAt > 0) {
      node.put("modifiedAt", row.modifiedAt)
    }

    if (!row.isDirectory) {
      node.put("type", "file")
      return node
    }

    val isOpen = openRootFolders && depth == 0
    val isLoaded = depth < maxDepth
    val childInsideAssets = insideAssets || row.name == ".assets"
    node.put("type", "folder")
    node.put("isOpen", isOpen)
    node.put("isLoaded", isLoaded)
    node.put(
      "children",
      if (isLoaded) readChildren(row.uri, depth + 1, maxDepth, openRootFolders, childInsideAssets) else JSArray(),
    )
    return node
  }

  private fun shouldInclude(row: DocumentRow, insideAssets: Boolean): Boolean {
    val normalizedName = row.name.lowercase(Locale.ROOT)
    val isAssetsDir = row.isDirectory && row.name == ".assets"
    if (
      ignoredNames.contains(row.name) ||
        (row.name.startsWith(".") && !isKnownTextDocumentName(normalizedName) && !isAssetsDir)
    ) {
      return false
    }

    if (row.isDirectory) return true

    val extension = normalizedName.substringAfterLast('.', "")
    return isKnownTextDocumentName(normalizedName) ||
      (insideAssets && supportedImageExtensions.contains(extension))
  }

  private fun isKnownTextDocumentName(normalizedName: String): Boolean {
    if (textDocumentNames.contains(normalizedName)) return true
    val extension = normalizedName.substringAfterLast('.', "")
    return textDocumentExtensions.contains(extension)
  }

  private fun documentIdFor(uri: Uri): String {
    return if (uri.path.orEmpty().contains("/document/")) {
      DocumentsContract.getDocumentId(uri)
    } else {
      DocumentsContract.getTreeDocumentId(uri)
    }
  }

  private fun documentIdForTreeDocument(uri: Uri): String {
    if (!uri.path.orEmpty().contains("/tree/") || !uri.path.orEmpty().contains("/document/")) {
      throw IllegalArgumentException("Current document is not inside an opened Android folder workspace.")
    }
    return DocumentsContract.getDocumentId(uri)
  }

  private fun imageMimeType(uri: Uri, fileName: String?): String {
    val detected = activity.contentResolver.getType(uri)
    return normalizedImageMimeType(detected, fileName)
  }

  private fun normalizedImageMimeType(mimeType: String?, fileName: String?): String {
    val normalizedMime = mimeType?.substringBefore(';')?.trim()?.lowercase(Locale.ROOT).orEmpty()
    if (supportedImageMimeTypes.contains(normalizedMime)) return normalizedMime

    val extension = fileName?.substringAfterLast('.', "")?.lowercase(Locale.ROOT).orEmpty()
    return imageMimeTypeFromExtension(extension)
  }

  private fun imageExtension(fileName: String?, mimeType: String): String {
    val fromName = fileName?.substringAfterLast('.', "")?.lowercase(Locale.ROOT).orEmpty()
    if (supportedImageExtensions.contains(fromName)) return if (fromName == "jpeg") "jpg" else fromName

    val fromMime = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)?.lowercase(Locale.ROOT)
    if (fromMime != null && supportedImageExtensions.contains(fromMime)) {
      return if (fromMime == "jpeg") "jpg" else fromMime
    }

    return when (mimeType) {
      "image/jpeg" -> "jpg"
      "image/png" -> "png"
      "image/gif" -> "gif"
      "image/webp" -> "webp"
      "image/svg+xml" -> "svg"
      "image/bmp" -> "bmp"
      "image/x-icon", "image/vnd.microsoft.icon" -> "ico"
      "image/avif" -> "avif"
      else -> throw IllegalArgumentException("selected file is not a supported image")
    }
  }

  private fun imageMimeTypeFromExtension(extension: String): String {
    return when (extension) {
      "jpg", "jpeg" -> "image/jpeg"
      "png" -> "image/png"
      "gif" -> "image/gif"
      "webp" -> "image/webp"
      "svg" -> "image/svg+xml"
      "bmp" -> "image/bmp"
      "ico" -> "image/x-icon"
      "avif" -> "image/avif"
      else -> throw IllegalArgumentException("selected file is not a supported image")
    }
  }

  private fun imageBaseName(fileName: String?, fallback: String): String {
    val rawName = fileName?.substringBeforeLast('.', fileName)?.ifBlank { fallback } ?: fallback
    return rawName
      .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "-")
      .trim()
      .take(80)
      .ifBlank { fallback }
  }

  private fun folderDisplayName(uri: Uri): String {
    val documentId =
      try {
        documentIdFor(uri)
      } catch (_: Exception) {
        ""
      }
    val documentUri =
      try {
        DocumentsContract.buildDocumentUriUsingTree(uri, documentId)
      } catch (_: Exception) {
        uri
      }
    return displayName(documentUri.toString()) ?: displayNameFromDocumentId(documentId)
  }

  private fun displayNameFromDocumentId(documentId: String): String {
    val withoutVolume = documentId.substringAfter("primary:", documentId)
    val leaf = withoutVolume.substringAfterLast('/').ifBlank { withoutVolume }
    return when {
      leaf == "Download" -> "Downloads"
      leaf.isNotBlank() -> leaf
      else -> "Workspace"
    }
  }

  private fun displayName(uriValue: String): String? {
    val uri = Uri.parse(uriValue)
    val projection = arrayOf(OpenableColumns.DISPLAY_NAME)
    try {
      activity.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (index >= 0) {
            val name = cursor.getString(index)
            if (!name.isNullOrBlank()) return name
          }
        }
      }
    } catch (_: Exception) {
      return uri.lastPathSegment
    }
    return uri.lastPathSegment
  }

  private fun android.database.Cursor.getStringOrNull(column: Int): String? {
    if (column < 0 || isNull(column)) return null
    return getString(column)
  }

  private fun android.database.Cursor.getLongOrNull(column: Int): Long? {
    if (column < 0 || isNull(column)) return null
    return getLong(column)
  }

  companion object {
    private const val MAX_ENTRIES_PER_FOLDER = 80

    private val ignoredNames =
      setOf(
        ".git",
        "node_modules",
        "dist",
        "build",
        "target",
        "src-tauri",
        "Library",
        "Applications",
        "Movies",
        "Music",
        "Pictures",
      )

    private val textDocumentExtensions =
      setOf(
        "md",
        "markdown",
        "mdown",
        "mkd",
        "txt",
        "log",
        "html",
        "htm",
        "json",
        "yml",
        "yaml",
        "toml",
        "env",
        "css",
        "js",
        "jsx",
        "ts",
        "tsx",
        "xml",
        "csv",
        "tsv",
        "ini",
        "conf",
        "config",
        "sql",
        "sh",
        "bash",
        "zsh",
        "fish",
        "py",
        "rs",
        "go",
        "java",
        "c",
        "h",
        "cpp",
        "hpp",
        "cs",
        "rb",
        "php",
        "swift",
        "kt",
        "kts",
      )

    private val textDocumentNames =
      setOf(
        ".env",
        ".env.local",
        ".env.development",
        ".env.production",
        ".gitignore",
        ".gitattributes",
        ".npmrc",
        ".nvmrc",
        "dockerfile",
        "makefile",
        "readme",
        "license",
        "changelog",
      )

    private val supportedImageExtensions =
      setOf("png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif")

    private val supportedImageMimeTypes =
      setOf(
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "image/bmp",
        "image/x-icon",
        "image/vnd.microsoft.icon",
        "image/avif",
      )
  }
}
