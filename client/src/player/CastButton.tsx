import { useEffect, useState } from 'react';
import { backend } from '../backend';
import { castManager } from '../cast/manager';
import type { CastDevice, CastState } from '../cast/types';

/**
 * Cast control for the player bar: picks a receiver, then shows what we're
 * playing on. Hidden entirely when casting isn't available (web build, no Play
 * Services), so it costs nothing where it can't work.
 */
export default function CastButton() {
  const [state, setState] = useState<CastState>(castManager.state);
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onStatus = (e: Event) => setState((e as CustomEvent<CastState>).detail);
    window.addEventListener('ttrpg-cast-status', onStatus);
    return () => window.removeEventListener('ttrpg-cast-status', onStatus);
  }, []);

  if (!castManager.isAvailable()) return null;

  const openPicker = async () => {
    setError(null);
    setOpen(true);
    setBusy(true);
    try {
      setDevices(await castManager.listDevices());
    } finally {
      setBusy(false);
    }
  };

  const connect = async (device: CastDevice) => {
    setBusy(true);
    setError(null);
    try {
      // The allow-list: every track the app can currently see. Only these files
      // are servable for the life of the session.
      const paths = (await backend().listTracks()).map((t) => t.path);
      await castManager.connect(device, paths);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await castManager.disconnect();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const casting = state.status === 'connected';

  return (
    <>
      <button
        className={casting ? 'primary' : ''}
        title={casting ? `Playing on ${state.device?.name}` : 'Cast to a speaker'}
        aria-label="Cast"
        onClick={() => (open ? setOpen(false) : void openPicker())}
      >
        {casting ? '📶' : '🔈'}
      </button>

      {open && (
        <div className="cast-picker" role="dialog" aria-label="Cast to">
          <div className="cast-picker-head">
            <strong>Cast to</strong>
            <button className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          {busy && <p className="muted small">Working…</p>}

          {!busy && casting && (
            <>
              <p className="muted small">Playing on {state.device?.name}</p>
              <button onClick={() => void disconnect()}>Stop casting</button>
            </>
          )}

          {!busy && !casting && (
            <>
              {devices.length === 0 ? (
                <p className="muted small">
                  No cast devices found. They must be on the same Wi-Fi network as this device.
                </p>
              ) : (
                devices.map((d) => (
                  <button key={d.id} className="note-item" onClick={() => void connect(d)}>
                    {d.name}
                  </button>
                ))
              )}
            </>
          )}

          {error && <p className="hp-low small">{error}</p>}
        </div>
      )}
    </>
  );
}
