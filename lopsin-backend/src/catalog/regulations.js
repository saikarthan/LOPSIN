/**
 * The Lopsin regulation intelligence catalog.
 *
 * Each framework holds controls; each control holds checks. A check is a pure
 * assertion over ONE declared signal key - never over customer data. This is what
 * the abstract calls "turning regulations into automated checks".
 *
 * Operators: eq | neq | gte | lte | gt | lt | oneOf | isTrue | isFalse
 */

export const FRAMEWORKS = [
  {
    code: 'GDPR',
    name: 'EU General Data Protection Regulation',
    region: 'European Union',
    version: '2016/679',
    authority: 'European Data Protection Board',
    summary:
      'Protection of natural persons with regard to the processing of personal data and the free movement of such data.',
    controls: [
      {
        code: 'GDPR-5',
        title: 'Principles relating to processing',
        requirement: 'Personal data must be kept no longer than necessary and processed securely.',
        checks: [
          {
            code: 'GDPR-5.1',
            title: 'Retention limit configured for personal data stores',
            severity: 'HIGH',
            signalKey: 'privacy.retention_policy_days',
            operator: 'lte',
            expected: 1095,
            rationale: 'Article 5(1)(e) storage limitation - indefinite retention is not defensible.',
            remediation: 'Set a maximum retention window (<= 36 months) on every personal data store and enable automatic expiry.',
          },
          {
            code: 'GDPR-5.2',
            title: 'Encryption at rest enabled across managed storage',
            severity: 'CRITICAL',
            signalKey: 'storage.encryption_at_rest',
            operator: 'isTrue',
            rationale: 'Article 5(1)(f) integrity and confidentiality.',
            remediation: 'Enable provider-managed or customer-managed encryption on every volume, bucket and database.',
          },
        ],
      },
      {
        code: 'GDPR-15',
        title: 'Rights of the data subject',
        requirement: 'Controllers must answer access, rectification and erasure requests within one month.',
        checks: [
          {
            code: 'GDPR-15.1',
            title: 'Data-subject-request workflow configured',
            severity: 'HIGH',
            signalKey: 'privacy.dsr_workflow_configured',
            operator: 'isTrue',
            rationale: 'Articles 15-22 require an operational route for data subjects to exercise rights.',
            remediation: 'Publish a DSR intake route and assign a named owner with an SLA timer.',
          },
          {
            code: 'GDPR-15.2',
            title: 'Median DSR response inside the one-month statutory window',
            severity: 'MEDIUM',
            signalKey: 'privacy.dsr_median_response_days',
            operator: 'lte',
            expected: 30,
            rationale: 'Article 12(3) sets one month as the default response deadline.',
            remediation: 'Automate DSR discovery and add escalation at day 20 to protect the statutory deadline.',
          },
        ],
      },
      {
        code: 'GDPR-30',
        title: 'Records of processing activities',
        requirement: 'Controllers and processors must maintain a record of processing activities.',
        checks: [
          {
            code: 'GDPR-30.1',
            title: 'Record of processing activities maintained',
            severity: 'MEDIUM',
            signalKey: 'privacy.ropa_maintained',
            operator: 'isTrue',
            rationale: 'Article 30 - the ROPA is the first artefact a supervisory authority asks for.',
            remediation: 'Generate the ROPA from the system inventory and review it every quarter.',
          },
          {
            code: 'GDPR-30.2',
            title: 'Processor agreements cover the vendor estate',
            severity: 'HIGH',
            signalKey: 'vendor.dpa_coverage_pct',
            operator: 'gte',
            expected: 95,
            rationale: 'Article 28 requires a written contract with every processor.',
            remediation: 'Close the DPA gap for uncovered processors or remove them from the data path.',
          },
        ],
      },
      {
        code: 'GDPR-33',
        title: 'Personal data breach notification',
        requirement: 'Breaches must be notified to the supervisory authority within 72 hours.',
        checks: [
          {
            code: 'GDPR-33.1',
            title: 'Breach-notification runbook reviewed in the last year',
            severity: 'HIGH',
            signalKey: 'privacy.breach_runbook_age_days',
            operator: 'lte',
            expected: 365,
            rationale: 'A stale runbook will not deliver a 72-hour notification.',
            remediation: 'Review and rehearse the 72-hour notification runbook, including the authority contact list.',
          },
          {
            code: 'GDPR-33.2',
            title: 'Audit logging enabled to support breach forensics',
            severity: 'HIGH',
            signalKey: 'logging.audit_log_enabled',
            operator: 'isTrue',
            rationale: 'Article 33(3) requires describing the nature and scale of a breach.',
            remediation: 'Enable control-plane audit logging and ship it to a retained, immutable store.',
          },
        ],
      },
      {
        code: 'GDPR-44',
        title: 'Transfers to third countries',
        requirement: 'Transfers outside the EEA need an adequacy decision or appropriate safeguards.',
        checks: [
          {
            code: 'GDPR-44.1',
            title: 'Cross-border transfer safeguards configured',
            severity: 'HIGH',
            signalKey: 'privacy.cross_border_transfer_controls',
            operator: 'isTrue',
            rationale: 'Chapter V - transfers without safeguards are unlawful.',
            remediation: 'Map every export destination and attach SCCs or an adequacy basis before data leaves the EEA.',
          },
        ],
      },
    ],
  },

  {
    code: 'DPDP',
    name: 'Digital Personal Data Protection Act',
    region: 'India',
    version: '2023',
    authority: 'Data Protection Board of India',
    summary:
      'Processing of digital personal data in India, built on notice, consent and the duties of a data fiduciary.',
    controls: [
      {
        code: 'DPDP-6',
        title: 'Consent',
        requirement: 'Consent must be free, specific, informed and withdrawable as easily as it was given.',
        checks: [
          {
            code: 'DPDP-6.1',
            title: 'Consent capture and withdrawal recorded',
            severity: 'CRITICAL',
            signalKey: 'privacy.consent_records_enabled',
            operator: 'isTrue',
            rationale: 'Section 6 - the fiduciary must be able to prove a valid consent artefact.',
            remediation: 'Record a timestamped consent artefact per purpose and expose a one-click withdrawal route.',
          },
        ],
      },
      {
        code: 'DPDP-8',
        title: 'Duties of a data fiduciary',
        requirement: 'Reasonable security safeguards must prevent personal data breaches.',
        checks: [
          {
            code: 'DPDP-8.1',
            title: 'Reasonable security safeguards - encryption at rest',
            severity: 'CRITICAL',
            signalKey: 'storage.encryption_at_rest',
            operator: 'isTrue',
            rationale: 'Section 8(5) places the safeguard duty on the fiduciary regardless of processor conduct.',
            remediation: 'Enable encryption at rest across the estate and evidence it from configuration state.',
          },
          {
            code: 'DPDP-8.2',
            title: 'Personal data erased after the retention purpose lapses',
            severity: 'HIGH',
            signalKey: 'privacy.retention_policy_days',
            operator: 'lte',
            expected: 1095,
            rationale: 'Section 8(7) requires erasure once the purpose is served.',
            remediation: 'Configure purpose-bound retention and automatic erasure jobs.',
          },
          {
            code: 'DPDP-8.3',
            title: 'No object store left publicly readable',
            severity: 'CRITICAL',
            signalKey: 'storage.public_buckets',
            operator: 'eq',
            expected: 0,
            rationale: 'A public bucket is the most common cause of a reportable breach.',
            remediation: 'Remove anonymous access and enable account-level public-access blocking.',
          },
        ],
      },
      {
        code: 'DPDP-10',
        title: 'Significant data fiduciary obligations',
        requirement: 'Significant fiduciaries must appoint a Data Protection Officer based in India.',
        checks: [
          {
            code: 'DPDP-10.1',
            title: 'Data protection or grievance officer designated',
            severity: 'MEDIUM',
            signalKey: 'privacy.dpo_designated',
            operator: 'isTrue',
            rationale: 'Sections 10 and 13 require a contactable officer for grievance redressal.',
            remediation: 'Designate the officer, publish the contact route and wire it to the DSR workflow.',
          },
        ],
      },
    ],
  },

  {
    code: 'HIPAA',
    name: 'HIPAA Security Rule',
    region: 'United States',
    version: '45 CFR Part 164',
    authority: 'HHS Office for Civil Rights',
    summary:
      'Administrative, physical and technical safeguards for electronic protected health information.',
    controls: [
      {
        code: 'HIPAA-164.312',
        title: 'Technical safeguards',
        requirement: 'Access control, audit control, integrity and transmission security for ePHI.',
        checks: [
          {
            code: 'HIPAA-164.312.a',
            title: 'Unique user identification and MFA on privileged access',
            severity: 'CRITICAL',
            signalKey: 'identity.mfa_enforced_admins',
            operator: 'isTrue',
            rationale: '164.312(a)(1) access control - shared or single-factor admin access fails the safeguard.',
            remediation: 'Enforce MFA on every administrative account and remove shared logins.',
          },
          {
            code: 'HIPAA-164.312.b',
            title: 'Record-level audit controls on PHI systems',
            severity: 'HIGH',
            signalKey: 'phi.access_audit_enabled',
            operator: 'isTrue',
            rationale: '164.312(b) requires recording activity in systems holding ePHI.',
            remediation: 'Enable record-level access auditing and retain the trail for six years.',
          },
          {
            code: 'HIPAA-164.312.e',
            title: 'Transmission security - modern TLS floor',
            severity: 'HIGH',
            signalKey: 'transport.tls_min_version',
            operator: 'oneOf',
            expected: ['1.2', '1.3'],
            rationale: '164.312(e)(1) transmission security.',
            remediation: 'Raise the TLS floor to 1.2 and disable legacy ciphers on every public listener.',
          },
        ],
      },
      {
        code: 'HIPAA-164.308',
        title: 'Administrative safeguards',
        requirement: 'Risk analysis, workforce access management and contingency planning.',
        checks: [
          {
            code: 'HIPAA-164.308.a4',
            title: 'Minimum-necessary role scoping enforced',
            severity: 'HIGH',
            signalKey: 'phi.minimum_necessary_controls',
            operator: 'isTrue',
            rationale: '164.308(a)(4) information access management.',
            remediation: 'Scope roles to the minimum necessary and review entitlements each quarter.',
          },
          {
            code: 'HIPAA-164.308.a7',
            title: 'Contingency plan - restore tested in the last 180 days',
            severity: 'MEDIUM',
            signalKey: 'backup.restore_test_age_days',
            operator: 'lte',
            expected: 180,
            rationale: '164.308(a)(7) requires a tested data recovery plan, not just backups.',
            remediation: 'Run and document a restore test at least twice a year.',
          },
          {
            code: 'HIPAA-164.308.b',
            title: 'Business associate agreements cover PHI vendors',
            severity: 'HIGH',
            signalKey: 'phi.baa_coverage_pct',
            operator: 'gte',
            expected: 100,
            rationale: '164.308(b)(1) - PHI may not be disclosed to a vendor without a BAA.',
            remediation: 'Execute a BAA with every vendor that touches PHI or cut the data flow.',
          },
        ],
      },
    ],
  },

  {
    code: 'SOC2',
    name: 'SOC 2 Trust Services Criteria',
    region: 'Global',
    version: '2017 (rev. 2022)',
    authority: 'AICPA',
    summary:
      'Criteria for security, availability, processing integrity, confidentiality and privacy of a service organisation.',
    controls: [
      {
        code: 'CC6',
        title: 'Logical and physical access controls',
        requirement: 'Access is restricted, reviewed and removed in a timely manner.',
        checks: [
          {
            code: 'CC6.1',
            title: 'Workforce SSO enabled',
            severity: 'HIGH',
            signalKey: 'identity.sso_enabled',
            operator: 'isTrue',
            rationale: 'CC6.1 - centralised identity is the precondition for provable access control.',
            remediation: 'Move all business applications behind the corporate identity provider.',
          },
          {
            code: 'CC6.2',
            title: 'Dormant accounts cleaned up',
            severity: 'MEDIUM',
            signalKey: 'identity.dormant_accounts_over_90d',
            operator: 'eq',
            expected: 0,
            rationale: 'CC6.2 - unused credentials are an unmanaged access path.',
            remediation: 'Disable accounts after 90 days of inactivity automatically.',
          },
          {
            code: 'CC6.3',
            title: 'Access revoked within 24 hours of exit',
            severity: 'HIGH',
            signalKey: 'access.offboarding_sla_hours',
            operator: 'lte',
            expected: 24,
            rationale: 'CC6.3 - timely removal of access on termination.',
            remediation: 'Trigger deprovisioning from the HR exit event rather than a manual ticket.',
          },
          {
            code: 'CC6.6',
            title: 'Perimeter defaults to deny',
            severity: 'HIGH',
            signalKey: 'network.firewall_default_deny',
            operator: 'isTrue',
            rationale: 'CC6.6 - boundary protection.',
            remediation: 'Switch the perimeter policy to default-deny and allow-list required flows.',
          },
          {
            code: 'CC6.7',
            title: 'No administrative ports exposed publicly',
            severity: 'CRITICAL',
            signalKey: 'network.open_admin_ports',
            operator: 'eq',
            expected: 0,
            rationale: 'Exposed SSH/RDP/database ports are a standing audit exception.',
            remediation: 'Move administrative access behind a bastion or zero-trust proxy.',
          },
        ],
      },
      {
        code: 'CC7',
        title: 'System operations',
        requirement: 'Vulnerabilities are detected, monitored and remediated.',
        checks: [
          {
            code: 'CC7.1',
            title: 'Authenticated vulnerability scan in the last 30 days',
            severity: 'MEDIUM',
            signalKey: 'vuln.scan_age_days',
            operator: 'lte',
            expected: 30,
            rationale: 'CC7.1 - detection of configuration and vulnerability drift.',
            remediation: 'Schedule authenticated scanning monthly and alert on scan failure.',
          },
          {
            code: 'CC7.2',
            title: 'No critical vulnerabilities past SLA',
            severity: 'CRITICAL',
            signalKey: 'vuln.critical_open_count',
            operator: 'eq',
            expected: 0,
            rationale: 'CC7.2 - anomalies must be remediated, not just observed.',
            remediation: 'Clear the overdue critical backlog and enforce the SLA in the ticket workflow.',
          },
          {
            code: 'CC7.3',
            title: 'Security alerting routed to on-call',
            severity: 'HIGH',
            signalKey: 'monitoring.alerting_enabled',
            operator: 'isTrue',
            rationale: 'CC7.3 - evaluation of security events.',
            remediation: 'Route detections to a paging destination with a documented response owner.',
          },
          {
            code: 'CC7.4',
            title: 'Incident response plan exercised in the last year',
            severity: 'MEDIUM',
            signalKey: 'incident.plan_test_age_days',
            operator: 'lte',
            expected: 365,
            rationale: 'CC7.4 - an untested plan is not a control.',
            remediation: 'Run a tabletop exercise annually and record the findings.',
          },
        ],
      },
      {
        code: 'CC8',
        title: 'Change management',
        requirement: 'Changes are authorised, designed, tested and approved before deployment.',
        checks: [
          {
            code: 'CC8.1',
            title: 'Peer review enforced on protected branches',
            severity: 'HIGH',
            signalKey: 'change.peer_review_required',
            operator: 'isTrue',
            rationale: 'CC8.1 - unreviewed change is the most common SOC 2 exception.',
            remediation: 'Enable branch protection requiring at least one independent approval.',
          },
          {
            code: 'CC8.2',
            title: 'Build artifacts signed',
            severity: 'MEDIUM',
            signalKey: 'change.pipeline_artifacts_signed',
            operator: 'isTrue',
            rationale: 'Artifact signing links a deployed binary to a reviewed commit.',
            remediation: 'Sign artifacts in CI and verify signatures at deploy time.',
          },
        ],
      },
      {
        code: 'A1',
        title: 'Availability',
        requirement: 'Recovery objectives are supported by tested backups.',
        checks: [
          {
            code: 'A1.2',
            title: 'Successful backup within the last 24 hours',
            severity: 'HIGH',
            signalKey: 'backup.last_success_age_hours',
            operator: 'lte',
            expected: 24,
            rationale: 'A1.2 - backup currency underpins the stated RPO.',
            remediation: 'Fix the failing backup job and alert on any missed window.',
          },
        ],
      },
    ],
  },

  {
    code: 'ISO27001',
    name: 'ISO/IEC 27001 Annex A',
    region: 'Global',
    version: '2022',
    authority: 'ISO/IEC',
    summary: 'Information security controls for an information security management system.',
    controls: [
      {
        code: 'A.5',
        title: 'Organisational controls',
        requirement: 'Policies, supplier relationships and incident management are governed.',
        checks: [
          {
            code: 'A.5.15',
            title: 'Access rights reviewed in the last 90 days',
            severity: 'MEDIUM',
            signalKey: 'access.privilege_review_age_days',
            operator: 'lte',
            expected: 90,
            rationale: 'A.5.15 access control and A.5.18 review of access rights.',
            remediation: 'Run a quarterly entitlement review with manager attestation.',
          },
          {
            code: 'A.5.23',
            title: 'Supplier data-processing agreements in place',
            severity: 'MEDIUM',
            signalKey: 'vendor.dpa_coverage_pct',
            operator: 'gte',
            expected: 90,
            rationale: 'A.5.23 information security for use of cloud services.',
            remediation: 'Track supplier agreements in the vendor register and close the gaps.',
          },
        ],
      },
      {
        code: 'A.8',
        title: 'Technological controls',
        requirement: 'Cryptography, logging, endpoint protection and secure configuration.',
        checks: [
          {
            code: 'A.8.1',
            title: 'Endpoint disk encryption coverage above 98 percent',
            severity: 'HIGH',
            signalKey: 'endpoint.disk_encryption_coverage_pct',
            operator: 'gte',
            expected: 98,
            rationale: 'A.8.1 user endpoint devices.',
            remediation: 'Enforce disk encryption by policy and quarantine non-compliant devices.',
          },
          {
            code: 'A.8.5',
            title: 'Strong authentication - password floor of 12 characters',
            severity: 'MEDIUM',
            signalKey: 'identity.password_min_length',
            operator: 'gte',
            expected: 12,
            rationale: 'A.8.5 secure authentication.',
            remediation: 'Raise the minimum password length to 12 and prefer passkeys or SSO.',
          },
          {
            code: 'A.8.15',
            title: 'Logging retained for at least 180 days',
            severity: 'MEDIUM',
            signalKey: 'logging.retention_days',
            operator: 'gte',
            expected: 180,
            rationale: 'A.8.15 logging - short retention defeats investigation.',
            remediation: 'Extend log retention to at least 180 days in the central store.',
          },
          {
            code: 'A.8.16',
            title: 'Audit trail protected against tampering',
            severity: 'HIGH',
            signalKey: 'logging.tamper_protection',
            operator: 'isTrue',
            rationale: 'A.8.16 monitoring activities rely on a trustworthy trail.',
            remediation: 'Write logs to an append-only or object-locked store.',
          },
          {
            code: 'A.8.24',
            title: 'Encryption keys rotated within 365 days',
            severity: 'MEDIUM',
            signalKey: 'storage.key_rotation_age_days',
            operator: 'lte',
            expected: 365,
            rationale: 'A.8.24 use of cryptography.',
            remediation: 'Enable automatic annual key rotation in the key management service.',
          },
          {
            code: 'A.8.23',
            title: 'HSTS enabled on public endpoints',
            severity: 'LOW',
            signalKey: 'transport.hsts_enabled',
            operator: 'isTrue',
            rationale: 'A.8.23 web filtering and secure transport defaults.',
            remediation: 'Serve HSTS with a long max-age on every public hostname.',
          },
        ],
      },
    ],
  },

  {
    code: 'EUAIACT',
    name: 'EU Artificial Intelligence Act',
    region: 'European Union',
    version: 'Regulation (EU) 2024/1689',
    authority: 'European AI Office',
    summary:
      'Risk-based obligations for providers and deployers of AI systems, from prohibited practices to high-risk duties.',
    controls: [
      {
        code: 'AIA-5',
        title: 'Prohibited AI practices',
        requirement: 'Certain practices, such as untargeted facial scraping and social scoring, are banned outright.',
        checks: [
          {
            code: 'AIA-5.1',
            title: 'Automated screening for prohibited practices active',
            severity: 'CRITICAL',
            signalKey: 'ai.prohibited_practice_scan',
            operator: 'isTrue',
            rationale: 'Article 5 - prohibited practices carry the highest penalty tier.',
            remediation: 'Screen every model use case against the Article 5 list before release.',
          },
        ],
      },
      {
        code: 'AIA-9',
        title: 'Risk management system',
        requirement: 'High-risk AI systems need a documented, maintained risk management system.',
        checks: [
          {
            code: 'AIA-9.1',
            title: 'Model inventory maintained',
            severity: 'HIGH',
            signalKey: 'ai.model_inventory_maintained',
            operator: 'isTrue',
            rationale: 'You cannot classify risk for systems you have not inventoried.',
            remediation: 'Register every deployed model with an owner, purpose and deployment surface.',
          },
          {
            code: 'AIA-9.2',
            title: 'Risk classification documented per system',
            severity: 'HIGH',
            signalKey: 'ai.risk_classification_documented',
            operator: 'isTrue',
            rationale: 'Article 6 classification drives every downstream obligation.',
            remediation: 'Document the risk tier for each system and re-assess on material change.',
          },
        ],
      },
      {
        code: 'AIA-12',
        title: 'Record-keeping and traceability',
        requirement: 'High-risk systems must log events automatically over their lifetime.',
        checks: [
          {
            code: 'AIA-12.1',
            title: 'Model input and output logging enabled',
            severity: 'HIGH',
            signalKey: 'ai.output_logging_enabled',
            operator: 'isTrue',
            rationale: 'Article 12 requires traceability of system operation.',
            remediation: 'Log request metadata, model version and decision outcome for every inference.',
          },
          {
            code: 'AIA-12.2',
            title: 'Training-data provenance recorded',
            severity: 'MEDIUM',
            signalKey: 'ai.training_data_provenance_logged',
            operator: 'isTrue',
            rationale: 'Article 10 data governance covers the origin and suitability of datasets.',
            remediation: 'Record dataset source, licence and preprocessing lineage per model version.',
          },
        ],
      },
      {
        code: 'AIA-14',
        title: 'Human oversight and transparency',
        requirement: 'High-risk systems must be overseeable by humans, and users must know they face an AI.',
        checks: [
          {
            code: 'AIA-14.1',
            title: 'Human oversight control point configured',
            severity: 'HIGH',
            signalKey: 'ai.human_oversight_configured',
            operator: 'isTrue',
            rationale: 'Article 14 human oversight.',
            remediation: 'Add a review or override step before any consequential automated decision.',
          },
          {
            code: 'AIA-50.1',
            title: 'AI transparency notice published',
            severity: 'MEDIUM',
            signalKey: 'ai.transparency_notice_published',
            operator: 'isTrue',
            rationale: 'Article 50 transparency obligations for systems interacting with people.',
            remediation: 'Disclose AI interaction in the interface and in the public notice.',
          },
        ],
      },
    ],
  },
]

