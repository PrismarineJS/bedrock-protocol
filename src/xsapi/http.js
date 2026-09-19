const { parse, stringify } = require('json-bigint')({ storeAsString: true })

async function readJsonResponse (response) {
  const body = await response.text()
  if (!response.ok) throw new Error(`Xbox HTTP ${response.status} ${response.statusText}: ${body}`)
  return body.trim() ? parse(body) : undefined
}

// The deadline covers authentication, HTTP headers, and the response body.
// Racing cancellation also bounds auth flows that cannot themselves be aborted.
async function requestJson (authflow, method, config, controller, timeout = 15000) {
  const signal = controller.signal
  const abort = () => controller.abort(config.signal.reason)
  if (config.signal?.aborted) abort()
  else config.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('Xbox request timed out')), config.timeout ?? timeout)
  let onAbort
  const cancelled = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })
  const execute = async () => {
    signal.throwIfAborted()
    const auth = await authflow.getXboxToken('http://xboxlive.com')
    signal.throwIfAborted()
    const hasBody = config.data !== undefined
    const headers = {
      authorization: `XBL3.0 x=${auth.userHash};${auth.XSTSToken}`,
      accept: 'application/json',
      'accept-language': 'en-US',
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...config.headers
    }
    if (config.contractVersion) headers['x-xbl-contract-version'] = config.contractVersion
    const response = await fetch(config.url, {
      method,
      headers,
      signal,
      ...(hasBody ? { body: stringify(config.data) } : {})
    })
    return readJsonResponse(response)
  }
  try {
    return await Promise.race([execute(), cancelled])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
    config.signal?.removeEventListener('abort', abort)
  }
}

module.exports = { requestJson, readJsonResponse }
