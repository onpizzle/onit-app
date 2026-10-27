
(function(){
  let active=null,lastFocus=null;
  function close(value){if(!active)return;const a=active;active=null;a.layer.remove();if(lastFocus&&document.contains(lastFocus))setTimeout(()=>lastFocus.focus?.(),0);a.resolve(value)}
  function open(opts){
    if(active)close(null);lastFocus=document.activeElement;
    return new Promise(resolve=>{
      const layer=document.createElement('div');layer.className='onitDialogLayer';layer.setAttribute('role','presentation');
      const card=document.createElement('div');card.className='onitDialogCard';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
      const eyebrow=document.createElement('div');eyebrow.className='onitDialogEyebrow';eyebrow.textContent=opts.eyebrow||'ONIT';card.appendChild(eyebrow);
      const title=document.createElement('h2');title.className='onitDialogTitle';title.textContent=opts.title||'ONIT';card.appendChild(title);
      const message=document.createElement('div');message.className='onitDialogMessage';message.textContent=String(opts.message||'');card.appendChild(message);
      let input=null;if(opts.kind==='prompt'){input=document.createElement(opts.multiline?'textarea':'input');input.className='onitDialogInput';input.value=opts.defaultValue==null?'':String(opts.defaultValue);if(opts.placeholder)input.placeholder=opts.placeholder;card.appendChild(input)}
      const actions=document.createElement('div');actions.className='onitDialogActions';
      if(opts.kind!=='alert'){const cancel=document.createElement('button');cancel.type='button';cancel.className='onitDialogBtn';cancel.textContent=opts.cancelLabel||'CANCEL';cancel.onclick=()=>close(opts.kind==='confirm'?false:null);actions.appendChild(cancel)}
      const ok=document.createElement('button');ok.type='button';ok.className='onitDialogBtn primary';ok.textContent=opts.okLabel||'OK';ok.onclick=()=>close(opts.kind==='prompt'?(input?input.value:''):opts.kind==='confirm'?true:true);actions.appendChild(ok);card.appendChild(actions);layer.appendChild(card);document.body.appendChild(layer);active={layer,resolve,kind:opts.kind};
      layer.addEventListener('click',e=>{if(e.target===layer&&opts.kind!=='alert')close(opts.kind==='confirm'?false:null)});layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(opts.kind==='confirm'?false:null)}if(e.key==='Enter'&&!e.shiftKey&&(opts.kind!=='prompt'||!opts.multiline)){e.preventDefault();ok.click()}});setTimeout(()=>{(input||ok).focus();if(input&&input.select)input.select()},0);
    })
  }
  window.onitAlert=function(message,title='ONIT'){return open({kind:'alert',title,message,okLabel:'GOT IT'})};
  window.onitConfirm=function(message,options={}){if(typeof options==='string')options={title:options};return open({kind:'confirm',title:options.title||'Confirm action',message,okLabel:options.okLabel||'CONFIRM',cancelLabel:options.cancelLabel||'CANCEL'})};
  window.onitPrompt=function(message,defaultValue='',options={}){return open({kind:'prompt',title:options.title||'Add details',message,defaultValue,placeholder:options.placeholder||'',multiline:!!options.multiline,okLabel:options.okLabel||'CONTINUE',cancelLabel:options.cancelLabel||'CANCEL'})};
})();