export const SEVERITY_WEIGHT = { CRITICAL: 10, HIGH: 6, MEDIUM: 3, LOW: 1 }
export const SEVERITIES = Object.keys(SEVERITY_WEIGHT)

/** Flattens the nested catalog into the check documents the engine evaluates. */
export function flattenChecks() {
  const checks = []
  for (const framework of FRAMEWORKS) {
    for (const control of framework.controls) {
      for (const check of control.checks) {
        checks.push({
          id: check.code,
          code: check.code,
          frameworkCode: framework.code,
          frameworkName: framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          title: check.title,
          severity: check.severity,
          signalKey: check.signalKey,
          operator: check.operator,
          expected: check.expected ?? null,
          rationale: check.rationale,
          remediation: check.remediation,
          enabled: true,
        })
      }
    }
  }
  return checks
}

export function frameworkDocuments() {
  return FRAMEWORKS.map((framework) => ({
    id: framework.code,
    code: framework.code,
    name: framework.name,
    region: framework.region,
    version: framework.version,
    authority: framework.authority,
    summary: framework.summary,
    controlCount: framework.controls.length,
    checkCount: framework.controls.reduce((total, control) => total + control.checks.length, 0),
    controls: framework.controls.map((control) => ({
      code: control.code,
      title: control.title,
      requirement: control.requirement,
      checkCodes: control.checks.map((check) => check.code),
    })),
  }))
}
