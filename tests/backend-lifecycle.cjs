// Let the OS reserve an unused port atomically (PORT=0), rather than guessing
// a port that may already belong to another process or an outgoing connection.
function backendPort(child) {
  return new Promise((resolve, reject) => {
    let output = '', diagnostic = '';
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', stdout);
      child.stderr.off('data', stderr);
      child.off('error', failed);
      child.off('exit', exited);
    };
    const failed = error => { cleanup(); reject(error); };
    const exited = code => failed(Error('Isolated backend exited ' + code + ': ' + diagnostic));
    const stderr = chunk => { diagnostic += chunk; };
    const stdout = chunk => {
      output += chunk;
      const match = output.match(/running on port ([0-9]+)/);
      if (match) { cleanup(); resolve(Number(match[1])); }
    };
    const timer = setTimeout(() => failed(Error('Isolated backend readiness timeout: ' + diagnostic)), 15000);
    child.stdout.on('data', stdout);
    child.stderr.on('data', stderr);
    child.once('error', failed);
    child.once('exit', exited);
    if (child.exitCode !== null || child.signalCode !== null) exited(child.exitCode);
  });
}
async function stopBackend(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}
module.exports = { backendPort, stopBackend };
