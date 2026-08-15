export type OracleOdds = 'likely' | 'even' | 'unlikely';

export type OracleAnswer = 'yesAnd' | 'yes' | 'yesBut' | 'noBut' | 'no' | 'noAnd';

export interface OracleResult {
  answer: OracleAnswer;
  answerLabel: string;
  action: string;
  theme: string;
  text: string;
}

export const ORACLE_ACTIONS = [
  'Abandon', 'Accuse', 'Ambush', 'Attack', 'Bargain', 'Betray', 'Bribe', 'Capture',
  'Challenge', 'Command', 'Confront', 'Corrupt', 'Create', 'Damage', 'Deceive', 'Defend',
  'Defy', 'Demand', 'Destroy', 'Discover', 'Distract', 'Divide', 'Escape', 'Expose',
  'Find', 'Flee', 'Follow', 'Forgive', 'Guard', 'Harm', 'Hide', 'Hunt',
  'Ignore', 'Imitate', 'Inform', 'Inspect', 'Interrogate', 'Intimidate', 'Investigate', 'Judge',
  'Kill', 'Lead', 'Learn', 'Loot', 'Lose', 'Manipulate', 'Mourn', 'Move',
  'Negotiate', 'Observe', 'Oppose', 'Overcome', 'Perceive', 'Plan', 'Plot', 'Protect',
  'Pursue', 'Refuse', 'Reject', 'Release', 'Relieve', 'Resist', 'Restore', 'Reveal',
  'Rival', 'Rob', 'Ruin', 'Sacrifice', 'Save', 'Scare', 'Search', 'Seize',
  'Separate', 'Silence', 'Spy', 'Stalk', 'Steal', 'Stop', 'Struggle', 'Surrender',
  'Surround', 'Threaten', 'Track', 'Trap', 'Trick', 'Uncover', 'Unite', 'Unleash',
  'Warn', 'Weaken', 'Win', 'Withdraw', 'Witness', 'Wound', 'Yield'
];

export const ORACLE_THEMES = [
  'Advantage', 'Alliance', 'Allies', 'Ambition', 'Ancient', 'Anger', 'Authority', 'Bargain',
  'Barrier', 'Battle', 'Betrayal', 'Blood', 'Bond', 'Burden', 'Chaos', 'Clan',
  'Cold', 'Control', 'Corruption', 'Courage', 'Creation', 'Crime', 'Crown', 'Curse',
  'Danger', 'Darkness', 'Death', 'Debt', 'Deceit', 'Destiny', 'Destruction', 'Disease',
  'Domain', 'Doubt', 'Duty', 'Elements', 'Enemy', 'Energy', 'Envy', 'Escape',
  'Faith', 'Fame', 'Fear', 'Fire', 'Flaw', 'Force', 'Freedom', 'Friendship',
  'Glory', 'Greed', 'Grief', 'Guild', 'Guilt', 'Hatred', 'Heir', 'History',
  'Honor', 'Hope', 'Horror', 'Hostility', 'Illusion', 'Innocence', 'Knowledge', 'Language',
  'Law', 'Leader', 'Legacy', 'Liberty', 'Light', 'Loss', 'Loyalty', 'Magic',
  'Memory', 'Message', 'Might', 'Mistake', 'Monster', 'Mystery', 'Nature', 'Night',
  'Oath', 'Order', 'Pain', 'Passage', 'Path', 'Peace', 'Peril', 'Pleasure',
  'Power', 'Price', 'Pride', 'Prison', 'Promise', 'Prophecy', 'Protection', 'Quest',
  'Rage', 'Realm', 'Refuge', 'Relic', 'Rival', 'Ruin', 'Ruler', 'Rumor',
  'Sacrifice', 'Secret', 'Shadow', 'Silence', 'Soul', 'Spirit', 'Storm', 'Stranger',
  'Strength', 'Strike', 'Success', 'Suffering', 'Supply', 'Surprise', 'Symbol', 'Target',
  'Temptation', 'Territory', 'Terror', 'Thief', 'Threat', 'Throne', 'Time', 'Tomb',
  'Trade', 'Trap', 'Treasure', 'Truce', 'Trust', 'Truth', 'Tyrant', 'Vengeance',
  'Victim', 'Victory', 'Vision', 'Voice', 'Vow', 'War', 'Warning', 'Weakness',
  'Weapon', 'Wealth', 'Wisdom', 'Wound', 'Wrath', 'Youth', 'Zeal'
];

export function rollOracle(odds: OracleOdds = 'even'): OracleResult {
  const roll = Math.floor(Math.random() * 100) + 1; // 1-100

  let answer: OracleAnswer = 'yes';
  let answerLabel = 'Yes';

  if (odds === 'likely') {
    if (roll <= 10) {
      answer = 'noAnd';
      answerLabel = 'No, and…';
    } else if (roll <= 25) {
      answer = 'no';
      answerLabel = 'No';
    } else if (roll <= 45) {
      answer = 'noBut';
      answerLabel = 'No, but…';
    } else if (roll <= 70) {
      answer = 'yesBut';
      answerLabel = 'Yes, but…';
    } else if (roll <= 90) {
      answer = 'yes';
      answerLabel = 'Yes';
    } else {
      answer = 'yesAnd';
      answerLabel = 'Yes, and…';
    }
  } else if (odds === 'unlikely') {
    if (roll <= 20) {
      answer = 'noAnd';
      answerLabel = 'No, and…';
    } else if (roll <= 45) {
      answer = 'no';
      answerLabel = 'No';
    } else if (roll <= 65) {
      answer = 'noBut';
      answerLabel = 'No, but…';
    } else if (roll <= 80) {
      answer = 'yesBut';
      answerLabel = 'Yes, but…';
    } else if (roll <= 95) {
      answer = 'yes';
      answerLabel = 'Yes';
    } else {
      answer = 'yesAnd';
      answerLabel = 'Yes, and…';
    }
  } else {
    // even
    if (roll <= 10) {
      answer = 'noAnd';
      answerLabel = 'No, and…';
    } else if (roll <= 30) {
      answer = 'no';
      answerLabel = 'No';
    } else if (roll <= 50) {
      answer = 'noBut';
      answerLabel = 'No, but…';
    } else if (roll <= 70) {
      answer = 'yesBut';
      answerLabel = 'Yes, but…';
    } else if (roll <= 90) {
      answer = 'yes';
      answerLabel = 'Yes';
    } else {
      answer = 'yesAnd';
      answerLabel = 'Yes, and…';
    }
  }

  const action = ORACLE_ACTIONS[Math.floor(Math.random() * ORACLE_ACTIONS.length)] ?? 'Confront';
  const theme = ORACLE_THEMES[Math.floor(Math.random() * ORACLE_THEMES.length)] ?? 'Danger';

  return {
    answer,
    answerLabel,
    action,
    theme,
    text: `${answerLabel} — ${action} / ${theme}`,
  };
}
