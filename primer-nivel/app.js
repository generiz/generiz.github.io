(()=>{
  const office=document.getElementById('officeBtn');
  const remote=document.getElementById('remoteBtn');
  const status=document.getElementById('connectionStatus');
  const description=document.getElementById('connectionDesc');
  const path=document.getElementById('pathHint');
  const preview=document.getElementById('accessPanel');
  if(office&&remote&&status&&description&&path){
    const setMode=(mode)=>{
      const isOffice=mode==='office';
      office.setAttribute('aria-selected',String(isOffice));
      remote.setAttribute('aria-selected',String(!isOffice));
      status.textContent=isOffice?'Conexión local':'Acceso privado';
      description.textContent=isOffice?'El equipo accede directamente al NAS desde la red de la empresa.':'El equipo autorizado accede al NAS mediante una conexión privada desde el exterior.';
      path.textContent=isOffice?'Red de la empresa · Diseño (Z:)':'Fuera de la oficina · Diseño (Z:)';
      if(preview)preview.setAttribute('data-mode',mode);
    };
    office.addEventListener('click',()=>setMode('office'));
    remote.addEventListener('click',()=>setMode('remote'));
  }
  const menu=document.getElementById('menuBtn');
  const nav=document.getElementById('navLinks');
  if(menu&&nav){
    menu.addEventListener('click',()=>{
      const open=nav.classList.toggle('open');
      menu.setAttribute('aria-expanded',String(open));
      menu.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
    });
    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded','false');
      menu.setAttribute('aria-label','Abrir menú');
    }));
  }
  const printButton=document.getElementById('printBtn');
  if(printButton)printButton.addEventListener('click',()=>window.print());
  const shareButton=document.getElementById('shareBtn');
  const toast=document.getElementById('toast');
  let toastTimer;
  const inform=(message)=>{
    if(!toast)return;
    toast.textContent=message;toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('show'),3300);
  };
  if(shareButton)shareButton.addEventListener('click',async()=>{
    try{
      if(navigator.share){await navigator.share({title:document.title,text:'Propuesta NEXO para Producciones Primer Nivel',url:location.href});return;}
      if(navigator.clipboard){await navigator.clipboard.writeText(location.href);inform('Enlace copiado para compartir.');return;}
      inform('Copiá la dirección de esta página para compartir.');
    }catch(error){if(error?.name!=='AbortError')inform('No se pudo compartir el enlace.');}
  });
})();
