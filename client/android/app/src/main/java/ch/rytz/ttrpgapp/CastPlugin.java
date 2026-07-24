package ch.rytz.ttrpgapp;

import android.util.Log;

import androidx.mediarouter.media.MediaRouteSelector;
import androidx.mediarouter.media.MediaRouter;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.MediaStatus;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;

import java.util.List;

/**
 * Google Cast transport for the music player.
 *
 * Device discovery is exposed to JS as plain data rather than using the SDK's
 * MediaRouteButton, so the picker is rendered by our own React UI and matches
 * the rest of the app instead of embedding an Android view in the WebView.
 *
 * Every Cast SDK / MediaRouter call must happen on the main thread, while
 * Capacitor dispatches plugin methods on a background thread — hence the
 * runOnUiThread marshalling throughout.
 */
@CapacitorPlugin(name = "Cast")
public class CastPlugin extends Plugin {

  private static final String TAG = "CastPlugin";

  private CastContext castContext;
  private MediaRouter mediaRouter;
  private MediaRouteSelector routeSelector;
  private RemoteMediaClient.Callback mediaCallback;
  private RemoteMediaClient.ProgressListener progressListener;
  private boolean sawPlayback = false;

  /** Keeps discovery results flowing; routes are only populated while a callback is registered. */
  private final MediaRouter.Callback discoveryCallback = new MediaRouter.Callback() {};

  @Override
  public void load() {
    getActivity()
        .runOnUiThread(
            () -> {
              try {
                castContext = CastContext.getSharedInstance(getContext());
                mediaRouter = MediaRouter.getInstance(getContext());
                routeSelector =
                    new MediaRouteSelector.Builder()
                        .addControlCategory(
                            CastMediaControlIntent.categoryForCast(
                                getContext().getString(R.string.cast_app_id)))
                        .build();
                mediaRouter.addCallback(
                    routeSelector,
                    discoveryCallback,
                    MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY);
              } catch (Exception e) {
                // Play Services missing or too old — casting simply stays unavailable.
                Log.w(TAG, "Cast unavailable", e);
                castContext = null;
              }
            });
  }

