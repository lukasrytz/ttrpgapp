/**
 * Comprehensive datasets & algorithms for DM random name generation and NPC flaws/quirks.
 * Includes curated lists and procedural fantasy syllable algorithms for massive variety.
 */

export interface GeneratedName {
  fullName: string;
  firstName: string;
  surname: string;
  race: string;
  gender: string;
}

export interface NPCQuirkFlaw {
  disposition: string;
  quirk: string;
  flaw: string;
  secret: string;
  voice: string;
}

export const RACES = [
  'Human',
  'Dwarf',
  'Elf',
  'Halfling',
  'Tiefling',
  'Half-Orc',
  'Gnome',
  'Dragonborn',
  'Barovian',
  'Vistani',
] as const;

export const NAME_STYLES = [
  'All Styles',
  'Classic Fantasy',
  'Nordic & Saxon',
  'Celtic & Wildwood',
  'High Elven & Ancient',
  'Infernal & Dark',
  'Procedural Fantasy',
] as const;

export const NAMES_BY_RACE: Record<
  string,
  { male: string[]; female: string[]; surnames: string[] }
> = {
  Human: {
    male: [
      'Gideon', 'Alden', 'Corvus', 'Thorne', 'Bram', 'Derrick', 'Kaelen', 'Vance', 'Rowan', 'Orson',
      'Cedric', 'Gareth', 'Alistair', 'Barnaby', 'Caspian', 'Darius', 'Eamon', 'Fletcher', 'Griffin',
      'Hadrian', 'Ignatius', 'Jorian', 'Kenric', 'Lysander', 'Malachi', 'Niles', 'Oren', 'Percival',
      'Quentin', 'Roderick', 'Silas', 'Tristan', 'Ulysses', 'Valen', 'Wyatt', 'Xander', 'Yorick', 'Zacharias',
      'Bartholomew', 'Constantine', 'Dominic', 'Ebenezer', 'Franklyn', 'Godfrey', 'Horatio', 'Jeremiah',
    ],
    female: [
      'Evelyn', 'Clara', 'Lyra', 'Maeve', 'Gwen', 'Aurelia', 'Vespera', 'Isolde', 'Seraphina', 'Nora',
      'Elspeth', 'Fiona', 'Adelaide', 'Beatrix', 'Cassandra', 'Delilah', 'Evangeline', 'Genevieve',
      'Helena', 'Iris', 'Juliet', 'Katharina', 'Lorelei', 'Mirabel', 'Ophelia', 'Penelope', 'Rosalind',
      'Sylvia', 'Tessa', 'Ursula', 'Valerie', 'Willa', 'Xenia', 'Yvaine', 'Zora', 'Astrid', 'Brenna',
      'Cecilia', 'Dorothea', 'Eleanor', 'Felicity', 'Gwendolyn', 'Henrietta', 'Imogen', 'Johanna',
    ],
    surnames: [
      'Blackwood', 'Ironhart', 'Vane', 'Stormfall', 'Ashford', 'Hawthorne', 'Sterling', 'Winterfell',
      'Oaks', 'Crowley', 'Davenport', 'Fairfax', 'Holloway', 'Kingsley', 'Lancaster', 'Mercer',
      'Nightingale', 'Pembroke', 'Rutherford', 'Sinclair', 'Thackeray', 'Underwood', 'Vanguard',
      'Waverly', 'Yates', 'Bramwell', 'Caldwell', 'Dunbar', 'Ellington', 'Fitzgerald', 'Greene',
    ],
  },
  Dwarf: {
    male: [
      'Kargath', 'Thorin', 'Brak', 'Dorn', 'Orik', 'Balthazar', 'Grimgar', 'Kaelen', 'Thrain', 'Beldorn',
      'Orsik', 'Rurik', 'Adrik', 'Baern', 'Brottor', 'Dain', 'Darrak', 'Eberk', 'Einkil', 'Fargrim',
      'Flint', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Oskar', 'Rangrim', 'Taklinn', 'Torgran', 'Ulfgar',
      'Veit', 'Vondal', 'Barundar', 'Duergar', 'Gurn', 'Harkon', 'Kragan', 'Malthor', 'Nandor', 'Thalkar',
    ],
    female: [
      'Hilda', 'Dagmar', 'Vondra', 'Torra', 'Brakka', 'Helga', 'Kathra', 'Marn', 'Gerd', 'Orla',
      'Eldeth', 'Liftrasa', 'Amber', 'Artin', 'Audhild', 'Bardryn', 'Dagnal', 'Diesa', 'Eldeth',
      'Falkrunn', 'Finellen', 'Gunnloda', 'Gurdis', 'Helja', 'Hlin', 'Kathra', 'Kristryd', 'Ilde',
      'Torbera', 'Tordrid', 'Vistryd', 'Brunhilda', 'Dagna', 'Freya', 'Garda', 'Klaudia', 'Sigrid',
    ],
    surnames: [
      'Ironfoot', 'Bronzebeard', 'Stonehammer', 'Fireforge', 'Goldhand', 'Deepseeker', 'Granitepeak',
      'Coppervein', 'Battlehammer', 'Blackiron', 'Dwarvenhearth', 'Forgeheart', 'Frostbeard',
      'Hammerfall', 'Mountainshield', 'Oakenheel', 'Rockbreaker', 'Silveraxe', 'Steelclad', 'Thunderbrew',
    ],
  },
  Elf: {
    male: [
      'Aelaris', 'Sylas', 'Thalor', 'Faelar', 'Vaelin', 'Lucien', 'Zephyr', 'Caelynn', 'Ilizar', 'Eldrin',
      'Arannis', 'Theron', 'Adran', 'Aelar', 'Aramil', 'Arren', 'Aust', 'Beiro', 'Berrian', 'Carric',
      'Enialis', 'Erdan', 'Galinndan', 'Hadarai', 'Heian', 'Ivellios', 'Laucian', 'Mindartis', 'Paelias',
      'Peren', 'Quion', 'Rael', 'Soveliss', 'Thamior', 'Tharivol', 'Varis', 'Aethel', 'Caelen', 'Faen',
    ],
    female: [
      'Aria', 'Lyra', 'Sylvanas', 'Elion', 'Caeda', 'Nyssa', 'Thalia', 'Morwen', 'Vesper', 'Fae',
      'Althaea', 'Leshanna', 'Adrie', 'Anastrianna', 'Andraste', 'Antinua', 'Bethrynna', 'Birel',
      'Caelynn', 'Drusilia', 'Enna', 'Felosial', 'Ielenia', 'Jelenneth', 'Keyleth', 'Lia', 'Mialee',
      'Naivara', 'Quelenna', 'Sariel', 'Shanairra', 'Shava', 'Thia', 'Vadania', 'Valanthe', 'Xanaphia',
    ],
    surnames: [
      'Moonwhisper', 'Sunstrider', 'Starweaver', 'Nightbreeze', 'Silversong', 'Leavesfall', 'Dawnseeker',
      'Riverwind', 'Amakiir', 'Amastacia', 'Galanodel', 'Holimion', 'Ilphelkiir', 'Liadon', 'Meliamne',
      'Nailo', 'Siannodel', 'Xiloscient', 'Shadowwood', 'Silverfrond', 'Starflower', 'Whisperwind',
    ],
  },
  Halfling: {
    male: [
      'Milo', 'Finnian', 'Tobias', 'Pip', 'Barnaby', 'Coby', 'Perry', 'Oswald', 'Jasper', 'Rory',
      'Cade', 'Eldon', 'Alton', 'Ander', 'Corrin', 'Errich', 'Garret', 'Lindal', 'Lyle', 'Merric',
      'Perrin', 'Reed', 'Roscoe', 'Wellby', 'Benny', 'Bramley', 'Charlie', 'Felix', 'Giles', 'Hugo',
    ],
    female: [
      'Daisy', 'Poppy', 'Rosie', 'Tilly', 'Clover', 'Maisie', 'Ella', 'Penny', 'Willa', 'Flora',
      'Bree', 'Kallie', 'Andry', 'Callie', 'Cora', 'Euphemia', 'Jillian', 'Lavinia', 'Lidda', 'Merla',
      'Nedda', 'Paela', 'Portia', 'Seraphina', 'Shaena', 'Vani', 'Verna', 'Bella', 'Dottie', 'Ivy',
    ],
    surnames: [
      'Underhill', 'Goodbarrel', 'Greenbottle', 'Bramblefoot', 'Tealeaf', 'Hillside', 'Appleblossom',
      'Warmwater', 'Brushgather', 'Fastfoot', 'High-hill', 'Hornblower', 'Littlefoot', 'Thorngage',
      'Tosscobble', 'Butterbur', 'Cobblepot', 'Fairbairn', 'Puddlefoot', 'Sweetwater',
    ],
  },
  Tiefling: {
    male: [
      'Malakor', 'Akemenos', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kiron', 'Leucis', 'Melech', 'Mordai',
      'Valen', 'Azazel', 'Balthazar', 'Caim', 'Decarabia', 'Eligos', 'Forneus', 'Gaap', 'Halphas', 'Infernus',
      'Lucifer', 'Mephisto', 'Naberius', 'Orias', 'Paimon', 'Ronove', 'Samael', 'Valefar', 'Xaphan', 'Zepar',
    ],
    female: [
      'Akta', 'Anakis', 'Bryseis', 'Criella', 'Damaia', 'Ea', 'Kallista', 'Lerissa', 'Makaria', 'Nemeia',
      'Orianna', 'Astaroth', 'Lilith', 'Morrigan', 'Naamah', 'Proserpina', 'Saris', 'Tiamat', 'Vesper',
      'Zaria', 'Azrael', 'Carmilla', 'Deloris', 'Hecate', 'Jezebel', 'Keres', 'Lamia', 'Nyx', 'Selene',
    ],
    surnames: [
      'Despair', 'Art', 'Fear', 'Glory', 'Hope', 'Music', 'Nowhere', 'Poetry', 'Quest', 'Sorrow',
      'Veritas', 'Ambition', 'Chant', 'Creed', 'Exile', 'Faith', 'Honor', 'Ideal', 'Memory', 'Open',
      'Reverence', 'Torment', 'Triumph', 'Wanderer', 'Zeal', 'Dusk', 'Ashen', 'Brimstone', 'Nether',
    ],
  },
  'Half-Orc': {
    male: [
      'Thrum', 'Gore', 'Krag', 'Rorg', 'Brak', 'Vraak', 'Ugarth', 'Karg', 'Murok', 'Hark',
      'Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Krusk', 'Mhurren', 'Ront',
      'Shump', 'Thokk', 'Borg', 'Dug', 'Gash', 'Grum', 'Khor', 'Lok', 'Mog', 'Ork',
    ],
    female: [
      'Baggi', 'Emen', 'Engong', 'Kansif', 'Myev', 'Neega', 'Ovak', 'Ownka', 'Shautha', 'Vola',
      'Zul', 'Rhaza', 'Arha', 'Bredda', 'Drenna', 'Griselda', 'Karga', 'Lura', 'Marga', 'Nola',
      'Ogra', 'Runa', 'Shara', 'Tora', 'Ula', 'Varna', 'Yala', 'Zora', 'Gretchen', 'Kira',
    ],
    surnames: [
      'Skullsplitter', 'Ironjaw', 'Bloodhound', 'Bonecrusher', 'Shieldbreaker', 'Scarface', 'Thunderfist',
      'Gorefang', 'Ironhide', 'Nightstalker', 'Ragehound', 'Stonecleaver', 'Wildfury', 'Wolfbane',
    ],
  },
  Gnome: {
    male: [
      'Alston', 'Boddynock', 'Brocc', 'Burgell', 'Dimble', 'Eldon', 'Erky', 'Fonkin', 'Gimble', 'Gerbo',
      'Zook', 'Wrenn', 'Bimble', 'Corbin', 'Fizzle', 'Gaston', 'Ignatius', 'Jinx', 'Kip', 'Norbert',
      'Oswald', 'Pippin', 'Quigley', 'Rascal', 'Sprocket', 'Tink', 'Waldo', 'Ziggy', 'Barnaby', 'Clement',
    ],
    female: [
      'Bimpnottin', 'Breena', 'Caramip', 'Carlin', 'Donella', 'Ella', 'Lilli', 'Loopmottin', 'Zanna', 'Roywyn',
      'Tizz', 'Wrenn', 'Bell', 'Clementine', 'Dixie', 'Fifi', 'Gigi', 'Hazel', 'Ivy', 'Joy',
      'Kiwi', 'Lulu', 'Mimi', 'Nixi', 'Penny', 'Ruby', 'Trixie', 'Violet', 'Winnie', 'Zora',
    ],
    surnames: [
      'Sparklegem', 'Nackle', 'Timbers', 'Turen', 'Scheppen', 'Folkor', 'Garrick', 'Copperpot',
      'Brassgear', 'Cogspinner', 'Fiddleworth', 'Glitterstone', 'Goldpocket', 'Quickwhistle', 'Tinkerfoot',
    ],
  },
  Dragonborn: {
    male: [
      'Arjhan', 'Balasar', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Mehen', 'Nadarr', 'Rhogar',
      'Tarhun', 'Torinn', 'Bharash', 'Drakar', 'Gorax', 'Ignis', 'Kaelen', 'Ignar', 'Khoron', 'Rath',
      'Sarkhan', 'Thorn', 'Vaelor', 'Zaroth', 'Ignis', 'Ragnar', 'Pyroth', 'Dracon', 'Vortex', 'Kael',
    ],
    female: [
      'Akra', 'Biri', 'Daar', 'Farideh', 'Harann', 'Havilar', 'Jheri', 'Kava', 'Korinn', 'Mishann',
      'Uadjit', 'Perra', 'Raiann', 'Thava', 'Draconia', 'Ignia', 'Kaelis', 'Pyra', 'Soraya', 'Valeria',
      'Vespera', 'Zafira', 'Astra', 'Bellatrix', 'Caelia', 'Drakyna', 'Ember', 'Ignia', 'Saphira', 'Ventra',
    ],
    surnames: [
      'Kimbatuul', 'Clethtinthiallor', 'Daardendrian', 'Delmirev', 'Kepeshkmolik', 'Myastan', 'Verthisathurgiesh',
      'Brimstone', 'Dragonclaw', 'Flameheart', 'Scalebound', 'Scalebreaker', 'Wyrmscale', 'Wyrmbane',
    ],
  },
  Barovian: {
    male: [
      'Alek', 'Andrej', 'Anton', 'Bogdan', 'Boris', 'Davor', 'Dmitri', 'Gwilym', 'Henrik', 'Igor',
      'Ivan', 'Izmar', 'Jan', 'Kazimierz', 'Laszlo', 'Milos', 'Nikolai', 'Oleg', 'Radu', 'Rahadin',
      'Sergei', 'Stefan', 'Vasili', 'Viktor', 'Vladimir', 'Yevgeni', 'Constantin', 'Grigor', 'Pavel',
    ],
    female: [
      'Anastasia', 'Annika', 'Danika', 'Dorothya', 'Elisabeth', 'Esmerelda', 'Irena', 'Irina', 'Katerina', 'Luba',
      'Ludmilla', 'Marilena', 'Marya', 'Milena', 'Natalia', 'Parriwimple', 'Radu', 'Tatyana', 'Valentina', 'Velvin',
      'Zuleika', 'Viktoria', 'Svetlana', 'Oksana', 'Yelena', 'Bialena', 'Lucinda', 'Marina',
    ],
    surnames: [
      'Arasek', 'Belview', 'Blinsky', 'Bogarav', 'Boritsa', 'Dilisnya', 'Gorski', 'Kolyana', 'Martikov',
      'Petrovna', 'Rikenberg', 'Strazni', 'Vallaki', 'Von Zarovich', 'Yakov', 'Zelen', 'Krezkov', 'Wachter',
    ],
  },
  Vistani: {
    male: [
      'Arrigal', 'Bella', 'Cosmin', 'Dalu', 'Dragan', 'Gabriel', 'Gorit', 'Grigori', 'Havor', 'Kiril',
      'Luvash', 'Mircea', 'Petrov', 'Radu', 'Stanimir', 'Tibor', 'Valentin', 'Vlad', 'Zoltán', 'Roman',
    ],
    female: [
      'Alana', 'Arabelle', 'Bogdana', 'Carmen', 'Corina', 'Donavika', 'Ezmerelda', 'Florica', 'Irina', 'Luminita',
      'Madam Eva', 'Nastasia', 'Simona', 'Sorina', 'Varia', 'Yelena', 'Zoltan', 'Ilona', 'Mirela',
    ],
    surnames: [
      'Arrigali', 'Baern', 'Camena', 'Cioran', 'Corvin', 'Gorgan', 'Luvashi', 'Monor', 'Popa', 'Radu',
      'Vistani', 'Zarovan', 'Tzigani', 'Stanescu', 'Petrescu',
    ],
  },
};

