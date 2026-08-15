import { describe, expect, it } from 'vitest';
import {
  convertMonsters,
  convertSimple,
  convertSpells,
  parseMonsterAbility,
  type Monster,
  type Spell,
} from '../scripts/convert.js';

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
  special_abilities: [
    { name: 'Nimble Escape', desc: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.' },
  ],
  actions: [{ name: 'Scimitar', desc: 'Melee Weapon Attack: +4 to hit.' }],
};

const dragon: Monster = {
  index: 'young-green-dragon',
  name: 'Young Green Dragon',
  size: 'Large',
  type: 'dragon',
  alignment: 'lawful evil',
  armor_class: [{ type: 'natural', value: 18 }],
  hit_points: 136,
  hit_points_roll: '16d10 + 48',
  speed: { walk: '40 ft.', fly: '80 ft.', swim: '40 ft.' },
  strength: 19,
  dexterity: 12,
  constitution: 17,
  intelligence: 16,
  wisdom: 13,
  charisma: 15,
  proficiencies: [],
  damage_vulnerabilities: [],
  damage_resistances: [],
  damage_immunities: ['poison'],
  condition_immunities: [{ name: 'poisoned' }],
  senses: { blindsight: '30 ft.', darkvision: '120 ft.', passive_perception: 17 },
  languages: 'Common, Draconic',
  challenge_rating: 8,
  xp: 3900,
  special_abilities: [
    { name: 'Amphibious', desc: 'Can breathe air and water.' },
  ],
  actions: [
    { name: 'Bite', desc: 'Melee Weapon Attack: +7 to hit.' },
    { name: 'Poison Breath (Recharge 5-6)', desc: 'Exhales poisonous gas.' },
  ],
};

const caster: Monster = {
  index: 'mage',
  name: 'Mage',
  size: 'Medium',
  type: 'humanoid',
  alignment: 'any alignment',
  armor_class: [{ type: 'armor', value: 12 }],
  hit_points: 40,
  speed: { walk: '30 ft.' },
  strength: 9,
  dexterity: 14,
  constitution: 11,
  intelligence: 17,
  wisdom: 12,
  charisma: 11,
  proficiencies: [],
  damage_vulnerabilities: [],
  damage_resistances: [],
  damage_immunities: [],
  condition_immunities: [],
  senses: { passive_perception: 11 },
  languages: 'any four languages',
  challenge_rating: 6,
  xp: 2300,
  special_abilities: [
    { name: 'Spellcasting', desc: '1st level (4 slots), 2nd level (3 slots)' },
    { name: 'Invisibility (1/Day)', desc: 'Can cast invisibility once per day.' },
    { name: 'Teleport (3/Day)', desc: 'Can teleport 3 times per day.' },
  ],
  actions: [
    { name: 'Dagger', desc: 'Melee attack.' },
  ],
};

const simpleBeast: Monster = {
  index: 'frog',
  name: 'Frog',
  size: 'Tiny',
  type: 'beast',
  alignment: 'unaligned',
  armor_class: [{ type: 'dex', value: 11 }],
  hit_points: 1,
  speed: { walk: '20 ft.', swim: '20 ft.' },
  strength: 1,
  dexterity: 13,
  constitution: 8,
  intelligence: 1,
  wisdom: 8,
  charisma: 3,
  proficiencies: [],
  damage_vulnerabilities: [],
  damage_resistances: [],
  damage_immunities: [],
  condition_immunities: [],
  senses: { darkvision: '30 ft.', passive_perception: 11 },
  languages: '',
  challenge_rating: 0,
  xp: 0,
};

describe('parseMonsterAbility', () => {
  it('parses plain trait without recharge or per-day', () => {
    const res = parseMonsterAbility({ name: 'Pack Tactics', desc: 'Advantage on attack rolls if ally adjacent.' });
    expect(res.name).toBe('Pack Tactics');
    expect(res.text).toBe('Advantage on attack rolls if ally adjacent.');
    expect(res.recharge).toBeUndefined();
    expect(res.usesPerDay).toBeUndefined();
  });

  it('parses (Recharge 5-6) and strips marker from name', () => {
    const res = parseMonsterAbility({ name: 'Fire Breath (Recharge 5-6)', desc: 'Deals 22 fire damage.' });
    expect(res.name).toBe('Fire Breath');
    expect(res.recharge).toEqual({ min: 5 });
    expect(res.usesPerDay).toBeUndefined();
  });

  it('parses (Recharge 6) and strips marker from name', () => {
    const res = parseMonsterAbility({ name: 'Cold Breath (Recharge 6)', desc: 'Deals cold damage.' });
    expect(res.name).toBe('Cold Breath');
    expect(res.recharge).toEqual({ min: 6 });
  });

  it('parses (1/Day) and (3/Day) and strips marker from name', () => {
    const res1 = parseMonsterAbility({ name: 'Heal (1/Day)', desc: 'Heals 50 hp.' });
    expect(res1.name).toBe('Heal');
    expect(res1.usesPerDay).toBe(1);

    const res3 = parseMonsterAbility({ name: 'Shield (3/Day)', desc: 'Adds +5 AC.' });
    expect(res3.name).toBe('Shield');
    expect(res3.usesPerDay).toBe(3);
  });
});

describe('convertMonsters', () => {
  it('builds a stat block with tracker fields and structured abilities', () => {
    const [entry] = convertMonsters([goblin]);
    expect(entry!.id).toBe('monster:goblin');
    expect(entry!.fields).toMatchObject({
      hp: 7,
      ac: 15,
      dexMod: 2,
      cr: 0.25,
      traits: [{ name: 'Nimble Escape', text: expect.stringContaining('Disengage') }],
      actions: [{ name: 'Scimitar', text: expect.stringContaining('Melee') }],
      legendary: [],
    });
    expect(entry!.body).toContain('**Challenge:** 1/4 (50 XP)');
    expect(entry!.body).toContain('| 14 (+2) |');
    expect(entry!.body).toContain('**Scimitar.**');
    expect(entry!.body).toContain('Stealth +6');
  });

  it('correctly populates recharge abilities in fields.actions', () => {
    const [entry] = convertMonsters([dragon]);
    const breath = entry!.fields!.actions.find((a: any) => a.name === 'Poison Breath');
    expect(breath).toEqual({
      name: 'Poison Breath',
      text: 'Exhales poisonous gas.',
      recharge: { min: 5 },
    });
  });

  it('correctly populates per-day abilities in fields.traits', () => {
    const [entry] = convertMonsters([caster]);
    const invis = entry!.fields!.traits.find((t: any) => t.name === 'Invisibility');
    expect(invis).toEqual({
      name: 'Invisibility',
      text: 'Can cast invisibility once per day.',
      usesPerDay: 1,
    });
    const tele = entry!.fields!.traits.find((t: any) => t.name === 'Teleport');
    expect(tele).toEqual({
      name: 'Teleport',
      text: 'Can teleport 3 times per day.',
      usesPerDay: 3,
    });
  });

  it('handles a monster with no traits, actions, or legendary actions', () => {
    const [entry] = convertMonsters([simpleBeast]);
    expect(entry!.fields!.traits).toEqual([]);
    expect(entry!.fields!.actions).toEqual([]);
    expect(entry!.fields!.legendary).toEqual([]);
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
