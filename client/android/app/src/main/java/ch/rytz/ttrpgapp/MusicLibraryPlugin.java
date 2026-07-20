package ch.rytz.ttrpgapp;

import android.Manifest;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Lists the device's audio library via MediaStore. Returns real file paths;
 * on Android 11+ direct path reads of shared media are allowed while holding
 * the audio read permission, so the WebView can stream them via
 * Capacitor.convertFileSrc.
 */
@CapacitorPlugin(
    name = "MusicLibrary",
    permissions = {
      @Permission(strings = {Manifest.permission.READ_MEDIA_AUDIO}, alias = "audio13"),
      @Permission(strings = {Manifest.permission.READ_EXTERNAL_STORAGE}, alias = "audioLegacy")
    })
public class MusicLibraryPlugin extends Plugin {

  private String permissionAlias() {
    return Build.VERSION.SDK_INT >= 33 ? "audio13" : "audioLegacy";
  }

  @PluginMethod
  public void list(PluginCall call) {
    if (getPermissionState(permissionAlias()) != PermissionState.GRANTED) {
      requestPermissionForAlias(permissionAlias(), call, "permissionCallback");
      return;
    }
    doList(call);
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    if (getPermissionState(permissionAlias()) == PermissionState.GRANTED) {
      doList(call);
    } else {
      call.reject("Audio permission denied");
    }
  }

  private void doList(PluginCall call) {
    JSArray tracks = new JSArray();
    ContentResolver resolver = getContext().getContentResolver();
    Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
    String[] projection = {
      MediaStore.Audio.Media.DATA,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.DURATION
    };
    String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
    try (Cursor cursor =
        resolver.query(collection, projection, selection, null, MediaStore.Audio.Media.TITLE)) {
      if (cursor != null) {
        int pathCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
        int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
        int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
        int durCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
        while (cursor.moveToNext()) {
          JSObject t = new JSObject();
          t.put("path", cursor.getString(pathCol));
          t.put("title", cursor.getString(titleCol));
          String artist = cursor.getString(artistCol);
          t.put("artist", "<unknown>".equals(artist) ? null : artist);
          t.put("durationSec", cursor.getLong(durCol) / 1000.0);
          tracks.put(t);
        }
      }
    }
    JSObject result = new JSObject();
    result.put("tracks", tracks);
    call.resolve(result);
  }
}
