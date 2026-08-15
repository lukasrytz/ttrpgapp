import { useEffect, useState } from 'react';
import { backend } from '../backend';
import { showToast } from '../toast';
import {
  generateNameBatch,
  generateQuirkFlaw,
  NAME_STYLES,
  RACES,
  type GeneratedName,
  type NPCQuirkFlaw,
} from './generatorsData';
import SceneLibraryManager from '../scene/SceneLibraryManager';

type Tab = 'scenes' | 'names' | 'quirks';

export default function GeneratorsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('scenes');

  // --- Names State ---
  const [raceFilter, setRaceFilter] = useState<string>('Any');
  const [genderFilter, setGenderFilter] = useState<string>('Any');
  const [styleFilter, setStyleFilter] = useState<string>('All Styles');
  const [batchCount, setBatchCount] = useState<number>(10);
  const [nameBatch, setNameBatch] = useState<GeneratedName[]>(() =>
    generateNameBatch(10, 'Any', 'Any', 'All Styles'),
  );

  // --- Quirks & Flaws State ---
  const [quirkCard, setQuirkCard] = useState<NPCQuirkFlaw>(() => generateQuirkFlaw());

  const rollNames = (
    r = raceFilter,
    g = genderFilter,
    s = styleFilter,
    c = batchCount,
  ) => {
    setNameBatch(generateNameBatch(c, r, g, s));
  };

  const rollQuirks = () => {
    setQuirkCard(generateQuirkFlaw());
  };

  const copyToClipboard = (text: string, label = 'Copied to clipboard!') => {
    void navigator.clipboard.writeText(text);
    showToast(label, '📋');
  };

  const cardMd = [
    `### 🎭 NPC Roleplay Traits`,
    `- **Disposition**: ${quirkCard.disposition}`,
    `- **Quirk**: ${quirkCard.quirk}`,
    `- **Flaw**: ${quirkCard.flaw}`,
    `- **Secret Goal**: ${quirkCard.secret}`,
    `- **Voice Hint**: ${quirkCard.voice}`,
  ].join('\n');

  return (
    <div className="page generators-page">
      <div className="page-header">
        <h1>DM Generators</h1>
      </div>

      <div className="generator-tabs">
        <button
          className={`tab-btn ${activeTab === 'scenes' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenes')}
        >
          🎭 Scene Library
        </button>
        <button
          className={`tab-btn ${activeTab === 'names' ? 'active' : ''}`}
          onClick={() => setActiveTab('names')}
        >
          🏷️ Random Name List
        </button>
        <button
          className={`tab-btn ${activeTab === 'quirks' ? 'active' : ''}`}
          onClick={() => setActiveTab('quirks')}
        >
          🎲 Flaws & Quirks
        </button>
      </div>

      {activeTab === 'scenes' && (
        <div className="scenes-tab">
          <SceneLibraryManager />
        </div>
      )}

      {activeTab === 'names' && (
        <div className="names-tab">
          <div className="panel generator-panel">
            <div className="filter-controls">
              <div className="filter-group">
                <label className="small muted">Race:</label>
                <select
                  value={raceFilter}
                  onChange={(e) => {
                    const r = e.target.value;
                    setRaceFilter(r);
                    rollNames(r, genderFilter, styleFilter, batchCount);
                  }}
                >
                  <option value="Any">All Races</option>
                  {RACES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="small muted">Gender:</label>
                <select
                  value={genderFilter}
                  onChange={(e) => {
                    const g = e.target.value;
                    setGenderFilter(g);
                    rollNames(raceFilter, g, styleFilter, batchCount);
                  }}
                >
                  <option value="Any">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="small muted">Style:</label>
                <select
                  value={styleFilter}
                  onChange={(e) => {
                    const s = e.target.value;
                    setStyleFilter(s);
                    rollNames(raceFilter, genderFilter, s, batchCount);
                  }}
                >
                  {NAME_STYLES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="small muted">Count:</label>
                <select
                  value={batchCount}
                  onChange={(e) => {
                    const c = Number(e.target.value);
                    setBatchCount(c);
                    rollNames(raceFilter, genderFilter, styleFilter, c);
                  }}
                >
                  <option value={8}>8 Names</option>
                  <option value={12}>12 Names</option>
                  <option value={20}>20 Names</option>
                </select>
              </div>

              <button className="primary" onClick={() => rollNames()}>
                🎲 Roll Fresh Names
              </button>
            </div>
          </div>

          <div className="names-action-bar">
            <button
              className="secondary"
              onClick={() => {
                const text = nameBatch
                  .map((n) => `- ${n.fullName} (${n.race} ${n.gender})`)
                  .join('\n');
                copyToClipboard(text, 'Copied all names!');
              }}
            >
              📋 Copy All ({nameBatch.length})
            </button>
          </div>

          <div className="names-list">
            {nameBatch.map((item, idx) => (
              <div key={idx} className="name-card">
                <div className="name-info">
                  <span className="name-title">{item.fullName}</span>
                  <span className="name-meta">
                    {item.race} • {item.gender}
                  </span>
                </div>
                <div className="name-actions">
                  <button
                    className="small-btn icon-only"
                    title="Copy Name"
                    onClick={() => copyToClipboard(item.fullName, `Copied "${item.fullName}"`)}
                  >
                    📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'quirks' && (
        <div className="quirks-tab">
          <div className="quirk-single-container">
            <div className="quirk-card panel">
              <div className="quirk-card-header">
                <span className="quirk-badge">🎭 NPC Roleplay Traits</span>
                <div className="card-actions">
                  <button className="primary" onClick={rollQuirks}>
                    🎲 Re-roll Traits
                  </button>
                  <button
                    className="secondary"
                    onClick={() => copyToClipboard(cardMd, 'Copied trait set!')}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className="quirk-details">
                <div className="quirk-row">
                  <span className="quirk-label">Disposition</span>
                  <span className="quirk-val">{quirkCard.disposition}</span>
                </div>
                <div className="quirk-row">
                  <span className="quirk-label">Quirk</span>
                  <span className="quirk-val">{quirkCard.quirk}</span>
                </div>
                <div className="quirk-row">
                  <span className="quirk-label">Flaw</span>
                  <span className="quirk-val highlight-flaw">{quirkCard.flaw}</span>
                </div>
                <div className="quirk-row">
                  <span className="quirk-label">Secret Goal</span>
                  <span className="quirk-val">{quirkCard.secret}</span>
                </div>
                <div className="quirk-row">
                  <span className="quirk-label">Voice Hint</span>
                  <span className="quirk-val">{quirkCard.voice}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
