# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable

# Preserve Capacitor core plugins, callbacks, and reflection
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.CapacitorPlugin public *;
    @com.getcapacitor.annotation.ActivityCallback public *;
    @com.getcapacitor.annotation.PermissionCallback public *;
}

-keep public class * extends com.getcapacitor.Plugin {
    public *;
}

-keep public class com.getcapacitor.** { *; }

# Preserve custom MusicLibraryPlugin
-keep public class ch.rytz.ttrpgapp.** { *; }

# Preserve WebView JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve AppAuth & OAuth
-keep class net.openid.appauth.** { *; }
-keep class com.byteowls.capacitor.oauth2.** { *; }

# Preserve OkHttp & Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

