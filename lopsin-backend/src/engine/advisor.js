import { config } from '../config/env.js'

/**
 * AI remediation advisor.
 *
 * Optional layer over the intelligence engine: it turns a failing control into a
 * concrete, ordered remediation plan. It is bound by the same zero-data-access
 * rule as the rest of the platform - the prompt carries the control text and a
 * single scalar observation, never customer data, hostnames or identifiers.
 *
 * If no key is configured, or the provider is unreachable, the platform falls
 * back to the catalog guidance so the feature can never break a page.
 */

const ENDPOINTS = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
}

const TIMEOUT_MS = 12000

let keyCursor = 0

/** Round-robins the configured keys so one demo key is not rate-limited alone. */
function nextKey() {
  const keys = config.llmApiKeys
  if (!keys.length) return null
  const key = keys[keyCursor % keys.length]
  keyCursor += 1
  return key
}

export function advisorStatus() {
  return {
    enabled: config.llmApiKeys.length > 0,
    provider: config.llmProvider,
    model: config.llmModel,
    keyPoolSize: config.llmApiKeys.length,
  }
}

function buildPrompt(finding) {
  return [
    {
      role: 'system',
      content:
        'You are a compliance remediation engineer. You are given one failing control from a ' +
        'configuration audit. Reply with a numbered plan of at most four concrete engineering steps, ' +
        'then a final line beginning "Evidence:" naming the configuration state that would prove the ' +
        'fix. Be specific and terse. Never invent customer names, hostnames or data.',
    },
    {
      role: 'user',
      content: [
        `Framework: ${finding.frameworkCode} (control ${finding.controlCode})`,
        `Control: ${finding.title}`,
        `Why it matters: ${finding.rationale}`,
        `Observed configuration value: ${JSON.stringify(finding.observed)}`,
        `Required: ${finding.expected}`,
        `Baseline guidance: ${finding.remediation}`,
      ].join('\n'),
    },
  ]
}

export async function draftRemediationPlan(finding) {
  const key = nextKey()
  const endpoint = ENDPOINTS[config.llmProvider]

  if (!key || !endpoint) {
    return { source: 'CATALOG', plan: finding.remediation, model: null }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: config.llmModel,
        messages: buildPrompt(finding),
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.warn(`[advisor] provider returned ${response.status}: ${detail.slice(0, 200)}`)
      return { source: 'CATALOG', plan: finding.remediation, model: null, fallbackReason: `provider_${response.status}` }
    }

    const payload = await response.json()
    const plan = payload?.choices?.[0]?.message?.content?.trim()
    if (!plan) return { source: 'CATALOG', plan: finding.remediation, model: null, fallbackReason: 'empty_response' }

    return { source: 'AI', plan, model: config.llmModel }
  } catch (error) {
    console.warn(`[advisor] unavailable (${error.name}): falling back to catalog guidance`)
    return { source: 'CATALOG', plan: finding.remediation, model: null, fallbackReason: error.name }
  } finally {
    clearTimeout(timer)
  }
}
