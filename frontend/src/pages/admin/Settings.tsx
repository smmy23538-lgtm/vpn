import React, { useEffect, useState, useCallback } from 'react';
import { Save, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

interface Setting {
  key: string;
  value: string;
  label: string;
  group_name: string;
}

type SettingsMap = Record<string, string>;

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

export function Settings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [edits, setEdits] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<Setting[]>('/settings');
    setSettings(data);
    const initial: SettingsMap = {};
    data.forEach((s) => { initial[s.key] = s.value; });
    setEdits(initial);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', edits);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } finally { setSaving(false); }
  };

  const hasChanges = settings.some((s) => edits[s.key] !== s.value);

  const grouped = groupBy(settings, (s) => s.group_name);
  const groups = Object.entries(grouped);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
            <p className="text-slate-400 text-sm">Application configuration</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button
              icon={<Save className="w-4 h-4" />}
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
              variant={saved ? 'success' : 'primary'}
            >
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-slate-800 border border-slate-700 rounded-xl animate-pulse" />)}
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <SettingsIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No settings found. Run the database migration to seed defaults.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map(([group, items]) => (
              <div key={group} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-700 bg-slate-800/80">
                  <h2 className="text-slate-200 font-semibold capitalize text-sm">{group.replace(/_/g, ' ')}</h2>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {items.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-6 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-slate-200 text-sm font-medium">{s.label}</p>
                        <p className="text-slate-500 text-xs font-mono mt-0.5">{s.key}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {isBoolean(s.value) ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={edits[s.key] === 'true'}
                              onChange={(e) => setEdits((v) => ({ ...v, [s.key]: String(e.target.checked) }))}
                            />
                            <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer
                              peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full
                              peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px]
                              after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full
                              after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
                          </label>
                        ) : isNumber(s.value) ? (
                          <input
                            type="number"
                            value={edits[s.key] ?? ''}
                            onChange={(e) => setEdits((v) => ({ ...v, [s.key]: e.target.value }))}
                            className="w-28 bg-slate-900 border border-slate-600 rounded-lg py-1.5 px-2.5 text-slate-100 text-sm
                              focus:outline-none focus:ring-2 focus:ring-brand-500 text-right"
                          />
                        ) : (
                          <input
                            type="text"
                            value={edits[s.key] ?? ''}
                            onChange={(e) => setEdits((v) => ({ ...v, [s.key]: e.target.value }))}
                            className="w-56 bg-slate-900 border border-slate-600 rounded-lg py-1.5 px-2.5 text-slate-100 text-sm
                              focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasChanges && !saving && (
          <div className="fixed bottom-6 right-6 z-10">
            <Button icon={<Save className="w-4 h-4" />} onClick={handleSave} loading={saving} size="lg">
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function isBoolean(v: string) { return v === 'true' || v === 'false'; }
function isNumber(v: string) { return !isNaN(Number(v)) && v.trim() !== '' && !v.includes(' '); }
