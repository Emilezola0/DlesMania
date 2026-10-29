// Unreal Engine Blueprint nodes: the Specialist universe for the engine, and the source of its boss
// battle's cards. Each node with its kind, category and main pins (the ones every Blueprint user
// sees — advanced pins left out), and a short description written for the game. Nodes are drawn as
// SVG in the editor's own colour code (red events, blue functions, green pure nodes; a colour per pin type).

export type PinType = 'exec' | 'bool' | 'int' | 'float' | 'string' | 'text' | 'name' | 'vector' | 'rotator' | 'transform' | 'object' | 'class' | 'struct' | 'enum' | 'wildcard' | 'delegate' | 'color';
type Pin = [string, PinType];

export interface BlueprintNode {
  id: string;
  name: string;
  aliases: string[];
  kind: 'Event' | 'Function' | 'Pure function' | 'Macro' | 'Flow control' | 'Cast';
  category: string;
  /** Latent nodes (a clock in the corner) finish later: Delay, Retriggerable Delay. */
  latent: boolean;
  /** The main thing it gives back ("None" when it only runs). */
  returns: string;
  inputs: Pin[];
  outputs: Pin[];
  description: string;
}

const X: Pin = ['', 'exec'];
type Row = [name: string, kind: BlueprintNode['kind'], category: string, returns: string, inputs: Pin[], outputs: Pin[], description: string, aliases?: string[], latent?: boolean];

