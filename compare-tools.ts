import { tools } from './mcp-server/src/server.ts';
import { toolHandlers } from './mcp-server/src/tools/index.ts';

const serverTools = new Set(tools.map(t => t.name));
const handlerTools = new Set(Object.keys(toolHandlers));

console.log('Total tools in server:', serverTools.size);
console.log('Total tools in handler:', handlerTools.size);
console.log('');
console.log('Tools in server but not in handler:', [...serverTools].filter(t => !handlerTools.has(t)));
console.log('');
console.log('Tools in handler but not in server:', [...handlerTools].filter(t => !serverTools.has(t)));
