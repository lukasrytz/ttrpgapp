import { useEffect, useState } from 'react';
import {
  computeTotalElapsed,
  formatClock,
  getClockState,
  pauseClock,
  resetClock,
  startClock,
  type SessionClockState,
} from '../session/clock';
import { wrapSession } from '../session/wrapSession';
import { showToast } from '../toast';
import BottomSheet from './BottomSheet';

export default function SessionClockPill() {
  const [clock, setClock] = useState<SessionClockState>(() => getClockState());
  const [now, setNow] = useState<number>(Date.now());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWrapping, setIsWrapping] = useState(false);

  useEffect(() => {
    const onClockChange = (e: Event) => {
      const state = (e as CustomEvent<SessionClockState>).detail;
      if (state) setClock(state);
      else setClock(getClockState());
    };
    window.addEventListener('ttrpg-clock-changed', onClockChange);
    return () => window.removeEventListener('ttrpg-clock-changed', onClockChange);
  }, []);

  useEffect(() => {
    if (!clock.isRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clock.isRunning]);

  const totalSeconds = computeTotalElapsed(clock);
  const isOverdue = totalSeconds >= clock.targetMinutes * 60 && clock.targetMinutes > 0;
  const timeFormatted = formatClock(totalSeconds);

  const handleWrap = async () => {
    if (!window.confirm('Wrap session? This will append a summary to the active session note and reset the clock.')) {
      return;
    }
    setIsWrapping(true);
    try {
      const res = await wrapSession();
      showToast(`Session wrapped into ${res.path}`, '🏁');
      setIsMenuOpen(false);
    } catch {
      showToast('Failed to wrap session', '⚠️');
    } finally {
      setIsWrapping(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`session-clock-pill ${clock.isRunning ? 'running' : 'paused'} ${isOverdue ? 'overdue' : ''}`}
        onClick={() => setIsMenuOpen(true)}
        title={`Session Clock: ${timeFormatted}${isOverdue ? ' (Over target)' : ''}`}
      >
        <span className="clock-icon">{clock.isRunning ? '⏱️' : '⏸️'}</span>
        <span className="clock-time">{timeFormatted}</span>
      </button>

      {isMenuOpen && (
        <BottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="Session Clock">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: isOverdue ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {timeFormatted}
              </div>
              <div className="small muted" style={{ marginTop: '4px' }}>
                Target: {formatClock(clock.targetMinutes * 60)} {isOverdue && '· Over target time'}
              </div>
              <div className="small muted" style={{ marginTop: '4px' }}>
                Combat: {clock.combatsCount} {clock.combatsCount === 1 ? 'encounter' : 'encounters'} ({clock.combatRounds} rounds)
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {clock.isRunning ? (
                <button type="button" className="secondary" onClick={() => pauseClock()}>
                  ⏸ Pause
                </button>
              ) : (
                <button type="button" className="primary" onClick={() => startClock()}>
                  ▶ Start
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (window.confirm('Reset session clock?')) {
                    resetClock();
                  }
                }}
              >
                ↺ Reset
              </button>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                className="primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={isWrapping}
                onClick={handleWrap}
              >
                {isWrapping ? 'Wrapping…' : '🏁 Wrap Session & Save Summary'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
