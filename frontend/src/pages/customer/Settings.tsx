import React from 'react';
import { Moon, Info, Download } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/common/Card';
import { useVpn } from '../../hooks/useVpn';
import { Button } from '../../components/common/Button';

export function Settings() {
  const { downloadConfig } = useVpn();

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>

        <Card title="Appearance">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3 text-slate-300">
              <Moon className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Dark Mode</span>
            </div>
            <span className="text-xs text-slate-500">Always on</span>
          </div>
        </Card>

        <Card title="VPN Configuration">
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              Download your WireGuard config file to re-import it on another device or reinstall the
              VPN app.
            </p>
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={downloadConfig}
            >
              Download Config File
            </Button>
          </div>
        </Card>

        <Card title="About">
          <div className="space-y-2">
            <InfoItem label="App Version" value="1.0.0" />
            <InfoItem label="Protocol" value="WireGuard" />
            <InfoItem label="DNS" value="1.1.1.1 (Cloudflare)" />
          </div>
          <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              SecureVPN uses WireGuard, the fastest modern VPN protocol. Your keys are
              cryptographically generated and stored securely.
            </span>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-200 text-sm">{value}</span>
    </div>
  );
}
