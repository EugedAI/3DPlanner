/**
 * React component example for Screenplay Parser.
 *
 * Usage:
 *   import ScriptUploader from './react-component';
 *   <ScriptUploader />
 */

import React, { useState, useRef } from 'react';
import { ScreenplayParser, LocalStorageAdapter } from '@screenplay-parser/core';

const parser = new ScreenplayParser({
  storage: new LocalStorageAdapter(),
  enableLearning: true,
  enableClaudeMode: false,
});

const ELEMENT_COLORS = {
  sceneHeading: '#e74c3c',
  character: '#3498db',
  dialogue: '#2ecc71',
  action: '#95a5a6',
  parenthetical: '#9b59b6',
  transition: '#e67e22',
};

export default function ScriptUploader() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const parseResult = await parser.parseFile(file);
      setResult(parseResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTextParse = async () => {
    const text = prompt('Paste screenplay text:');
    if (!text) return;

    setLoading(true);
    setError(null);

    try {
      const parseResult = await parser.parseText(text);
      setResult(parseResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <h2>Screenplay Parser</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.fountain,.fdx"
          onChange={handleFileUpload}
        />
        <button onClick={handleTextParse}>Paste Text</button>
      </div>

      {loading && <p>Parsing...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {result && (
        <div>
          <h3>
            {result.title} — {(result.confidence * 100).toFixed(1)}% confidence
          </h3>
          <p style={{ color: '#666' }}>
            {result.elements.length} elements | {result.characters.length} characters |{' '}
            {result.scenes.length} scenes | {result.duration}ms
          </p>

          {result.warnings.map((w, i) => (
            <p key={i} style={{ color: 'orange' }}>{w}</p>
          ))}

          <div>
            {result.elements.map((el, i) => (
              <div
                key={i}
                style={{
                  padding: '4px 8px',
                  margin: '2px 0',
                  borderLeft: `3px solid ${ELEMENT_COLORS[el.type] || '#ccc'}`,
                  background: el.flagged ? '#fff3cd' : 'transparent',
                }}
              >
                <strong>[{el.type}]</strong> {el.text}{' '}
                <span style={{ color: '#999', fontSize: '0.85em' }}>
                  ({(el.confidence * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
