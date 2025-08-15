# Usage Guide for AI Agents

## Core Setup
1. call `createCore` with desired size and container selector
2. for inventory, dialogue, trade, characters, locations or movement, call each plugin `init(core)`
3. optionally render inventory storage UI via `core.inventory.renderStorage({position:'right'})`
4. load configuration with `core.loadConfig(configObject)` then call `core.start()`

## Command Examples
### Create core and load scene
```javascript
import {createCore, InventoryLite, CharactersLite} from './index.js';
const core = createCore({width:400,height:300});
InventoryLite.init(core);
CharactersLite.init(core);
await core.loadConfig({schemaVersion:'1.0',game:{startScene:'s'},assets:[],scenes:[{id:'s'}],characters:[]});
core.start();
```

### Adjust inventory and money
```javascript
core.inventory.add('potion',1);
core.characters.addMoney('hero',-10);
```

### Dialogue action triggering trade
```javascript
import {DialogueLite, TradeLite} from './index.js';
DialogueLite.init(core);
TradeLite.init(core);
core.dialogue.open('shopkeeper');
```

## Common Pitfalls
- do not call `start` before `loadConfig`
- ensure every plugin is initialized before using its API
- inventory quantities must be numbers; negative values are ignored

