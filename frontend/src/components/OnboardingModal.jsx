import React, { useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { Coffee, Moon, Flame, Smile, ChevronLeft } from 'lucide-react';

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Children', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Fantasy', 'Film-Noir', 'Horror', 'IMAX',
  'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
];

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'Korean', 'Japanese', 'German', 'Italian', 'Portuguese', 'Arabic'];

const MOODS = [
  { key: 'Light', icon: Coffee, desc: 'Feel-good, easy watching' },
  { key: 'Dark', icon: Moon, desc: 'Intense, thought-provoking' },
  { key: 'Thriller-heavy', icon: Flame, desc: 'Edge of your seat' },
  { key: 'Comedy-heavy', icon: Smile, desc: 'Laughs only' }
];

const OnboardingModal = () => {
  const { updatePreferences, loading } = usePreferences();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // State
  const [genres, setGenres] = useState(new Set());
  const [languages, setLanguages] = useState(new Set());
  const [contentType, setContentType] = useState('Movies');
  const [runtime, setRuntime] = useState('Medium');
  const [mood, setMood] = useState('Light');

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await updatePreferences({
        preferred_genres: Array.from(genres),
        favorite_languages: Array.from(languages),
        content_type: contentType,
        mood_preference: mood,
        runtime_preference: runtime,
        onboarding_complete: true
      });
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

  const toggleSet = (set, setFn, item) => {
    const nextSet = new Set(set);
    if (nextSet.has(item)) nextSet.delete(item);
    else nextSet.add(item);
    setFn(nextSet);
  };

  if (loading) return null;

  const chipClass = (active) => `px-sm h-control-sm rounded-xs text-small font-medium border transition-colors duration-fast ${active
    ? 'bg-accent border-accent text-accent-ink'
    : 'bg-transparent border-line text-fg-muted hover:text-fg hover:border-line-strong'}`;

  const segmentClass = (active) => `flex-1 rounded-xs text-small font-medium border transition-colors duration-fast ${active
    ? 'bg-fg border-fg text-ink'
    : 'bg-transparent border-line text-fg-muted hover:text-fg hover:border-line-strong'}`;

  return (
    <div data-onboarding className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-scrim p-0 sm:p-md animate-fade">
      <div className="bg-surface border border-line-strong rounded-t-md sm:rounded-md w-full sm:max-w-modal mx-auto overflow-hidden flex flex-col h-sheet-h sm:h-modal-h max-h-modal-h transition-colors duration-base animate-rise">
        {/* Header - Progress */}
        <div className="px-lg pt-lg pb-md border-b border-line shrink-0">
          <div className="flex justify-between items-baseline mb-md">
            <span className="label text-fg-subtle">
              <span className="text-accent">Setup</span> / Step {step} of 3
            </span>
            <span className="font-mono text-micro text-fg-subtle tabular-nums">0{step}/03</span>
          </div>
          <h2 className="font-display text-heading text-fg tracking-tight mb-md">
            {step === 1 && "What do you love watching?"}
            {step === 2 && "Customize your experience"}
            {step === 3 && "What's your usual mood?"}
          </h2>
          <div className="flex gap-2xs" aria-hidden="true">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex-1 h-rule transition-colors duration-slow ${i <= step ? 'bg-accent' : 'bg-line'}`} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-lg flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-md animate-fade">
              <p className="text-fg-muted text-small">
                Pick at least 3 genres you enjoy the most.
                <span className="font-mono text-micro text-fg-subtle ml-xs">({genres.size} picked)</span>
              </p>
              <div className="flex flex-wrap gap-xs">
                {GENRES.map(g => {
                  const active = genres.has(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggleSet(genres, setGenres, g)}
                      aria-pressed={active}
                      className={chipClass(active)}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-xl animate-fade">
              {/* Languages */}
              <div className="space-y-sm">
                <label className="label text-fg-muted">Favorite Languages</label>
                <div className="flex flex-wrap gap-xs">
                  {LANGUAGES.map(l => {
                    const active = languages.has(l);
                    return (
                      <button
                        key={l}
                        onClick={() => toggleSet(languages, setLanguages, l)}
                        aria-pressed={active}
                        className={chipClass(active)}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Type */}
              <div className="space-y-sm">
                <label className="label text-fg-muted">Content Preference</label>
                <div className="flex gap-xs">
                  {['Movies', 'Series', 'Both'].map(type => (
                    <button
                      key={type}
                      onClick={() => setContentType(type)}
                      className={`${segmentClass(contentType === type)} h-control`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Runtime Preference */}
              <div className="space-y-sm">
                <label className="label text-fg-muted">Runtime Preference</label>
                <div className="flex gap-xs">
                  {['Short', 'Medium', 'Long'].map(rt => (
                    <button
                      key={rt}
                      onClick={() => setRuntime(rt)}
                      className={`${segmentClass(runtime === rt)} py-xs`}
                    >
                      {rt}
                      <span className={`block font-mono text-micro mt-3xs ${runtime === rt ? 'text-ink' : 'text-fg-subtle'}`}>
                        {rt === 'Short' && '< 90m'}
                        {rt === 'Medium' && '90-120m'}
                        {rt === 'Long' && '2h+'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-md animate-fade">
              <p className="text-fg-muted text-small">Select the mood you usually lean towards.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
                {/* eslint-disable-next-line no-unused-vars */}
                {MOODS.map(({ key, icon: Icon, desc }) => {
                  const active = mood === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setMood(key)}
                      aria-pressed={active}
                      className={`p-md text-left rounded-sm transition-colors duration-fast border flex flex-row sm:flex-col gap-sm items-center sm:items-start ${active ? 'bg-accent-wash border-accent' : 'bg-transparent border-line hover:border-line-strong'}`}
                    >
                      <Icon size={22} strokeWidth={1.5} className={active ? 'text-accent' : 'text-fg-subtle'} />
                      <div>
                        <div className={`font-display text-title ${active ? 'text-fg' : 'text-fg-muted'}`}>{key}</div>
                        <div className="text-caption text-fg-subtle mt-3xs">{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-lg py-md border-t border-line shrink-0 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={handleBack}
                disabled={submitting}
                className="flex items-center gap-2xs label text-fg-muted hover:text-fg transition-colors duration-fast"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 && genres.size < 3}
              className="px-lg h-control bg-accent text-accent-ink text-small font-semibold rounded-sm hover:bg-accent-strong transition-colors duration-fast disabled:opacity-disabled disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-lg h-control bg-accent text-accent-ink text-small font-semibold rounded-sm hover:bg-accent-strong transition-colors duration-fast disabled:opacity-disabled flex items-center gap-xs"
            >
              {submitting ? 'Saving...' : 'Start Watching'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