  @PluginMethod
  public void isAvailable(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              JSObject result = new JSObject();
              result.put("available", castContext != null);
              call.resolve(result);
            });
  }

  @PluginMethod
  public void listDevices(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              JSArray devices = new JSArray();
              if (mediaRouter != null && routeSelector != null) {
                List<MediaRouter.RouteInfo> routes = mediaRouter.getRoutes();
                for (MediaRouter.RouteInfo route : routes) {
                  if (route.isDefaultOrBluetooth() || !route.matchesSelector(routeSelector)) continue;
                  JSObject d = new JSObject();
                  d.put("id", route.getId());
                  d.put("name", route.getName());
                  devices.put(d);
                }
              }
              JSObject result = new JSObject();
              result.put("devices", devices);
              call.resolve(result);
            });
  }

  @PluginMethod
  public void connect(PluginCall call) {
    String deviceId = call.getString("deviceId");
    if (deviceId == null) {
      call.reject("deviceId is required");
      return;
    }
    getActivity()
        .runOnUiThread(
            () -> {
              if (mediaRouter == null) {
                call.reject("Casting is unavailable on this device");
                return;
              }
              for (MediaRouter.RouteInfo route : mediaRouter.getRoutes()) {
                if (route.getId().equals(deviceId)) {
                  // Selecting the route starts a CastSession via the SDK's SessionManager.
                  mediaRouter.selectRoute(route);
                  call.resolve();
                  return;
                }
              }
              call.reject("Cast device is no longer available");
            });
  }

  @PluginMethod
  public void disconnect(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              detachMediaCallbacks();
              if (castContext != null) {
                castContext.getSessionManager().endCurrentSession(true);
              }
              if (mediaRouter != null) {
                mediaRouter.unselect(MediaRouter.UNSELECT_REASON_DISCONNECTED);
              }
              call.resolve();
            });
  }

  /** Named loadMedia, not load, so it can't be confused with Plugin.load() above. */
  @PluginMethod
  public void loadMedia(PluginCall call) {
    String url = call.getString("url");
    String title = call.getString("title", "");
    String artist = call.getString("artist");
    if (url == null) {
      call.reject("url is required");
      return;
    }
    getActivity()
        .runOnUiThread(
            () -> {
              RemoteMediaClient client = remoteClient();
              if (client == null) {
                call.reject("No active cast session");
                return;
              }
              MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
              metadata.putString(MediaMetadata.KEY_TITLE, title);
              if (artist != null) metadata.putString(MediaMetadata.KEY_ARTIST, artist);

              MediaInfo info =
                  new MediaInfo.Builder(url)
                      .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                      .setContentType(MediaHttpServer.mimeFor(url))
                      .setMetadata(metadata)
                      .build();

              attachMediaCallbacks(client);
              sawPlayback = false;
              client.load(new MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).build());
              call.resolve();
            });
  }

  @PluginMethod
  public void play(PluginCall call) {
    withClient(call, RemoteMediaClient::play);
  }

  @PluginMethod
  public void pause(PluginCall call) {
    withClient(call, RemoteMediaClient::pause);
  }

  @PluginMethod
  public void setVolume(PluginCall call) {
    Double volume = call.getDouble("volume");
    if (volume == null) {
      call.reject("volume is required");
      return;
    }
    getActivity()
        .runOnUiThread(
            () -> {
              CastSession session = currentSession();
              if (session == null) {
                call.reject("No active cast session");
                return;
              }
              try {
                session.setVolume(Math.max(0, Math.min(1, volume)));
                call.resolve();
              } catch (Exception e) {
                call.reject("Could not set volume: " + e.getMessage(), e);
              }
            });
  }

  private interface ClientAction {
    void run(RemoteMediaClient client);
  }

  private void withClient(PluginCall call, ClientAction action) {
    getActivity()
        .runOnUiThread(
            () -> {
              RemoteMediaClient client = remoteClient();
              if (client == null) {
                call.reject("No active cast session");
                return;
              }
              action.run(client);
              call.resolve();
            });
  }

  private CastSession currentSession() {
    if (castContext == null) return null;
    return castContext.getSessionManager().getCurrentCastSession();
  }

  private RemoteMediaClient remoteClient() {
    CastSession session = currentSession();
    return session == null ? null : session.getRemoteMediaClient();
  }

  private void attachMediaCallbacks(RemoteMediaClient client) {
    detachMediaCallbacks();

    mediaCallback =
        new RemoteMediaClient.Callback() {
          @Override
          public void onStatusUpdated() {
            RemoteMediaClient c = remoteClient();
            if (c == null) return;
            int playerState = c.getPlayerState();
            // Only treat IDLE/FINISHED as "ended" after playback actually began,
            // otherwise the idle state before the first frame advances the queue.
            if (playerState == MediaStatus.PLAYER_STATE_PLAYING) sawPlayback = true;
            boolean ended =
                sawPlayback
                    && playerState == MediaStatus.PLAYER_STATE_IDLE
                    && c.getIdleReason() == MediaStatus.IDLE_REASON_FINISHED;
            emitStatus(playerState, c.getApproximateStreamPosition(), c.getStreamDuration(), ended);
            if (ended) sawPlayback = false;
          }
        };
    client.registerCallback(mediaCallback);

    progressListener =
        new RemoteMediaClient.ProgressListener() {
          @Override
          public void onProgressUpdated(long progressMs, long durationMs) {
            emitStatus(remoteState(), progressMs, durationMs, false);
          }
        };
    client.addProgressListener(progressListener, 1000);
  }

  private int remoteState() {
    RemoteMediaClient c = remoteClient();
    return c == null ? MediaStatus.PLAYER_STATE_UNKNOWN : c.getPlayerState();
  }

  private void detachMediaCallbacks() {
    RemoteMediaClient client = remoteClient();
    if (client != null) {
      if (mediaCallback != null) client.unregisterCallback(mediaCallback);
      if (progressListener != null) client.removeProgressListener(progressListener);
    }
    mediaCallback = null;
    progressListener = null;
  }

  private void emitStatus(int playerState, long positionMs, long durationMs, boolean ended) {
    JSObject status = new JSObject();
    status.put("playerState", stateName(playerState));
    status.put("position", positionMs / 1000.0);
    status.put("duration", durationMs > 0 ? durationMs / 1000.0 : 0);
    status.put("ended", ended);
    notifyListeners("status", status);
  }

  private static String stateName(int playerState) {
    switch (playerState) {
      case MediaStatus.PLAYER_STATE_PLAYING:
        return "playing";
      case MediaStatus.PLAYER_STATE_PAUSED:
        return "paused";
      case MediaStatus.PLAYER_STATE_BUFFERING:
      case MediaStatus.PLAYER_STATE_LOADING:
        return "buffering";
      default:
        return "idle";
    }
  }

  @Override
  protected void handleOnDestroy() {
    getActivity()
        .runOnUiThread(
            () -> {
              detachMediaCallbacks();
              if (mediaRouter != null) mediaRouter.removeCallback(discoveryCallback);
            });
    super.handleOnDestroy();
  }
}
