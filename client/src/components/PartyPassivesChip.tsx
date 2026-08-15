import { useEffect, useState } from 'react';
import { backend } from '../backend';
import BottomSheet from './BottomSheet';

interface PartyMember {
  id: string;
  name: string;
  maxHp: number;
  ac: number | null;
  initiativeBonus: number;
  passivePerception: number | null;
}

export default function PartyPassivesChip() {
  const [party, setParty] = useState<PartyMember[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadParty = () => {
    void backend()
      .kvGet('dnd5e', 'party')
      .then((raw) => {
        if (!raw) {
          setParty([]);
          return;
        }
        try {
          const parsed = JSON.parse(raw) as PartyMember[];
          setParty(Array.isArray(parsed) ? parsed : []);
        } catch {
          setParty([]);
        }
      });
  };

  useEffect(() => {
    loadParty();
    const onLocalChange = () => loadParty();
    window.addEventListener('ttrpg-local-changed', onLocalChange);
    window.addEventListener('ttrpg-sync-updated', onLocalChange);
    return () => {
      window.removeEventListener('ttrpg-local-changed', onLocalChange);
      window.removeEventListener('ttrpg-sync-updated', onLocalChange);
    };
  }, []);

  if (party.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="chip"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => setIsOpen(true)}
        title="View party passive stats"
      >
        <span>🛡️</span>
        <span>Passives</span>
      </button>

      {isOpen && (
        <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Party Passives">
          <div style={{ overflowX: 'auto', padding: '8px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Character</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Passive Perc.</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>AC</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Init Mod</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Max HP</th>
                </tr>
              </thead>
              <tbody>
                {party.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.name || 'Unnamed'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '15px' }}>
                      {m.passivePerception !== null ? `👁️ ${m.passivePerception}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '15px' }}>
                      {m.ac !== null ? `🛡️ ${m.ac}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '15px' }}>
                      {m.initiativeBonus >= 0 ? `+${m.initiativeBonus}` : m.initiativeBonus}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '15px' }}>
                      ❤️ {m.maxHp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