const ROWS: Row[] = [
  // ── Flow control ──
  ['Branch', 'Flow control', 'Flow Control', 'None', [X, ['Condition', 'bool']], [['True', 'exec'], ['False', 'exec']], 'Sends the flow down one of two paths depending on a true-or-false condition.', ['If']],
  ['Sequence', 'Flow control', 'Flow Control', 'None', [X], [['Then 0', 'exec'], ['Then 1', 'exec']], 'Fires several outputs one after the other, in order, from a single input.'],
  ['For Loop', 'Macro', 'Flow Control', 'Integer', [X, ['First Index', 'int'], ['Last Index', 'int']], [['Loop Body', 'exec'], ['Index', 'int'], ['Completed', 'exec']], 'Runs its body once for every number between two indexes.'],
  ['For Each Loop', 'Macro', 'Flow Control', 'Wildcard', [X, ['Array', 'wildcard']], [['Loop Body', 'exec'], ['Array Element', 'wildcard'], ['Array Index', 'int'], ['Completed', 'exec']], 'Runs its body once for each element of an array.', ['ForEach']],
  ['While Loop', 'Macro', 'Flow Control', 'None', [X, ['Condition', 'bool']], [['Loop Body', 'exec'], ['Completed', 'exec']], 'Keeps running its body as long as a condition stays true.'],
  ['Do Once', 'Macro', 'Flow Control', 'None', [X, ['Reset', 'exec'], ['Start Closed', 'bool']], [['Completed', 'exec']], 'Lets the flow through a single time, until it is reset.', ['DoOnce']],
  ['DoN', 'Macro', 'Flow Control', 'Integer', [['Enter', 'exec'], ['N', 'int'], ['Reset', 'exec']], [['Exit', 'exec'], ['Counter', 'int']], 'Lets the flow through a set number of times, then stays shut until reset.', ['Do N']],
  ['Gate', 'Macro', 'Flow Control', 'None', [['Enter', 'exec'], ['Open', 'exec'], ['Close', 'exec'], ['Toggle', 'exec'], ['Start Closed', 'bool']], [['Exit', 'exec']], 'A door for the flow: it can be opened, closed or toggled from other inputs.'],
  ['FlipFlop', 'Macro', 'Flow Control', 'Boolean', [X], [['A', 'exec'], ['B', 'exec'], ['Is A', 'bool']], 'Alternates between two outputs each time it runs.', ['Flip Flop']],
  ['Switch on Int', 'Flow control', 'Flow Control', 'None', [X, ['Selection', 'int']], [['0', 'exec'], ['1', 'exec'], ['Default', 'exec']], 'Picks an output by number, with a default for anything else.'],
  ['Delay', 'Function', 'Flow Control', 'None', [X, ['Duration', 'float']], [['Completed', 'exec']], 'Waits a number of seconds before carrying on — calling it again while waiting does nothing.', [], true],
  ['Retriggerable Delay', 'Function', 'Flow Control', 'None', [X, ['Duration', 'float']], [['Completed', 'exec']], 'Waits a number of seconds, restarting the countdown every time it is called again.', [], true],
  // ── Events ──
  ['Event BeginPlay', 'Event', 'Events', 'None', [], [X], 'Fires once when the game starts, or when the actor is spawned.', ['BeginPlay']],
  ['Event Tick', 'Event', 'Events', 'Float', [], [X, ['Delta Seconds', 'float']], 'Fires every frame, with the time since the last one.', ['Tick']],
  ['Event ActorBeginOverlap', 'Event', 'Events', 'Object', [], [X, ['Other Actor', 'object']], 'Fires when another actor starts overlapping this one.', ['ActorBeginOverlap', 'Begin Overlap']],
  ['Event Hit', 'Event', 'Events', 'Struct', [], [X, ['My Comp', 'object'], ['Other', 'object'], ['Hit Location', 'vector'], ['Hit', 'struct']], 'Fires when this actor bumps into something solid.', ['On Hit']],
  ['Event AnyDamage', 'Event', 'Events', 'Float', [], [X, ['Damage', 'float'], ['Damage Type', 'object'], ['Instigated By', 'object'], ['Damage Causer', 'object']], 'Fires when the actor takes damage of any kind.', ['AnyDamage']],
  ['Event EndPlay', 'Event', 'Events', 'Enum', [], [X, ['End Play Reason', 'enum']], 'Fires when the actor leaves play, with the reason why.', ['EndPlay']],
  ['Event Destroyed', 'Event', 'Events', 'None', [], [X], 'Fires when the actor is destroyed.', ['Destroyed']],
  ['Custom Event', 'Event', 'Events', 'None', [], [X], 'An event of your own, which other graphs can call by name.'],
  // ── Actors and transforms ──
  ['Spawn Actor from Class', 'Function', 'Game', 'Object', [X, ['Class', 'class'], ['Spawn Transform', 'transform'], ['Owner', 'object']], [X, ['Return Value', 'object']], 'Creates a new actor of a given class in the world, at a given transform.', ['SpawnActor', 'Spawn Actor']],
  ['Destroy Actor', 'Function', 'Actor', 'None', [X, ['Target', 'object']], [X], 'Removes an actor from the world.', ['DestroyActor']],
  ['Get Actor Location', 'Pure function', 'Transformation', 'Vector', [['Target', 'object']], [['Return Value', 'vector']], 'Gives where an actor is in the world.', ['GetActorLocation']],
  ['Set Actor Location', 'Function', 'Transformation', 'Boolean', [X, ['Target', 'object'], ['New Location', 'vector'], ['Sweep', 'bool'], ['Teleport', 'bool']], [X, ['Sweep Hit Result', 'struct'], ['Return Value', 'bool']], 'Moves an actor to a new position, optionally stopping at whatever it hits.', ['SetActorLocation']],
  ['Get Actor Rotation', 'Pure function', 'Transformation', 'Rotator', [['Target', 'object']], [['Return Value', 'rotator']], 'Gives which way an actor is turned.', ['GetActorRotation']],
  ['Set Actor Rotation', 'Function', 'Transformation', 'Boolean', [X, ['Target', 'object'], ['New Rotation', 'rotator'], ['Teleport Physics', 'bool']], [X, ['Return Value', 'bool']], 'Turns an actor to face a new rotation.', ['SetActorRotation']],
  ['Get Actor Forward Vector', 'Pure function', 'Transformation', 'Vector', [['Target', 'object']], [['Return Value', 'vector']], 'Gives the direction an actor is facing, as a unit vector.', ['GetActorForwardVector']],
  ['Get Distance To', 'Pure function', 'Utilities', 'Float', [['Target', 'object'], ['Other Actor', 'object']], [['Return Value', 'float']], 'Gives how far apart two actors are.', ['GetDistanceTo']],
  ['Get All Actors Of Class', 'Function', 'Utilities', 'Array', [X, ['Actor Class', 'class']], [X, ['Out Actors', 'object']], 'Finds every actor of a given class in the level — slow, so best kept out of Tick.', ['GetAllActorsOfClass']],
  ['Get Player Character', 'Pure function', 'Game', 'Object', [['Player Index', 'int']], [['Return Value', 'object']], 'Gives the character a player is controlling.', ['GetPlayerCharacter']],
  ['Get Player Controller', 'Pure function', 'Game', 'Object', [['Player Index', 'int']], [['Return Value', 'object']], 'Gives the controller of a player — their input and their camera.', ['GetPlayerController']],
  ['Get Game Mode', 'Pure function', 'Game', 'Object', [], [['Return Value', 'object']], 'Gives the object that holds the rules of the current game.', ['GetGameMode']],
  ['Cast To Character', 'Cast', 'Utilities', 'Object', [X, ['Object', 'object']], [X, ['Cast Failed', 'exec'], ['As Character', 'object']], 'Checks whether an object is a character, and gives it back as one if so.', ['Cast To', 'Cast']],
  ['Is Valid', 'Macro', 'Utilities', 'None', [X, ['Input Object', 'object']], [['Is Valid', 'exec'], ['Is Not Valid', 'exec']], 'Splits the flow on whether an object reference actually points at something.', ['IsValid']],
  ['Select', 'Pure function', 'Utilities', 'Wildcard', [['Index', 'wildcard'], ['Option 0', 'wildcard'], ['Option 1', 'wildcard']], [['Return Value', 'wildcard']], 'Picks one of several values according to an index or a condition.'],
  // ── Input and characters ──
  ['Add Movement Input', 'Function', 'Input', 'None', [X, ['Target', 'object'], ['World Direction', 'vector'], ['Scale Value', 'float']], [X], 'Pushes a pawn in a direction — how most characters walk.', ['AddMovementInput']],
  ['Add Controller Yaw Input', 'Function', 'Input', 'None', [X, ['Target', 'object'], ['Val', 'float']], [X], 'Turns the controller left or right — how the mouse turns the camera.', ['AddControllerYawInput']],
  ['Jump', 'Function', 'Character', 'None', [X, ['Target', 'object']], [X], 'Makes a character jump.'],
  ['Launch Character', 'Function', 'Character', 'None', [X, ['Target', 'object'], ['Launch Velocity', 'vector'], ['XY Override', 'bool'], ['Z Override', 'bool']], [X], 'Throws a character with a given velocity — jump pads, knockbacks.', ['LaunchCharacter']],
  ['Enable Input', 'Function', 'Input', 'None', [X, ['Target', 'object'], ['Player Controller', 'object']], [X], 'Lets an actor receive a player’s key presses.', ['EnableInput']],
  ['Set Show Mouse Cursor', 'Function', 'Input', 'None', [X, ['Target', 'object'], ['Show Mouse Cursor', 'bool']], [X], 'Shows or hides the mouse pointer.', ['Show Mouse Cursor']],
  // ── Collision ──
  ['Line Trace By Channel', 'Function', 'Collision', 'Boolean', [X, ['Start', 'vector'], ['End', 'vector'], ['Trace Channel', 'enum'], ['Actors to Ignore', 'object']], [X, ['Out Hit', 'struct'], ['Return Value', 'bool']], 'Shoots an invisible ray between two points and reports the first thing it hits.', ['LineTraceByChannel', 'Line Trace', 'Raycast']],
  ['Sphere Trace By Channel', 'Function', 'Collision', 'Boolean', [X, ['Start', 'vector'], ['End', 'vector'], ['Radius', 'float'], ['Trace Channel', 'enum']], [X, ['Out Hit', 'struct'], ['Return Value', 'bool']], 'Sweeps a ball between two points and reports the first thing it hits.', ['SphereTraceByChannel', 'Sphere Trace']],
  // ── User interface ──
  ['Create Widget', 'Function', 'User Interface', 'Object', [X, ['Class', 'class'], ['Owning Player', 'object']], [X, ['Return Value', 'object']], 'Builds an instance of a UI widget, ready to be shown.', ['CreateWidget']],
  ['Add to Viewport', 'Function', 'User Interface', 'None', [X, ['Target', 'object'], ['ZOrder', 'int']], [X], 'Puts a widget on the screen.', ['AddToViewport']],
  ['Remove from Parent', 'Function', 'User Interface', 'None', [X, ['Target', 'object']], [X], 'Takes a widget off the screen.', ['RemoveFromParent']],
  ['Set Text', 'Function', 'User Interface', 'None', [X, ['Target', 'object'], ['In Text', 'text']], [X], 'Changes what a text block says.', ['SetText']],
  // ── Timers ──
  ['Set Timer by Event', 'Function', 'Timers', 'Struct', [X, ['Event', 'delegate'], ['Time', 'float'], ['Looping', 'bool']], [X, ['Return Value', 'struct']], 'Calls an event after a delay, once or over and over, and gives a handle to stop it.', ['SetTimerByEvent', 'Set Timer']],
  ['Clear and Invalidate Timer by Handle', 'Function', 'Timers', 'Struct', [X, ['Handle', 'struct']], [X, ['Return Value', 'struct']], 'Stops a running timer through its handle.', ['Clear Timer', 'ClearAndInvalidateTimerByHandle']],
  ['Get World Delta Seconds', 'Pure function', 'Timers', 'Float', [], [['Return Value', 'float']], 'Gives how long the last frame took.', ['GetWorldDeltaSeconds', 'Delta Seconds']],
  // ── Math ──
  ['Lerp', 'Pure function', 'Math', 'Float', [['A', 'float'], ['B', 'float'], ['Alpha', 'float']], [['Return Value', 'float']], 'Blends between two values: alpha 0 gives the first, 1 the second.'],
  ['Make Vector', 'Pure function', 'Math', 'Vector', [['X', 'float'], ['Y', 'float'], ['Z', 'float']], [['Return Value', 'vector']], 'Builds a vector from three numbers.', ['MakeVector']],
  ['Break Vector', 'Pure function', 'Math', 'Float', [['In Vec', 'vector']], [['X', 'float'], ['Y', 'float'], ['Z', 'float']], 'Splits a vector into its three numbers.', ['BreakVector']],
  ['Random Integer in Range', 'Pure function', 'Math', 'Integer', [['Min', 'int'], ['Max', 'int']], [['Return Value', 'int']], 'Rolls a whole number between a minimum and a maximum.', ['RandomIntegerInRange']],
  ['Random Float in Range', 'Pure function', 'Math', 'Float', [['Min', 'float'], ['Max', 'float']], [['Return Value', 'float']], 'Rolls a decimal number between a minimum and a maximum.', ['RandomFloatInRange']],
  ['Clamp', 'Pure function', 'Math', 'Float', [['Value', 'float'], ['Min', 'float'], ['Max', 'float']], [['Return Value', 'float']], 'Keeps a value between a minimum and a maximum.'],
  ['Vector Length', 'Pure function', 'Math', 'Float', [['A', 'vector']], [['Return Value', 'float']], 'Gives how long a vector is — a speed, a distance.', ['VSize']],
  ['Normalize', 'Pure function', 'Math', 'Vector', [['A', 'vector'], ['Tolerance', 'float']], [['Return Value', 'vector']], 'Keeps a vector’s direction but makes its length one.'],
  ['Find Look at Rotation', 'Pure function', 'Math', 'Rotator', [['Start', 'vector'], ['Target', 'vector']], [['Return Value', 'rotator']], 'Gives the rotation that points from one place towards another.', ['FindLookAtRotation']],
  ['RInterp To', 'Pure function', 'Math', 'Rotator', [['Current', 'rotator'], ['Target', 'rotator'], ['Delta Time', 'float'], ['Interp Speed', 'float']], [['Return Value', 'rotator']], 'Turns a rotation smoothly towards a target, a little each frame.', ['RInterpTo']],
  // ── Strings and text ──
  ['Print String', 'Function', 'Utilities', 'None', [X, ['In String', 'string'], ['Print to Screen', 'bool'], ['Print to Log', 'bool'], ['Text Color', 'color'], ['Duration', 'float']], [X], 'Writes a message on the screen and in the log — every Blueprint user’s first debugging tool.', ['PrintString']],
  ['Append', 'Pure function', 'String', 'String', [['A', 'string'], ['B', 'string']], [['Return Value', 'string']], 'Glues strings together end to end.'],
  ['Format Text', 'Pure function', 'String', 'Text', [['Format', 'text']], [['Result', 'text']], 'Fills the {placeholders} of a text with values.', ['FormatText']],
  // ── Audio and effects ──
  ['Play Sound at Location', 'Function', 'Audio', 'None', [X, ['Sound', 'object'], ['Location', 'vector'], ['Volume Multiplier', 'float'], ['Pitch Multiplier', 'float']], [X], 'Plays a sound once at a point in the world.', ['PlaySoundAtLocation']],
  ['Play Sound 2D', 'Function', 'Audio', 'None', [X, ['Sound', 'object'], ['Volume Multiplier', 'float'], ['Pitch Multiplier', 'float']], [X], 'Plays a sound straight to the player, with no position — UI clicks, music stings.', ['PlaySound2D']],
  ['Spawn Emitter at Location', 'Function', 'Effects', 'Object', [X, ['Emitter Template', 'object'], ['Location', 'vector'], ['Rotation', 'rotator'], ['Auto Destroy', 'bool']], [X, ['Return Value', 'object']], 'Starts a particle effect at a point in the world.', ['SpawnEmitterAtLocation']],
  // ── Damage and physics ──
  ['Apply Damage', 'Function', 'Damage', 'Float', [X, ['Damaged Actor', 'object'], ['Base Damage', 'float'], ['Event Instigator', 'object'], ['Damage Causer', 'object']], [X, ['Return Value', 'float']], 'Hurts an actor — which then hears about it through its damage events.', ['ApplyDamage']],
  ['Add Impulse', 'Function', 'Physics', 'None', [X, ['Target', 'object'], ['Impulse', 'vector'], ['Vel Change', 'bool']], [X], 'Gives a physics object a sudden push.', ['AddImpulse']],
  ['Set Simulate Physics', 'Function', 'Physics', 'None', [X, ['Target', 'object'], ['Simulate', 'bool']], [X], 'Hands a component over to the physics engine, or takes it back.', ['SetSimulatePhysics']],
  // ── Game, levels, saving ──
  ['Open Level', 'Function', 'Game', 'None', [X, ['Level Name', 'name'], ['Absolute', 'bool'], ['Options', 'string']], [X], 'Travels to another map.', ['OpenLevel', 'Open Level (by Name)']],
  ['Quit Game', 'Function', 'Game', 'None', [X, ['Specific Player', 'object'], ['Quit Preference', 'enum']], [X], 'Closes the game.', ['QuitGame']],
  ['Create Save Game Object', 'Function', 'Save Game', 'Object', [X, ['Save Game Class', 'class']], [X, ['Return Value', 'object']], 'Makes an empty save to fill in.', ['CreateSaveGameObject']],
  ['Save Game to Slot', 'Function', 'Save Game', 'Boolean', [X, ['Save Game Object', 'object'], ['Slot Name', 'string'], ['User Index', 'int']], [X, ['Return Value', 'bool']], 'Writes a save to disk under a slot name.', ['SaveGameToSlot']],
  ['Load Game from Slot', 'Function', 'Save Game', 'Object', [X, ['Slot Name', 'string'], ['User Index', 'int']], [X, ['Return Value', 'object']], 'Reads a save back from disk.', ['LoadGameFromSlot']],
  ['Does Save Game Exist', 'Pure function', 'Save Game', 'Boolean', [['Slot Name', 'string'], ['User Index', 'int']], [['Return Value', 'bool']], 'Says whether a save slot has anything in it.', ['DoesSaveGameExist']],
  // ── Animation and rendering ──
  ['Play Anim Montage', 'Function', 'Animation', 'Float', [X, ['Target', 'object'], ['Anim Montage', 'object'], ['In Play Rate', 'float'], ['Start Section Name', 'name']], [X, ['Return Value', 'float']], 'Plays an animation montage on a character — an attack, a reload.', ['PlayAnimMontage']],
  ['Create Dynamic Material Instance', 'Function', 'Rendering', 'Object', [X, ['Target', 'object'], ['Element Index', 'int'], ['Source Material', 'object']], [X, ['Return Value', 'object']], 'Gives a mesh its own copy of a material, so its parameters can change while playing.', ['CreateDynamicMaterialInstance', 'Dynamic Material Instance']],
  ['Set Scalar Parameter Value', 'Function', 'Rendering', 'None', [X, ['Target', 'object'], ['Parameter Name', 'name'], ['Value', 'float']], [X], 'Changes one number inside a dynamic material — a glow, a fade.', ['SetScalarParameterValue']],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const BLUEPRINT_NODES: BlueprintNode[] = ROWS.map(([name, kind, category, returns, inputs, outputs, description, aliases = [], latent = false]) => ({
  id: slug(name),
  name,
  aliases,
  kind,
  category,
  latent,
  returns,
  inputs,
  outputs,
  description,
}));

export const blueprintNodeById = new Map(BLUEPRINT_NODES.map((n) => [n.id, n]));

// ── Drawing a node ──
const HEADER: Record<BlueprintNode['kind'], [string, string]> = {
  Event: ['#b91c1c', '#7f1d1d'],
  Function: ['#2563eb', '#1e3a8a'],
  'Pure function': ['#16a34a', '#14532d'],
  Macro: ['#6b7280', '#374151'],
  'Flow control': ['#6b7280', '#374151'],
  Cast: ['#0d9488', '#134e4a'],
};
/** The editor's pin colours, by type. */
export const PIN_COLOR: Record<PinType, string> = {
  exec: '#ffffff', bool: '#a30000', int: '#1fe3af', float: '#a0e83a', string: '#ff2bd4', text: '#e5739a', name: '#c891ff', vector: '#ffca23', rotator: '#a0b4ff',
  transform: '#ff7a1a', object: '#00a9ff', class: '#6b2bff', struct: '#0057c8', enum: '#006f65', wildcard: '#9ca3af', delegate: '#ff3838', color: '#0057c8',
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A node as SVG (`hideTitle`: its name replaced by question marks, for guessing it from its pins). */
export function nodeSvg(n: { name: string; kind: BlueprintNode['kind']; latent?: boolean; inputs: Pin[]; outputs: Pin[] }, hideTitle = false): string {
  const W = 300;
  const rows = Math.max(n.inputs.length, n.outputs.length, 1);
  const H = 40 + rows * 26 + 12;
  const [c1, c2] = HEADER[n.kind];
  const pin = (x: number, y: number, t: PinType, side: 'in' | 'out') =>
    t === 'exec'
      ? `<path d="M${x - 6} ${y - 6} h7 l6 6 -6 6 h-7 z" fill="${side === 'out' ? '#fff' : 'none'}" stroke="#fff" stroke-width="1.6"/>`
      : `<circle cx="${x}" cy="${y}" r="5.5" fill="${PIN_COLOR[t]}" stroke="#0b0b0b" stroke-width="1"/>`;
  const label = (x: number, y: number, s: string, anchor: 'start' | 'end') => (s ? `<text x="${x}" y="${y + 4}" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#e5e7eb" text-anchor="${anchor}">${esc(s)}</text>` : '');
  const body = [
    ...n.inputs.map(([s, t], i) => pin(16, 52 + i * 26, t, 'in') + label(28, 52 + i * 26, s, 'start')),
    ...n.outputs.map(([s, t], i) => pin(W - 16, 52 + i * 26, t, 'out') + label(W - 28, 52 + i * 26, s, 'end')),
  ].join('');
  const title = hideTitle ? '? ? ?' : n.name;
  const clock = n.latent ? `<g transform="translate(${W - 26} 15)"><circle r="8" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M0 -4 V0 L3 2" stroke="#fff" stroke-width="1.6" fill="none"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="h" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="#151517" fill-opacity="0.94" stroke="#000" stroke-width="2"/><path d="M1 11 a10 10 0 0 1 10 -10 h${W - 22} a10 10 0 0 1 10 10 v19 h-${W - 2} z" fill="url(#h)"/><text x="14" y="21" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#fff">${esc(title)}</text>${clock}${body}</svg>`;
}

export const nodeImage = (n: Parameters<typeof nodeSvg>[0], hideTitle = false) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(nodeSvg(n, hideTitle))}`;

export const BLUEPRINT_POOLS = {
  classic: BLUEPRINT_NODES.map((n) => n.id),
  // A node with no pins at all says nothing.
  pins: BLUEPRINT_NODES.filter((n) => n.inputs.length + n.outputs.length >= 3).map((n) => n.id),
  clue: BLUEPRINT_NODES.map((n) => n.id),
};