/* --- PROCEDURAL FANTASY SYLLABLE GENERATOR --- */
const SYLLABLE_PATTERNS: Record<string, { prefixes: string[]; infixes: string[]; suffixes: string[] }> = {
  Elf: {
    prefixes: ['Ael', 'Cael', 'Eld', 'Fael', 'Lyr', 'Syl', 'Thal', 'Vael', 'Zeph', 'Il', 'Mor', 'Nae', 'Val'],
    infixes: ['an', 'ar', 'ith', 'or', 'is', 'el', 'ia', 'en', 'al', 'os'],
    suffixes: ['is', 'on', 'as', 'eth', 'ian', 'or', 'ia', 'ith', 'wyn', 'ras', 'las', 'dor'],
  },
  Dwarf: {
    prefixes: ['Brak', 'Dorn', 'Karg', 'Thor', 'Grimg', 'Rur', 'Thrain', 'Beld', 'Ors', 'Kild', 'Morg', 'Vond'],
    infixes: ['a', 'o', 'u', 'gar', 'din', 'ram', 'dak'],
    suffixes: ['ath', 'gar', 'rak', 'ik', 'gath', 'grim', 'mund', 'vald', 'or', 'um', 'k'],
  },
  'Half-Orc': {
    prefixes: ['Krag', 'Vraak', 'Ug', 'Murok', 'Gore', 'Thrum', 'Dench', 'Shump', 'Krusk', 'Holg', 'Grum'],
    infixes: ['ar', 'or', 'ur', 'ash', 'og'],
    suffixes: ['gath', 'gash', 'nak', 'zor', 'mog', 'kash', 'th', 'rok', 'k', 'mar'],
  },
  Dragonborn: {
    prefixes: ['Arj', 'Bal', 'Don', 'Hes', 'Kriv', 'Med', 'Nad', 'Rhog', 'Tar', 'Tor', 'Bhar', 'Drak'],
    infixes: ['a', 'ar', 'as', 'is', 'or', 'un'],
    suffixes: ['han', 'asar', 'aar', 'kan', 'rash', 'hen', 'gar', 'hun', 'inn', 'th', 'rax'],
  },
  Barovian: {
    prefixes: ['Vlad', 'Dmitr', 'Bog', 'Kaz', 'Rad', 'Stef', 'Nik', 'Lasz', 'Mar', 'Kat', 'Gorsk', 'Straz'],
    infixes: ['ov', 'sk', 'is', 'en', 'ar', 'iv', 'an'],
    suffixes: ['ik', 'ian', 'off', 'ic', 'ev', 'ova', 'slav', 'mir', 'ski', 'na'],
  },
  Vistani: {
    prefixes: ['Arr', 'Cos', 'Drag', 'Grig', 'Kir', 'Luv', 'Mirc', 'Stan', 'Zolt', 'Flor'],
    infixes: ['a', 'o', 'ia', 'an', 'es'],
    suffixes: ['amir', 'escu', 'ovan', 'ica', 'ila', 'ita', 'an', 'ov'],
  },
};

