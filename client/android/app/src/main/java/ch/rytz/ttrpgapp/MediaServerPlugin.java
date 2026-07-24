package ch.rytz.ttrpgapp;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * Starts/stops the on-device LAN media server used for casting.
 *
 * start() takes the allow-list of file paths the session may serve and returns
 * a token-scoped base URL; the JS side addresses tracks by index into that same
 * list (see client/src/cast/types.ts castUrlFor).
 */
@CapacitorPlugin(name = "MediaServer")
public class MediaServerPlugin extends Plugin {

  private static final String TAG = "MediaServerPlugin";

  private MediaHttpServer server;

  @PluginMethod
  public void start(PluginCall call) {
    JSArray paths = call.getArray("paths");
    if (paths == null) {
      call.reject("paths is required");
      return;
    }

    List<String> allowList = new ArrayList<>();
    try {
      for (Object p : paths.toList()) {
        if (p instanceof String) allowList.add((String) p);
      }
    } catch (org.json.JSONException e) {
      call.reject("paths must be an array of strings", e);
      return;
    }
    if (allowList.isEmpty()) {
      call.reject("paths is empty — nothing would be servable");
      return;
    }

    stopServer();
    try {
      MediaHttpServer s = new MediaHttpServer(allowList);
      // Daemon threads so the server never keeps the process alive on its own.
      s.start(NanoHTTPDTimeouts.SOCKET_READ_TIMEOUT_MS, true);
      String baseUrl = s.baseUrl();
      if (baseUrl == null) {
        s.stop();
        call.reject("No LAN address — connect this device to Wi-Fi to cast");
        return;
      }
      server = s;
      startService();

      JSObject result = new JSObject();
      result.put("baseUrl", baseUrl);
      call.resolve(result);
    } catch (Exception e) {
      Log.e(TAG, "failed to start media server", e);
      call.reject("Could not start the media server: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    stopServer();
    stopService();
    call.resolve();
  }

  private void startService() {
    Intent intent = new Intent(getContext(), MediaServerService.class);
    // startForegroundService is API 26+; minSdk here is 24.
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      getContext().startForegroundService(intent);
    } else {
      getContext().startService(intent);
    }
  }

  private void stopService() {
    getContext().stopService(new Intent(getContext(), MediaServerService.class));
  }

  private void stopServer() {
    if (server != null) {
      server.stop();
      server = null;
    }
  }

  @Override
  protected void handleOnDestroy() {
    // Never leave an HTTP server listening on the LAN after the app goes away.
    stopServer();
    stopService();
    super.handleOnDestroy();
  }

  /** Named for clarity at the call site. */
  private static final class NanoHTTPDTimeouts {
    static final int SOCKET_READ_TIMEOUT_MS = 15000;
  }
}
