import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, ExternalLink, ChevronRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface SetupWizardProps {
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
}

const steps = [
  {
    title: 'Install WireGuard',
    icon: Smartphone,
    content: (
      <div className="space-y-3">
        <p className="text-slate-300 text-sm">
          SecureVPN uses WireGuard — a fast, modern VPN protocol. Install the app for your device:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'iOS / iPhone', url: 'https://apps.apple.com/app/wireguard/id1441195209' },
            { label: 'Android', url: 'https://play.google.com/store/apps/details?id=com.wireguard.android' },
            { label: 'Windows', url: 'https://download.wireguard.com/windows-client/wireguard-installer.exe' },
            { label: 'macOS', url: 'https://apps.apple.com/app/wireguard/id1451685025' },
          ].map(({ label, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg
                         bg-slate-700 border border-slate-600 text-slate-200 text-sm
                         hover:bg-slate-600 transition"
            >
              {label}
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          ))}
        </div>
        <p className="text-slate-400 text-xs">Already installed? Skip to the next step.</p>
      </div>
    ),
  },
  {
    title: 'Download Your Config',
    icon: Download,
    content: (downloadConfig: () => void) => (
      <div className="space-y-4">
        <p className="text-slate-300 text-sm">
          Download your personal VPN configuration file. This file is unique to your account.
        </p>
        <div className="bg-slate-700/60 border border-slate-600 rounded-lg p-4 text-sm text-slate-300 space-y-2">
          <p className="font-medium text-slate-200">What happens when you connect?</p>
          <ul className="space-y-1 text-slate-400">
            <li>• Your traffic is encrypted end-to-end</li>
            <li>• Your real IP is hidden</li>
            <li>• DNS is routed through our server</li>
          </ul>
        </div>
        <Button
          size="lg"
          className="w-full justify-center"
          onClick={downloadConfig}
          icon={<Download className="w-5 h-5" />}
        >
          Download securevpn.conf
        </Button>
      </div>
    ),
  },
  {
    title: 'Import & Connect',
    icon: CheckCircle2,
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 text-sm">
          Import the config into the WireGuard app to connect:
        </p>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Open the WireGuard app on your device' },
            { step: '2', text: 'Tap "+" or "Add a tunnel"' },
            { step: '3', text: 'Choose "Import from file" and select securevpn.conf' },
            { step: '4', text: 'Tap the toggle to connect' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {step}
              </span>
              <p className="text-slate-300 text-sm pt-0.5">{text}</p>
            </div>
          ))}
        </div>
        <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg px-4 py-3 text-sm text-emerald-300">
          Once connected, your VPN status will update automatically on the dashboard.
        </div>
      </div>
    ),
  },
];

export function SetupWizard({ open, onClose, onDownload }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="VPN Setup" size="md">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <button
              onClick={() => setStep(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition
                ${i === step
                  ? 'bg-brand-600 text-white'
                  : i < step
                  ? 'bg-emerald-600/40 text-emerald-400 border border-emerald-600'
                  : 'bg-slate-700 text-slate-400'}`}
            >
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-brand-600' : 'bg-slate-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="mb-6">
        <h3 className="text-slate-100 font-semibold mb-4 flex items-center gap-2">
          <current.icon className="w-5 h-5 text-brand-400" />
          {current.title}
        </h3>
        {typeof current.content === 'function' ? current.content(onDownload) : current.content}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} className="flex-1 justify-center">
            Back
          </Button>
        )}
        {isLast ? (
          <Button onClick={handleClose} className="flex-1 justify-center" variant="success">
            Done
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)} className="flex-1 justify-center" icon={<ChevronRight className="w-4 h-4" />}>
            Next
          </Button>
        )}
      </div>
    </Modal>
  );
}
