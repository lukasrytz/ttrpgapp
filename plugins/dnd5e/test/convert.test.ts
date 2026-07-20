import { describe, expect, it } from 'vitest';
import { convertMonsters, convertSimple, convertSpells, type Monster, type Spell } from '../scripts/convert.js';

const goblin: Monster = {
  index: 'goblin',
  name: 'Goblin',
  size: 'Small',
  type: 'humanoid',
  subtype: 'goblinoid',
  alignment: 'neutral evil',
  armor_class: [{ type: 'armor', value: 15 }],
  hit_points: 7,
  hit_points_roll: '2d6',
  speed: { walk: '30 ft.' },
  strength: 8,
  dexterity: 14,
  constitution: 10,
  intelligence: 10,
  wisdom: 8,
  charisma: 8,
  proficiencies: [{ value: 6, proficiency: { name: 'Skill: Stealth' } }],
  damage_vulnerabilities: [],
  damage_resistances: [],
  damage_immunities: [],
  condition_immunities: [],
  senses: { darkvision: '60 ft.', passive_perception: 9 },
  languages: 'Common, Goblin',
  challenge_rating: 0.25,
  xp: 50,
  actions: [{ name: 'Scimitar', desc: 'Melee Weapon Attack: +4 to hit.' }],
};

describe('convertMonsters', () => {
  it('builds a stat block with tracker fields', () => {
    const [entry] = convertMonsters([goblin]);
    expect(entry!.id).toBe('monster:goblin');
    expect(entry!.fields).toMatchObject({ hp: 7, ac: 15, dexMod: 2, cr: 0.25 });
    expect(entry!.body).toContain('**Challenge:** 1/4 (50 XP)');
    expect(entry!.body).toContain('| 14 (+2) |');
    expect(entry!.body).toContain('**Scimitar.**');
    expect(entry!.body).toContain('Stealth +6');
  });
});

describe('convertSpells', () => {
  it('formats level, meta and higher-level text', () => {
    const spell: Spell = {
      index: 'fireball',
      name: 'Fireball',
      desc: ['Boom.'],
      higher_level: ['More boom.'],
      range: '150 feet',
      components: ['V', 'S', 'M'],
      material: 'bat guano',
      ritual: false,
      duration: 'Instantaneous',
      concentration: false,
      casting_time: '1 action',
      level: 3,
      school: { name: 'Evocation' },
      classes: [{ name: 'Wizard' }],
    };
    const [entry] = convertSpells([spell]);
    expect(entry!.body).toContain('*3rd-level evocation*');
    expect(entry!.body).toContain('**At higher levels.** More boom.');
    expect(entry!.fields).toMatchObject({ level: 3, school: 'Evocation' });
  });
});

describe('convertSimple', () => {
  it('joins desc arrays into markdown', () => {
    const [entry] = convertSimple('condition', [
      { index: 'blinded', name: 'Blinded', desc: ['- a', '- b'] },
    ]);
    expect(entry!.id).toBe('condition:blinded');
    expect(entry!.body).toBe('- a\n\n- b');
  });
});