export function generateProceduralName(race: string): string {
  const pattern = SYLLABLE_PATTERNS[race] || SYLLABLE_PATTERNS['Elf']!;
  const prefix = pickRandom(pattern.prefixes);
  const useInfix = Math.random() > 0.4;
  const infix = useInfix ? pickRandom(pattern.infixes) : '';
  const suffix = pickRandom(pattern.suffixes);
  return `${prefix}${infix}${suffix}`.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export const DISPOSITIONS = [
  'Warm & Welcoming',
  'Suspicious & Guarded',
  'Gruff & Short-tempered',
  'Over-enthusiastic & Chatty',
  'Nervous & Fidgety',
  'Arrogant & Condescending',
  'Melancholy & Weary',
  'Polite & Calculating',
  'Distracted & Absent-minded',
  'Sarcastic & Witty',
  'Cryptic & Mysterious',
  'Jovial & Boisterous',
];

export const QUIRKS = [
  'Refuses to sit with their back to any door or window',
  'Constantly flips a polished silver coin between fingers',
  'Speaks in third person when discussing business',
  'Spits onto the ground whenever magic is mentioned',
  'Obsessively checks the sky for rain',
  'Loves corny puns and laughs at their own jokes',
  'Always carries a pouch of dried mint leaves to chew',
  'Whispers a short prayer before answering any question',
  'Nods repeatedly while listening to others',
  'Counts things in groups of three under their breath',
  'Fixes their outfit or sleeves every couple of minutes',
  'Maintains uncomfortable eye contact without blinking',
  'Twirls a small dagger between fingers while thinking',
  'Humming an unfamiliar tune softly under breath',
];

export const FLAWS = [
  'Arrogant and believes they are always the smartest person in the room',
  'Quick to anger when their authority or honor is questioned',
  'Paranoid that everyone is secretly out to betray or rob them',
  'Terrible with money; gambles away profits on risky bets',
  'Easily flattered and gullible to praise',
  'Gossip-monger who cannot keep a secret for more than an hour',
  'Stubborn to a fault; will never admit when they are wrong',
  'Cowardly when danger arises; puts self-preservation above all',
  'Hoards trinkets and shiny baubles obsessively',
  'Judges people harshly by their clothes and speech',
  'Secretly envious of adventurers and holds a grudge against magic-users',
  'Incapable of taking responsibility for their own mistakes',
];

export const SECRETS = [
  'Owes a massive gambling debt to the local crime syndicate',
  'Secretly a member of a banned religious cult',
  'Hiding a stolen royal signet ring inside a hollow heel',
  'Searching for a long-lost sibling missing in the Underdark',
  'Possesses a map leading to a forgotten dragon hoard',
  'Is actually an exiled noble living under an assumed alias',
  'Infected with a slow-acting curse they are trying to cure',
  'Acts as an informant for a rival city state',
];

export const VOICES = [
  'Low, raspy whisper with a subtle drawl',
  'High-pitched, rapid-fire speech pattern',
  'Deep resonant boom that rattles tankards',
  'Smooth, melodic elf accent with long vowels',
  'Gruff gravelly bark with frequent throat-clearing',
  'Soft, hesitant voice that trails off at sentence ends',
  'Fast-talking chatterbox with a nervous chuckle',
  'Formal, clipped diction like a military commander',
];

export function pickRandom<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateName(
  raceFilter?: string,
  genderFilter?: string,
  styleFilter?: string,
): GeneratedName {
  const race = raceFilter && raceFilter !== 'Any' ? raceFilter : pickRandom(RACES);
  const gender = genderFilter && genderFilter !== 'Any' ? genderFilter : pickRandom(['Male', 'Female']);
  
  if (styleFilter === 'Procedural Fantasy' && SYLLABLE_PATTERNS[race]) {
    const procFirst = generateProceduralName(race);
    const procSurname = generateProceduralName(race);
    return {
      fullName: `${procFirst} ${procSurname}`,
      firstName: procFirst,
      surname: procSurname,
      race,
      gender,
    };
  }

  const raceData = NAMES_BY_RACE[race] || NAMES_BY_RACE['Human']!;
  const nameList = gender === 'Female' ? raceData.female : raceData.male;
  const firstName = pickRandom(nameList);
  const surname = pickRandom(raceData.surnames);

  return {
    fullName: `${firstName} ${surname}`,
    firstName,
    surname,
    race,
    gender,
  };
}

export function generateNameBatch(
  count: number = 10,
  raceFilter?: string,
  genderFilter?: string,
  styleFilter?: string,
): GeneratedName[] {
  const list: GeneratedName[] = [];
  const seen = new Set<string>();
  
  for (let i = 0; i < count * 2 && list.length < count; i++) {
    const item = generateName(raceFilter, genderFilter, styleFilter);
    if (!seen.has(item.fullName)) {
      seen.add(item.fullName);
      list.push(item);
    }
  }
  return list;
}

export function generateQuirkFlaw(): NPCQuirkFlaw {
  return {
    disposition: pickRandom(DISPOSITIONS),
    quirk: pickRandom(QUIRKS),
    flaw: pickRandom(FLAWS),
    secret: pickRandom(SECRETS),
    voice: pickRandom(VOICES),
  };
}
