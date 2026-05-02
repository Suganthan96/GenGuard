'use client';

import React, { useState, useEffect, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Guardian {
  id: string;
  address: string;
  ensName?: string;
  role: string;
  status: 'active' | 'inactive' | 'syncing';
  model: string;
  version: string;
  capabilities?: string[];
  verifiedAt?: string;
}

interface ENSMetadata {
  [key: string]: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function shortAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function statusConfig(status: Guardian['status']) {
  switch (status) {
    case 'active':
      return { dot: 'bg-emerald-400', label: 'Active', ring: 'ring-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-300' };
    case 'syncing':
      return { dot: 'bg-amber-400 animate-pulse', label: 'Syncing', ring: 'ring-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-300' };
    default:
      return { dot: 'bg-zinc-500', label: 'Inactive', ring: 'ring-zinc-500/30', bg: 'bg-zinc-500/10', text: 'text-zinc-400' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENS Badge — the verified identity indicator
// ─────────────────────────────────────────────────────────────────────────────

function ENSBadge({ verified, ensName }: { verified: boolean; ensName: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`
          w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold
          ${verified
            ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.4)]'
            : 'bg-zinc-700 text-zinc-400'}
        `}
      >
        {verified ? '✓' : '?'}
      </div>
      <span className="text-[10px] tracking-wider text-zinc-500 uppercase">
        {verified ? 'Verified' : 'Unverified'}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GuardianENSCard
// ─────────────────────────────────────────────────────────────────────────────

export function GuardianENSCard({ guardian }: { guardian: Guardian }) {
  const [metadata, setMetadata] = useState<ENSMetadata>({});
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [hovered, setHovered] = useState(false);

  const hasENS = !!guardian.ensName;
  const displayName = guardian.ensName || guardian.id;
  const sts = statusConfig(guardian.status);

  // Simulate ENS metadata load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasENS) {
        setMetadata({
          'guardian.role': guardian.role,
          'guardian.model': guardian.model,
          'guardian.version': guardian.version,
        });
        setVerified(true);
      }
      setLoading(false);
    }, 800 + Math.random() * 600);
    return () => clearTimeout(timer);
  }, [guardian, hasENS]);

  return (
    <div
      id={`guardian-card-${guardian.id}`}
      className="group relative rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        background: 'linear-gradient(145deg, rgba(24,24,27,0.95), rgba(9,9,11,0.98))',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: hovered
          ? '0 0 40px rgba(99,102,241,0.08), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 4px 24px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top gradient bar */}
      <div
        className="h-[2px] w-full"
        style={{
          background: hasENS
            ? 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)'
            : 'linear-gradient(90deg, #3f3f46, #52525b)',
        }}
      />

      <div className="p-6 space-y-5">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div className="space-y-2 min-w-0 flex-1">
            {/* ENS Name */}
            <div className="flex items-center gap-2 min-w-0">
              {hasENS && (
                <span className="text-indigo-400 text-sm flex-shrink-0">◆</span>
              )}
              <h3 className="text-lg font-medium text-zinc-100 truncate tracking-tight">
                {displayName}
              </h3>
            </div>

            {/* Address + verification */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-zinc-500 tracking-wide">
                {shortAddress(guardian.address)}
              </span>
              {hasENS && <ENSBadge verified={verified} ensName={guardian.ensName!} />}
            </div>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${sts.bg}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${sts.dot}`} />
            <span className={`text-[10px] tracking-wider uppercase font-medium ${sts.text}`}>
              {sts.label}
            </span>
          </div>
        </div>

        {/* ── Details Grid ───────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-3 gap-3 pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          {[
            { label: 'Role', value: guardian.role },
            { label: 'Model', value: guardian.model },
            { label: 'Version', value: `v${guardian.version}` },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                {item.label}
              </p>
              <p className="text-xs text-zinc-300 font-medium truncate">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── ENS Metadata Records ───────────────────────────────────────── */}
        {loading ? (
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-3 rounded bg-zinc-800 animate-pulse"
                style={{ width: `${60 + i * 10}%`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        ) : (
          Object.keys(metadata).length > 0 && (
            <div
              className="rounded-lg p-3 space-y-1.5"
              style={{
                background: 'rgba(99,102,241,0.04)',
                border: '1px solid rgba(99,102,241,0.08)',
              }}
            >
              <p className="text-[9px] text-indigo-400/60 uppercase tracking-[0.2em] mb-2">
                ENS Text Records
              </p>
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-[11px]">
                  <span className="font-mono text-zinc-500 flex-shrink-0">
                    {key.replace('guardian.', '')}
                  </span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-zinc-300 truncate">{value}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Capabilities ───────────────────────────────────────────────── */}
        {guardian.capabilities && guardian.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {guardian.capabilities.map((cap) => (
              <span
                key={cap}
                className="px-2 py-0.5 rounded text-[10px] tracking-wider text-zinc-400 font-medium"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {hasENS && (
          <div
            className="flex items-center justify-between pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <a
              href={`https://app.ens.domains/${guardian.ensName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-indigo-400/70 hover:text-indigo-300 transition-colors tracking-wide flex items-center gap-1"
            >
              View on ENS
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
            <span className="text-[10px] text-zinc-700 font-mono">
              node: {guardian.ensName ? `${guardian.ensName.slice(0, 8)}…` : '—'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GuardianENSList — grid of cards
// ─────────────────────────────────────────────────────────────────────────────

export function GuardianENSList({ guardians }: { guardians: Guardian[] }) {
  return (
    <div id="guardian-ens-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {guardians.map((g) => (
        <GuardianENSCard key={g.id} guardian={g} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GuardianENSSection — self-contained section for the landing page
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_GUARDIANS: Guardian[] = [
  {
    id: 'guardian-1',
    address: '0x225f137127d9067788314bc7fcc1f36746a3c3B5',
    ensName: 'guardian-1.guardmesh.eth',
    role: 'code_analysis_only',
    status: 'active',
    model: 'qwen-2.5-7b',
    version: '1.0.0',
    capabilities: ['role_check', 'permission_check', 'content_check'],
  },
  {
    id: 'guardian-2',
    address: '0x3a8E02d5E64Bf6d9C7A44DC89E3bB0f4F1C5a2D3',
    ensName: 'guardian-2.guardmesh.eth',
    role: 'data_access_audit',
    status: 'active',
    model: 'llama-3.3-70b',
    version: '1.0.0',
    capabilities: ['role_check', 'data_scope_check'],
  },
  {
    id: 'guardian-3',
    address: '0x7B2f41C94aD6E1bF83c0E9d2fA53B8C4e7D0F123',
    ensName: 'guardian-3.guardmesh.eth',
    role: 'intent_verification',
    status: 'syncing',
    model: 'qwen-2.5-7b',
    version: '1.0.0',
    capabilities: ['intent_evaluation', 'policy_verification'],
  },
];

export function GuardianENSSection() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="ens-guardians"
      className="py-24 px-6 md:px-12 lg:px-20"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-12 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400 text-lg">◆</span>
            <span className="text-[11px] tracking-[0.25em] text-zinc-500 uppercase font-medium">
              ENS Identity
            </span>
          </div>
          <h2
            className="text-3xl md:text-4xl font-light text-zinc-100 tracking-tight leading-tight"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            Human-readable names<br />
            for every guardian.
          </h2>
          <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
            Each guardian registers as a subname of{' '}
            <span className="text-indigo-400/80 font-mono">guardmesh.eth</span>
            , making agents discoverable, verifiable, and interoperable with the ENS ecosystem.
          </p>
        </div>

        {/* Guardian cards */}
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'all 1s cubic-bezier(0.16,1,0.3,1) 200ms',
          }}
        >
          <GuardianENSList guardians={DEMO_GUARDIANS} />
        </div>

        {/* Bottom stats */}
        <div
          className="mt-10 flex items-center gap-8"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 600ms',
          }}
        >
          {[
            { value: '3', label: 'ENS Identities' },
            { value: '100%', label: 'Verified' },
            { value: '0G', label: 'Chain Anchored' },
          ].map((stat) => (
            <div key={stat.label}>
              <span className="text-xl text-zinc-200 font-light">{stat.value}</span>
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest ml-2">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GuardianENSCard;
