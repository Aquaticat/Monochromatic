/**
 Original runner event observations share its native manager's existing source pool.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeEventContractError } from './event-observer-errors.ts';
import { createNativeEventTraversal } from './event-traversal.ts';
import type {
  NativeEventInput,
  NativeEventObservation,
  NativeEventObserver,
  NativeEventSlot,
  NativeEventTraversal
} from './event-observer-types.ts';

//region Original runner identity and terminal observations remain distinct from semantic admission

/** Original publication identity cannot be reconstructed by copying its fields. */
const observations=new WeakSet<object>();
/** Native observation diagnostics retain their module boundary. */
const l=tagged({tag:'auto-mode-native-event-observer'});
/** Existing native source profile bounds extension snapshot traversal. */
const MAX_EVENT_EXTENSIONS=64;
/** Existing native source profile bounds callback positions in one traversal. */
const MAX_EVENT_HANDLERS=256;

/**
 Check original publication identity without trusting supplied status fields.

 @param value - observation selected from an authenticated original source snapshot
 @returns whether the original native event owner published this exact object
 */
export function isNativeEventObservation(value: unknown): value is NativeEventObservation {
  tagged({tag:isNativeEventObservation.name,l}).debug('checking original native event publication');
  return value!==null&&typeof value==='object'&&observations.has(value);
}

/**
 Retain original callback traversal across concurrent or nested native emissions.

 @param capture - manager-owned bounded input capture fixed at runner construction
 @returns original traversal and immutable observation publication boundaries
 */
export function createNativeEventObserver(capture: (input: NativeEventInput) => void): NativeEventObserver {
  /** Runner occurrence and pending emissions remain private capabilities. */
  const occurrence=Object.freeze({});
  /** Separate emission tokens permit native nested and overlapping callbacks. */
  const pending=new Set<object>();
  /** Mutation belongs only to this original observation owner. */
  const state: {revision:number;failed:boolean;view?:NativeEventObservation}={revision:0,failed:false};
  /** Owner diagnostics retain their function tag. */
  const rl=tagged({tag:createNativeEventObserver.name,l});
  rl.debug('created original native event observer');

  /** Invalidate the cached view after an original lifecycle transition. */
  function changed(): void {
    tagged({tag:changed.name,l:rl}).debug('updating original native event observation');
    state.revision++;
    delete state.view;
  }

  /** Observation failure permanently prevents this runner from publishing complete capture. */
  function invalidate(): void {
    tagged({tag:invalidate.name,l:rl}).debug('retaining native event observation failure');
    state.failed=true;
    changed();
  }

  /**
   Retain a native snapshot before invoking any callback in that emission.

   @param kind - original kind selected at the native snapshot boundary
   @param snapshot - original extensions and copied callback lists
   @returns synchronous boundaries for this original native emission
   @throws NativeEventContractError when the original bounded snapshot shape differs
   */
  function begin({kind,snapshot}: Parameters<NativeEventObserver['begin']>[0]): NativeEventTraversal {
    tagged({tag:begin.name,l:rl}).debug('capturing original native event positions');
    if(snapshot.length>MAX_EVENT_EXTENSIONS)
      throw new NativeEventContractError('Native event extensions exceed the original 64-source profile');
    /** Original references are retained without invoking extension accessors. */
    const slots: NativeEventSlot[]=[];
    for(const {ext,handlers} of snapshot) {
      if(slots.length+handlers.length>MAX_EVENT_HANDLERS)
        throw new NativeEventContractError('Native event handlers exceed the original 256-position profile');
      /** Path metadata must be an original own data property. */
      const path=Object.getOwnPropertyDescriptor(ext,'path');
      if(!path||!Object.hasOwn(path,'value')||typeof path.value!=='string')
        throw new NativeEventContractError('Native event extension requires its original data path');
      for(const handler of handlers)slots.push(Object.freeze({extension:ext,handler,path:path.value}));
    }
    /** Original emission token cannot be supplied by callback code. */
    const emission=Object.freeze({});
    // Empty native dispatch visits no callback and adds no governing source material.
    if(slots.length>0){pending.add(emission);changed();}
    /** Remove only the emission owned by this original traversal. */
    function retire(): void {
      tagged({tag:retire.name,l:rl}).debug('closing original native event occurrence');
      if(slots.length>0){
        if(!pending.delete(emission))throw new NativeEventContractError('Native event occurrence was already retired');
        changed();
      }
    }
    return createNativeEventTraversal({kind,slots:Object.freeze(slots),capture,retire,invalidate,l:rl});
  }

  /**
   Publish original current status together with native registered event membership.

   @param registeredKinds - original runner's sorted event kinds at this read boundary
   @returns immutable original observation, stable until status or membership changes
   */
  function read(registeredKinds: readonly string[]): NativeEventObservation {
    tagged({tag:read.name,l:rl}).debug('publishing original native event domain');
    /** Stable publication identity lets the source collector detect later event activity. */
    const previous=state.view;
    if(previous&&previous.registeredKinds.length===registeredKinds.length
      &&registeredKinds.every(function sameKind(kind,index){return kind===previous.registeredKinds[index];}))return previous;
    /** This owner publishes pending and failed state without turning either into permission. */
    const view=Object.freeze({occurrence,revision:state.revision,pending:pending.size,failed:state.failed,registeredKinds:Object.freeze([...registeredKinds])});
    observations.add(view);
    state.view=view;
    return view;
  }

  return Object.freeze({begin,read});
}

//endregion Original runner identity and terminal observations remain distinct from semantic admission
