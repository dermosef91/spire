// proxy-bootstrap.js — route the OpenAI SDK's fetch through an HTTPS proxy.
//
// The OpenAI Node SDK uses Node's global fetch (undici), which ignores the
// HTTPS_PROXY environment variable. Inside the Claude Code sandbox all outbound
// HTTPS must traverse the agent proxy, so without this the SDK can't reach
// api.openai.com. On GitHub Actions runners (open egress, no proxy) HTTPS_PROXY
// is unset and this is a no-op.
//
// Import this for its side effect before constructing the OpenAI client:
//   import './proxy-bootstrap.js';

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;

if (proxyUrl) {
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`🔌 Routing API calls through proxy: ${proxyUrl}`);
  } catch {
    console.warn(
      '⚠ HTTPS_PROXY is set but the "undici" package is not installed.\n' +
      '  Run `npm install` inside tools/ first. Without it the OpenAI SDK\n' +
      '  cannot reach api.openai.com from behind the sandbox proxy.',
    );
  }
}
