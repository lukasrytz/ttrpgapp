package ch.rytz.ttrpgapp;

import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

/**
 * Serves the device's own audio files over the LAN so a Chromecast can fetch
 * them — a receiver pulls media from a URL, it never receives pushed audio, and
 * the WebView's Capacitor.convertFileSrc URLs are reachable only on-device.
 *
 * Two gates keep this from being an open file server on the local network:
 *   - a random per-session token that must prefix every request path, and
 *   - an allow-list: requests address tracks by INDEX into the list the server
 *     was started with, so a caller can never name an arbitrary file path.
 *
 * Byte ranges are supported because receivers issue Range requests when
 * buffering and seeking.
 */
public class MediaHttpServer extends NanoHTTPD {

  private static final String TAG = "MediaHttpServer";

  private final List<String> allowList;
  private final String token;

  public MediaHttpServer(List<String> allowList) {
    // Port 0: let the OS pick a free port; read it back with getListeningPort().
    super(0);
    this.allowList = allowList;
    this.token = randomToken();
  }

  private static String randomToken() {
    byte[] bytes = new byte[12];
    new SecureRandom().nextBytes(bytes);
    StringBuilder sb = new StringBuilder();
    for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b));
    return sb.toString();
  }

  /** Token-scoped base URL a receiver on the LAN can fetch from, or null if offline. */
  public String baseUrl() {
    String host = lanAddress();
    if (host == null) return null;
    return "http://" + host + ":" + getListeningPort() + "/" + token;
  }

  /**
   * This device's LAN IPv4. Enumerating interfaces needs no permission, unlike
   * the WifiManager route, and also covers ethernet/tethering.
   */
  private static String lanAddress() {
    try {
      for (NetworkInterface nif : Collections.list(NetworkInterface.getNetworkInterfaces())) {
        if (nif.isLoopback() || !nif.isUp()) continue;
        for (InetAddress addr : Collections.list(nif.getInetAddresses())) {
          if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
            return addr.getHostAddress();
          }
        }
      }
    } catch (Exception e) {
      Log.w(TAG, "could not determine LAN address", e);
    }
    return null;
  }

  static String mimeFor(String path) {
    String lower = path.toLowerCase(Locale.US);
    int dot = lower.lastIndexOf('.');
    String ext = dot >= 0 ? lower.substring(dot) : "";
    switch (ext) {
      case ".mp3": return "audio/mpeg";
      case ".ogg":
      case ".oga":
      case ".opus": return "audio/ogg";
      case ".flac": return "audio/flac";
      case ".m4a": return "audio/mp4";
      case ".aac": return "audio/aac";
      case ".wav": return "audio/wav";
      case ".webm": return "audio/webm";
      default: return "application/octet-stream";
    }
  }

  @Override
  public Response serve(IHTTPSession session) {
    String uri = session.getUri(); // e.g. /<token>/t/12
    String[] parts = uri.split("/");
    // ["", token, "t", index]
    if (parts.length != 4 || !token.equals(parts[1]) || !"t".equals(parts[2])) {
      return newFixedLengthResponse(Response.Status.FORBIDDEN, "text/plain", "forbidden");
    }

    int index;
    try {
      index = Integer.parseInt(parts[3]);
    } catch (NumberFormatException e) {
      return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found");
    }
    if (index < 0 || index >= allowList.size()) {
      return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found");
    }

    File file = new File(allowList.get(index));
    if (!file.isFile() || !file.canRead()) {
      return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "missing");
    }

    String mime = mimeFor(file.getName());
    long length = file.length();
    Map<String, String> headers = session.getHeaders();
    String range = headers != null ? headers.get("range") : null;

    try {
      if (range != null && range.startsWith("bytes=")) {
        long[] bounds = parseRange(range.substring("bytes=".length()), length);
        if (bounds == null) {
          Response r = newFixedLengthResponse(
              Response.Status.RANGE_NOT_SATISFIABLE, "text/plain", "bad range");
          r.addHeader("Content-Range", "bytes */" + length);
          return r;
        }
        long start = bounds[0];
        long end = bounds[1];
        long count = end - start + 1;

        InputStream in = new FileInputStream(file);
        long skipped = 0;
        while (skipped < start) {
          long n = in.skip(start - skipped);
          if (n <= 0) break;
          skipped += n;
        }
        Response r =
            newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, mime, in, count);
        r.addHeader("Accept-Ranges", "bytes");
        r.addHeader("Content-Range", "bytes " + start + "-" + end + "/" + length);
        return r;
      }

      Response r = newFixedLengthResponse(Response.Status.OK, mime, new FileInputStream(file), length);
      r.addHeader("Accept-Ranges", "bytes");
      return r;
    } catch (IOException e) {
      Log.w(TAG, "failed serving " + file.getName(), e);
      return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "read error");
    }
  }

  /** Parses "start-end", "start-" or "-suffix". Returns {start, end} or null if unsatisfiable. */
  static long[] parseRange(String spec, long length) {
    int dash = spec.indexOf('-');
    if (dash < 0 || length <= 0) return null;
    String fromStr = spec.substring(0, dash).trim();
    String toStr = spec.substring(dash + 1).trim();
    try {
      long start;
      long end;
      if (fromStr.isEmpty()) {
        // suffix range: last N bytes
        long suffix = Long.parseLong(toStr);
        if (suffix <= 0) return null;
        start = Math.max(0, length - suffix);
        end = length - 1;
      } else {
        start = Long.parseLong(fromStr);
        end = toStr.isEmpty() ? length - 1 : Math.min(Long.parseLong(toStr), length - 1);
      }
      if (start < 0 || start > end || start >= length) return null;
      return new long[] {start, end};
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
