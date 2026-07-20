/**
 * Pure converters from 5e-bits/5e-database JSON shapes to CompendiumEntry.
 * Kept free of I/O so they can be unit-tested.
 */
import type { CompendiumEntry } from '@ttrpgapp/shared';

export const SOURCE = 'SRD 5.1 (CC-BY-4.0)';

const ORDINALS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

export interface Named {
  index: string;
  name: string;
  desc?: string[] | string;
}

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function crStr(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}

export type Spell = Named & {
  desc: string[];
  higher_level?: string[];
  range: string;
  components: string[];
  material?: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  casting_time: string;
  level: number;
  school: { name: string };
  classes: { name: string }[];
};

export function convertSpells(spells: Spell[]): CompendiumEntry[] {
  return spells.map((s) => {
    const levelStr =
      s.level === 0 ? `${s.school.name} cantrip` : `${ORDINALS[s.level]}-level ${s.school.name.toLowerCase()}`;
    const lines = [
      `*${levelStr}${s.ritual ? ' (ritual)' : ''}*`,
      '',
      `**Casting time:** ${s.casting_time} · **Range:** ${s.range}`,
      `**Components:** ${s.components.join(', ')}${s.material ? ` (${s.material})` : ''}`,
      `**Duration:** ${s.concentration ? 'Concentration, ' : ''}${s.duration}`,
      '',
      ...s.desc,
    ];
    if (s.higher_level?.length) lines.push('', `**At higher levels.** ${s.higher_level.join(' ')}`);
    if (s.classes.length) lines.push('', `*Classes: ${s.classes.map((c) => c.name).join(', ')}*`);
    return {
      id: `spell:${s.index}`,
      type: 'spell',
      name: s.name,
      body: lines.join('\n'),
      fields: { level: s.level, school: s.school.name, concentration: s.concentration },
      source: SOURCE,
    };
  });
}

export type Monster = Named & {
  size: string;
  type: string;
  subtype?: string;
  alignment: string;
  armor_class: { type: string; value: number }[];
  hit_points: number;
  hit_points_roll?: string;
  speed: Record<string, string | boolean>;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiencies: { value: number; proficiency: { name: string } }[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: { name: string }[];
  senses: Record<string, string | number>;
  languages: string;
  challenge_rating: number;
  xp: number;
  special_abilities?: { name: string; desc: string }[];
  actions?: { name: string; desc: string }[];
  legendary_actions?: { name: string; desc: string }[];
  reactions?: { name: string; desc: string }[];
};

export function convertMonsters(monsters: Monster[]): CompendiumEntry[] {
  return monsters.map((m) => {
    const ac = m.armor_class[0];
    const speed = Object.entries(m.speed)
      .map(([k, v]) => (k === 'walk' ? String(v) : `${k} ${v}`))
      .join(', ');
    const senses = Object.entries(m.senses)
      .map(([k, v]) => `${k.replaceAll('_', ' ')} ${v}`)
      .join(', ');
    const lines = [
      `*${m.size} ${m.type}${m.subtype ? ` (${m.subtype})` : ''}, ${m.alignment}*`,
      '',
      `**AC** ${ac?.value ?? '—'}${ac && ac.type !== 'dex' ? ` (${ac.type})` : ''} · **HP** ${m.hit_points}${m.hit_points_roll ? ` (${m.hit_points_roll})` : ''} · **Speed** ${speed}`,
      '',
      `| STR | DEX | CON | INT | WIS | CHA |`,
      `| --- | --- | --- | --- | --- | --- |`,
      `| ${m.strength} (${mod(m.strength)}) | ${m.dexterity} (${mod(m.dexterity)}) | ${m.constitution} (${mod(m.constitution)}) | ${m.intelligence} (${mod(m.intelligence)}) | ${m.wisdom} (${mod(m.wisdom)}) | ${m.charisma} (${mod(m.charisma)}) |`,
      '',
    ];
    if (m.proficiencies.length)
      lines.push(
        `**Proficiencies:** ${m.proficiencies.map((p) => `${p.proficiency.name.replace(/^(Skill|Saving Throw): /, '')} +${p.value}`).join(', ')}`,
      );
    if (m.damage_vulnerabilities.length)
      lines.push(`**Vulnerabilities:** ${m.damage_vulnerabilities.join(', ')}`);
    if (m.damage_resistances.length) lines.push(`**Resistances:** ${m.damage_resistances.join(', ')}`);
    if (m.damage_immunities.length) lines.push(`**Damage immunities:** ${m.damage_immunities.join(', ')}`);
    if (m.condition_immunities.length)
      lines.push(`**Condition immunities:** ${m.condition_immunities.map((c) => c.name).join(', ')}`);
    lines.push(`**Senses:** ${senses}`, `**Languages:** ${m.languages || '—'}`);
    lines.push(`**Challenge:** ${crStr(m.challenge_rating)} (${m.xp} XP)`);

    const section = (title: string, items?: { name: string; desc: string }[]) => {
      if (!items?.length) return;
      lines.push('', `### ${title}`, '');
      for (const a of items) lines.push(`**${a.name}.** ${a.desc}`, '');
    };
    section('Special abilities', m.special_abilities);
    section('Actions', m.actions);
    section('Reactions', m.reactions);
    section('Legendary actions', m.legendary_actions);

    return {
      id: `monster:${m.index}`,
      type: 'monster',
      name: m.name,
      body: lines.join('\n'),
      fields: {
        hp: m.hit_points,
        ac: ac?.value ?? 10,
        dexMod: Math.floor((m.dexterity - 10) / 2),
        cr: m.challenge_rating,
        size: m.size,
        monsterType: m.type,
      },
      source: SOURCE,
    };
  });
}

export function convertSimple(type: string, items: Named[]): CompendiumEntry[] {
  return items.map((i) => ({
    id: `${type}:${i.index}`,
    type,
    name: i.name,
    body: Array.isArray(i.desc) ? i.desc.join('\n\n') : (i.desc ?? ''),
    source: SOURCE,
  }));
}

export type Equipment = Named & {
  equipment_category?: { name: string };
  cost?: { quantity: number; unit: string };
  weight?: number;
  damage?: { damage_dice: string; damage_type: { name: string } };
  armor_class?: { base: number; dex_bonus: boolean; max_bonus?: number };
  properties?: { name: string }[];
};

export function convertEquipment(items: Equipment[]): CompendiumEntry[] {
  return items.map((e) => {
    const lines: string[] = [];
    if (e.equipment_category) lines.push(`*${e.equipment_category.name}*`, '');
    const meta: string[] = [];
    if (e.cost) meta.push(`**Cost:** ${e.cost.quantity} ${e.cost.unit}`);
    if (e.weight != null) meta.push(`**Weight:** ${e.weight} lb.`);
    if (e.damage) meta.push(`**Damage:** ${e.damage.damage_dice} ${e.damage.damage_type.name.toLowerCase()}`);
    if (e.armor_class)
      meta.push(
        `**AC:** ${e.armor_class.base}${e.armor_class.dex_bonus ? ` + Dex${e.armor_class.max_bonus ? ` (max ${e.armor_class.max_bonus})` : ''}` : ''}`,
      );
    if (e.properties?.length) meta.push(`**Properties:** ${e.properties.map((p) => p.name).join(', ')}`);
    if (meta.length) lines.push(meta.join(' · '), '');
    if (e.desc) lines.push(Array.isArray(e.desc) ? e.desc.join('\n\n') : e.desc);
    return {
      id: `equipment:${e.index}`,
      type: 'equipment',
      name: e.name,
      body: lines.join('\n'),
      source: SOURCE,
    };
  });
}

