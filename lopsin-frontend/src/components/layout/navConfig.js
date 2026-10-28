const DASHBOARD = { to: '/app/dashboard', label: 'Posture Dashboard', icon: '▣' }
const FINDINGS = { to: '/app/findings', label: 'Findings', icon: '▥' }
const FRAMEWORKS = { to: '/app/frameworks', label: 'Frameworks', icon: '▤' }
const EVIDENCE = { to: '/app/evidence', label: 'Evidence Register', icon: '▦' }
const READINESS = { to: '/app/readiness', label: 'Audit Readiness', icon: '▧' }
const AUDIT = { to: '/app/audit-log', label: 'Activity Log', icon: '▨' }

export const NAV_CONFIG = {
  ADMIN: [
    { section: 'Overview', links: [DASHBOARD, FINDINGS, FRAMEWORKS] },
    {
      section: 'Connection',
      links: [
        { to: '/app/agents', label: 'Agents', icon: '▩' },
        { to: '/app/integrations', label: 'Integrations', icon: '▤' },
      ],
    },
    { section: 'Assurance', links: [EVIDENCE, READINESS] },
    {
      section: 'Administration',
      links: [{ to: '/app/users', label: 'Team Access', icon: '▣' }, AUDIT],
    },
  ],
  COMPLIANCE: [
    { section: 'Overview', links: [DASHBOARD, FINDINGS, FRAMEWORKS] },
    {
      section: 'Response',
      links: [{ to: '/app/remediation', label: 'Remediation', icon: '▧' }],
    },
    { section: 'Assurance', links: [EVIDENCE, READINESS, AUDIT] },
  ],
  AUDITOR: [
    { section: 'Overview', links: [DASHBOARD, FINDINGS, FRAMEWORKS] },
    { section: 'Assurance', links: [EVIDENCE, READINESS, AUDIT] },
  ],
}

export const REMEDIATION_LINK = { to: '/app/remediation', label: 'Remediation', icon: '▧' }

// The admin console also needs the remediation board.
NAV_CONFIG.ADMIN[1].links.push(REMEDIATION_LINK)
