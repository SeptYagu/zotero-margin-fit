// Use Zotero's local Firefox debugger API to launch the isolated test driver.
const net = require('node:net');
const port = Number(process.argv[2]);
const driverPath = process.argv[3];
const socket = net.createConnection({ host: '127.0.0.1', port });
let buffer = Buffer.alloc(0);
const waiters = [];
function send(message) {
  const data = JSON.stringify(message);
  socket.write(Buffer.byteLength(data) + ':' + data);
}
function receive(predicate) {
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, reject };
    // Busy Zotero installations may need longer to initialize the debugger actor.
    waiter.timer = setTimeout(() => reject(new Error('Debugger response timed out')), 60000);
    waiters.push(waiter);
  });
}
socket.on('error', error => { console.error(error.message); process.exit(1); });
socket.on('data', data => {
  buffer = Buffer.concat([buffer, data]);
  while (true) {
    const colon = buffer.indexOf(':');
    if (colon < 0) break;
    const length = Number(buffer.subarray(0, colon).toString());
    if (buffer.length < colon + 1 + length) break;
    const message = JSON.parse(buffer.subarray(colon + 1, colon + 1 + length).toString());
    buffer = buffer.subarray(colon + 1 + length);
    const index = waiters.findIndex(w => w.predicate(message));
    if (index >= 0) {
      const waiter = waiters.splice(index, 1)[0];
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  }
});
async function request(message) {
  const response = receive(m => m.from === message.to && !m.type);
  send(message);
  const result = await response;
  if (result.error) throw new Error(JSON.stringify(result));
  return result;
}
(async () => {
  await receive(m => m.from === 'root' && m.applicationType);
  const descriptor = await request({ to: 'root', type: 'getProcess', id: 0 });
  const target = await request({ to: descriptor.processDescriptor.actor, type: 'getTarget' });
  const consoleActor = target.process.consoleActor;
  const code = `(() => {
    const { Zotero } = ChromeUtils.importESModule('chrome://zotero/content/zotero.mjs');
    const scope = { Zotero, Services, Cc, Ci, IOUtils, PathUtils, ChromeUtils, setTimeout: setTimeout.bind(window) };
    const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    file.initWithPath(${JSON.stringify(driverPath)});
    Services.scriptloader.loadSubScript(Services.io.newFileURI(file).spec, scope);
    scope.startup();
    return 'Integration tests started';
  })()`;
  const ack = await request({ to: consoleActor, type: 'evaluateJSAsync', text: code });
  const result = await receive(m => m.type === 'evaluationResult' && m.resultID === ack.resultID);
  if (result.exception) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify({ debuggerResult: result.result }));
  socket.end();
})().catch(error => { console.error(error); socket.destroy(); process.exitCode = 1; });
