/* ONIT account lifetime: retire old work without changing workflow semantics. */
(function(root){
  'use strict';
  let epoch=0;
  const cleanup=new Set(),controllers=new Set(),timeouts=new Set(),frames=new Set();
  function token(){try{return typeof SESSION_TOKEN==='string'?SESSION_TOKEN:''}catch(_){return''}}
  function storedToken(){try{return localStorage.getItem('onit-session')||''}catch(_){return token()}}
  function stale(){const error=new Error('ONIT_STALE_ACCOUNT');error.code='ONIT_STALE_ACCOUNT';return error}
  function isCurrent(scope){return !!scope&&scope.epoch===epoch&&scope.token===token()&&scope.token===storedToken()}
  function assert(scope){if(!isCurrent(scope))throw stale()}
  function capture(){const scope=Object.freeze({epoch,token:token()});assert(scope);return scope}
  async function wait(promise,scope){
    // Attach handlers even when obsolete, so an abandoned rejection is consumed.
    try{const value=await promise;assert(scope);return value}catch(error){assert(scope);throw error}
  }
  function guard(callback,scope=capture()){
    return function(...args){if(!isCurrent(scope))return;return callback.apply(this,args)};
  }
  function onRetire(callback){cleanup.add(callback);return()=>cleanup.delete(callback)}
  function trackController(controller){controllers.add(controller);return()=>controllers.delete(controller)}
  function later(callback,delay,scope=capture()){
    const id=setTimeout(()=>{timeouts.delete(id);if(isCurrent(scope))callback()},delay);timeouts.add(id);return id;
  }
  function frame(callback,scope=capture()){const id=requestAnimationFrame(()=>{frames.delete(id);if(isCurrent(scope))callback()});frames.add(id);return id}
  function retire(reason){
    epoch++;
    controllers.forEach(c=>c.abort());controllers.clear();
    timeouts.forEach(id=>clearTimeout(id));timeouts.clear();
    frames.forEach(id=>cancelAnimationFrame(id));frames.clear();
    cleanup.forEach(fn=>{try{fn(reason)}catch(e){console.warn('ONIT account cleanup failed')}});
    return epoch;
  }
  root.ONITAccount={capture,isCurrent,assert,wait,guard,onRetire,trackController,later,frame,retire,stale,version:'1.0.0'};
  root.addEventListener('unhandledrejection',event=>{if(event.reason?.code==='ONIT_STALE_ACCOUNT')event.preventDefault()});
})(window);
