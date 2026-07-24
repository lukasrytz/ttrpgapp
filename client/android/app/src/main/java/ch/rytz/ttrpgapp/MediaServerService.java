package ch.rytz.ttrpgapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Keeps the LAN media server alive for the length of a session.
 *
 * A table session is hours of music with the screen off; without a foreground
 * service Android would kill the process (or doze the Wi-Fi radio) and the
 * Chromecast would stop mid-track. This holds a WifiLock and shows the
 * persistent notification that makes the app's network use visible to the user.
 *
 * The HTTP server itself lives in MediaServerPlugin (same process), so no
 * track list crosses an Intent — a large library would blow the Binder
 * transaction limit.
 */
public class MediaServerService extends Service {

  private static final String CHANNEL_ID = "ttrpg_cast";
  private static final int NOTIFICATION_ID = 1;

  private WifiManager.WifiLock wifiLock;

  @Override
  public void onCreate() {
    super.onCreate();
    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    if (wm != null) {
      wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "ttrpgapp:cast");
      wifiLock.setReferenceCounted(false);
      wifiLock.acquire();
    }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    createChannel();

    Intent open = new Intent(this, MainActivity.class);
    PendingIntent pi =
        PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

    // NotificationCompat/ServiceCompat so this still works on minSdk 24, where
    // channels and typed startForeground don't exist yet.
    Notification notification =
        new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Casting music")
            .setContentText("Serving your library to the cast device")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

    ServiceCompat.startForeground(
        this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    // Don't auto-restart with a null intent: the server it fronts is gone.
    return START_NOT_STICKY;
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
    NotificationChannel channel =
        new NotificationChannel(CHANNEL_ID, "Casting", NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Shown while music is being served to a cast device");
    nm.createNotificationChannel(channel);
  }

  @Override
  public void onDestroy() {
    if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
