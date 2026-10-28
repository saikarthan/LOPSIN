/**
 * The Lopsin signal contract.
 *
 * Every key an agent is allowed to report is declared here, with its type and a
 * plain-language description. This list IS the zero-data-access boundary: the
 * ingest endpoint refuses any key that is not on it, so an agent cannot forward
 * customer records, file contents or personal data even if it wanted to.
 */
export const SIGNAL_CATALOG = [
  // ---- Identity & access ----
  { key: 'identity.mfa_enforced_admins', type: 'boolean', description: 'MFA is enforced for every administrative account' },
  { key: 'identity.sso_enabled', type: 'boolean', description: 'Workforce SSO is enabled for the tenant' },
  { key: 'identity.password_min_length', type: 'number', unit: 'characters', description: 'Minimum password length in the identity policy' },
  { key: 'identity.dormant_accounts_over_90d', type: 'number', unit: 'accounts', description: 'Enabled accounts with no sign-in for 90 days or more' },
  { key: 'access.privilege_review_age_days', type: 'number', unit: 'days', description: 'Days since the last least-privilege access review' },
  { key: 'access.offboarding_sla_hours', type: 'number', unit: 'hours', description: 'Measured time to revoke access after an exit ticket' },

  // ---- Data protection ----
  { key: 'storage.encryption_at_rest', type: 'boolean', description: 'All managed volumes and buckets report encryption at rest' },
  { key: 'storage.public_buckets', type: 'number', unit: 'buckets', description: 'Object stores reachable anonymously from the internet' },
  { key: 'storage.key_rotation_age_days', type: 'number', unit: 'days', description: 'Age of the oldest active data-encryption key' },
  { key: 'transport.tls_min_version', type: 'string', description: 'Lowest TLS version accepted by public listeners' },
  { key: 'transport.hsts_enabled', type: 'boolean', description: 'HSTS is served on all public HTTPS endpoints' },
  { key: 'endpoint.disk_encryption_coverage_pct', type: 'number', unit: 'percent', description: 'Share of managed endpoints with full-disk encryption' },

  // ---- Logging, monitoring, resilience ----
  { key: 'logging.audit_log_enabled', type: 'boolean', description: 'Control-plane audit logging is switched on' },
  { key: 'logging.retention_days', type: 'number', unit: 'days', description: 'Retention period configured for audit logs' },
  { key: 'logging.tamper_protection', type: 'boolean', description: 'Audit log store is append-only or immutable' },
  { key: 'monitoring.alerting_enabled', type: 'boolean', description: 'Security alerting routes to an on-call destination' },
  { key: 'backup.last_success_age_hours', type: 'number', unit: 'hours', description: 'Age of the most recent successful backup' },
  { key: 'backup.restore_test_age_days', type: 'number', unit: 'days', description: 'Days since the last verified restore test' },
  { key: 'incident.plan_test_age_days', type: 'number', unit: 'days', description: 'Days since the incident-response plan was last exercised' },

  // ---- Vulnerability & change management ----
  { key: 'vuln.critical_open_count', type: 'number', unit: 'findings', description: 'Open critical vulnerabilities past their remediation SLA' },
  { key: 'vuln.scan_age_days', type: 'number', unit: 'days', description: 'Days since the last authenticated vulnerability scan' },
  { key: 'change.peer_review_required', type: 'boolean', description: 'Branch protection requires peer review before merge' },
  { key: 'change.pipeline_artifacts_signed', type: 'boolean', description: 'Build artifacts are cryptographically signed' },
  { key: 'network.firewall_default_deny', type: 'boolean', description: 'Perimeter policy defaults to deny' },
  { key: 'network.open_admin_ports', type: 'number', unit: 'ports', description: 'Administrative ports exposed to the public internet' },

  // ---- Privacy programme ----
  { key: 'privacy.dsr_workflow_configured', type: 'boolean', description: 'A data-subject-request workflow exists and has an owner' },
  { key: 'privacy.dsr_median_response_days', type: 'number', unit: 'days', description: 'Median time taken to close a data-subject request' },
  { key: 'privacy.retention_policy_days', type: 'number', unit: 'days', description: 'Maximum retention configured for personal data stores' },
  { key: 'privacy.consent_records_enabled', type: 'boolean', description: 'Consent capture and withdrawal are recorded per data subject' },
  { key: 'privacy.cross_border_transfer_controls', type: 'boolean', description: 'Transfer safeguards such as SCCs or adequacy mapping are configured' },
  { key: 'privacy.breach_runbook_age_days', type: 'number', unit: 'days', description: 'Days since the breach-notification runbook was reviewed' },
  { key: 'privacy.ropa_maintained', type: 'boolean', description: 'A record of processing activities is maintained and current' },
  { key: 'privacy.dpo_designated', type: 'boolean', description: 'A data protection or grievance officer is designated' },
  { key: 'vendor.dpa_coverage_pct', type: 'number', unit: 'percent', description: 'Share of processors covered by a signed data-processing agreement' },

  // ---- Healthcare ----
  { key: 'phi.access_audit_enabled', type: 'boolean', description: 'Record-level access auditing is enabled on PHI systems' },
  { key: 'phi.minimum_necessary_controls', type: 'boolean', description: 'Role scoping enforces the minimum-necessary standard' },
  { key: 'phi.baa_coverage_pct', type: 'number', unit: 'percent', description: 'Share of PHI vendors under a business associate agreement' },

  // ---- AI governance ----
  { key: 'ai.model_inventory_maintained', type: 'boolean', description: 'Every deployed model is registered in an inventory' },
  { key: 'ai.risk_classification_documented', type: 'boolean', description: 'Each system carries a documented risk classification' },
  { key: 'ai.human_oversight_configured', type: 'boolean', description: 'High-risk systems have a human-in-the-loop control point' },
  { key: 'ai.training_data_provenance_logged', type: 'boolean', description: 'Training-data provenance and licensing are recorded' },
  { key: 'ai.output_logging_enabled', type: 'boolean', description: 'Model inputs and outputs are logged as metadata for traceability' },
  { key: 'ai.prohibited_practice_scan', type: 'boolean', description: 'Automated screening for prohibited AI practices is active' },
  { key: 'ai.transparency_notice_published', type: 'boolean', description: 'Users are told when they are interacting with an AI system' },
]

export const SIGNAL_INDEX = new Map(SIGNAL_CATALOG.map((signal) => [signal.key, signal]))

export function isKnownSignal(key) {
  return SIGNAL_INDEX.has(key)
}
