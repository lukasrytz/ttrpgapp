import type { MonsterAbility } from '../scripts/convert';
import { getPluginRuntime } from '@ttrpgapp/shared/plugin-client';
import type { Combatant } from './trackerTypes';

export interface TurnCardProps {
  combatant: Combatant;
  onToggleUsed: (abilityName: string) => void;
  onInspectAbility: (ability: MonsterAbility) => void;
}

export default function TurnCard({
  combatant,
  onToggleUsed,
  onInspectAbility,
}: TurnCardProps) {
  if (!combatant.monsterRef) return null;

  const entry = getPluginRuntime().getCompendiumEntry(
    combatant.monsterRef.packId,
    combatant.monsterRef.entryId,
  );

  const fields = entry?.fields as
    | {
        traits?: MonsterAbility[];
        actions?: MonsterAbility[];
        legendary?: MonsterAbility[];
      }
    | undefined;

  const traits = fields?.traits ?? [];
  const actions = fields?.actions ?? [];
  const legendary = fields?.legendary ?? [];
  const abilities: MonsterAbility[] = [...traits, ...actions, ...legendary];

  if (abilities.length === 0) return null;

  const usedSet = new Set(combatant.usedAbilities ?? []);

  return (
    <div className="turn-card">
      <div className="turn-card-header">
        <span className="turn-card-title">Active Actions & Abilities</span>
        <span className="turn-card-subtitle small muted">{combatant.name}</span>
      </div>
      <div className="turn-card-chips">
        {abilities.map((ability) => {
          const isLimited = Boolean(ability.recharge || ability.usesPerDay);
          const isUsed = usedSet.has(ability.name);

          let chipClass = 'turn-chip';
          if (isLimited) {
            chipClass += isUsed ? ' turn-chip-dimmed' : ' turn-chip-lit';
          }

          let badge = '';
          if (ability.recharge) {
            badge = ` ⚡ ${ability.recharge.min === 6 ? '6' : `${ability.recharge.min}-6`}`;
          } else if (ability.usesPerDay) {
            badge = ` (${ability.usesPerDay}/day)`;
          }

          return (
            <button
              key={ability.name}
              type="button"
              className={chipClass}
              onClick={() => {
                onInspectAbility(ability);
                if (isLimited && !isUsed) {
                  onToggleUsed(ability.name);
                }
              }}
            >
              <span className="turn-chip-name">{ability.name}</span>
              {badge && <span className="turn-chip-badge">{badge}</span>}
              {isLimited && (
                <span
                  className="turn-chip-toggle"
                  title={isUsed ? 'Mark unused' : 'Mark used'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleUsed(ability.name);
                  }}
                >
                  {isUsed ? ' ↺' : ' ✓'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
