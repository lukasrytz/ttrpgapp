package ch.rytz.ttrpgapp;

import android.content.Context;

import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;

import java.util.List;

/**
 * Cast SDK configuration, wired via the OPTIONS_PROVIDER_CLASS_NAME meta-data
 * in AndroidManifest.xml.
 *
 * The receiver application ID comes from the `cast_app_id` string resource,
 * which defaults to Google's Default Media Receiver. Swapping in our own
 * crossfading receiver later is a one-line resource change.
 */
public class CastOptionsProvider implements OptionsProvider {

  @Override
  public CastOptions getCastOptions(Context context) {
    return new CastOptions.Builder()
        .setReceiverApplicationId(context.getString(R.string.cast_app_id))
        // We drive playback from the app; no need to resume a session we didn't start.
        .setResumeSavedSession(false)
        .setEnableReconnectionService(true)
        .build();
  }

  @Override
  public List<SessionProvider> getAdditionalSessionProviders(Context context) {
    return null;
  }
}
