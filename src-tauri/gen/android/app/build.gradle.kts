import java.util.Properties
import org.gradle.api.GradleException

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

val signingProperties = Properties().apply {
    val propFile = listOf(file("keystore.properties"), file("key.properties")).firstOrNull { it.exists() }
    if (propFile != null) {
        propFile.inputStream().use { load(it) }
    }
}

data class SaekimReleaseSigning(
    val storeFilePath: String,
    val storePassword: String,
    val keyAlias: String,
    val keyPassword: String,
)

fun saekimSigningValue(envName: String, propertyName: String): String? =
    System.getenv(envName)?.takeIf { it.isNotBlank() }
        ?: signingProperties.getProperty(propertyName)?.takeIf { it.isNotBlank() }

fun saekimReleaseSigningFromLocalConfig(): SaekimReleaseSigning? {
    val storeFilePath = saekimSigningValue("SAEKIM_ANDROID_KEYSTORE", "storeFile") ?: return null
    val storePassword = saekimSigningValue("SAEKIM_ANDROID_KEYSTORE_PASSWORD", "storePassword") ?: return null
    val keyAlias = saekimSigningValue("SAEKIM_ANDROID_KEY_ALIAS", "keyAlias") ?: return null
    val keyPassword = saekimSigningValue("SAEKIM_ANDROID_KEY_PASSWORD", "keyPassword") ?: return null

    return SaekimReleaseSigning(storeFilePath, storePassword, keyAlias, keyPassword)
}

val saekimReleaseSigning = saekimReleaseSigningFromLocalConfig()

gradle.taskGraph.whenReady {
    val isReleaseBuild = allTasks.any { task ->
        task.name.contains("Release") && !task.name.contains("UnitTest")
    }

    if (isReleaseBuild && saekimReleaseSigning == null) {
        throw GradleException(
            "Release signing is not configured. Set SAEKIM_ANDROID_KEYSTORE, " +
                "SAEKIM_ANDROID_KEYSTORE_PASSWORD, SAEKIM_ANDROID_KEY_ALIAS, and " +
                "SAEKIM_ANDROID_KEY_PASSWORD, or create src-tauri/gen/android/app/keystore.properties " +
                "or key.properties with storeFile, storePassword, keyAlias, and keyPassword."
        )
    }
}

android {
    compileSdk = 36
    namespace = "com.beeean17.saekim"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.beeean17.saekim"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }
    signingConfigs {
        create("release") {
            saekimReleaseSigning?.let { signing ->
                storeFile = file(signing.storeFilePath)
                storePassword = signing.storePassword
                keyAlias = signing.keyAlias
                keyPassword = signing.keyPassword
            }
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            if (saekimReleaseSigning != null) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
