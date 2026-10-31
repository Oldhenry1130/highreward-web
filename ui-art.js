/* Local vector art: readable at button sizes, no network fonts or icon dependencies. */
(function(){
  'use strict';
  const shapes={
    tank:'<path fill="#516d5c" d="M7 33h46l6 12H4zM20 22h24v13H17z"/><path fill="#bcae77" d="M32 24h27v5H32z"/><rect fill="#353e37" x="5" y="43" width="54" height="13" rx="6"/><path stroke="#b5b9a1" d="M13 49h38"/><circle fill="#c2b78c" cx="14" cy="49" r="4"/><circle fill="#c2b78c" cx="31" cy="49" r="4"/><circle fill="#c2b78c" cx="49" cy="49" r="4"/>',
    plane:'<path fill="#c5cbb9" d="m30 5 5 1 3 21 22 12v7l-23-6-1 12 8 5v4l-12-3-12 3v-4l8-5-1-12-23 6v-7l22-12z"/><path stroke="#86643d" d="M32 9v43M9 40l17-6m12 0 17 6"/>',
    ferry:'<path fill="#826343" d="M6 40h52L48 55H17z"/><path fill="#d8c38d" d="M13 24h36v17H13z"/><path fill="#618477" d="M20 15h22v11H20z"/><path stroke="#b9d4c0" d="M6 59q7-5 14 0t14 0 14 0 13 0"/><path stroke="#d8c38d" d="M31 6v9"/>',
    castle:'<path fill="#777b70" d="M9 25h46v30H9z"/><path fill="#c3b99a" d="M5 17h14v38H5zm40 0h14v38H45z"/><path fill="#ddd0aa" d="M5 12h5v8h4v-8h5v14H5zm40 0h5v8h4v-8h5v14H45zM24 22h16v33H24z"/><path fill="#563f28" d="M26 55V42a6 6 0 0 1 12 0v13"/><path fill="#9e4740" d="M32 5v14h14l-6-6 6-5H32"/><path d="M32 4v18M10 31v6m44-6v6"/>',
    sword:'<path fill="#c9d7c3" d="m15 45 8 5 30-34 1-12-12 4z"/><path fill="#eef4dc" d="M47 11 20 44l4 2 26-32z"/><path fill="#cba65b" d="m10 40 18 15 5-6-18-15z"/><path fill="#86533a" d="m9 48 8 7-5 6-8-7z"/><path d="m9 48 8 7"/>',
    scroll:'<path fill="#af8d4f" d="M12 7h37v47H12z"/><path fill="#e6d19a" d="M18 10h33v37H18z"/><path fill="#f4e0ac" d="M11 6h36a6 6 0 0 1 6 6H17a6 6 0 0 0-6-6Zm7 41h35a6 6 0 0 1-6 11H16a6 6 0 1 1 1-12"/><path d="M25 22h18M25 29h18M25 36h11"/><circle fill="#9b4434" cx="41" cy="45" r="7"/>',
    tavern:'<path fill="#b38953" d="M8 28h40v28H8z"/><path fill="#8e4737" d="m4 29 24-21 28 21z"/><path fill="#e6bc74" d="M14 34h10v12H14z"/><path fill="#403129" d="M31 37h10v19H31z"/><path d="M12 28v28M45 28v28M12 47h12M46 20h12v21"/><path fill="#d4b36a" d="M48 31h13v13H48z"/><path d="M51 34v7m5-7v7"/>',
    forge:'<path fill="#6e706b" d="M7 37h45l-7 10H23L14 56H8l8-13z"/><path fill="#b7b5a3" d="M6 31h31V20h19v11l-13 9H13z"/><path fill="#a67545" d="m19 6 6 3-11 23-6-3z"/><path fill="#d2cab4" d="m21 5 15 7-5 9-16-7z"/><path stroke="#e6a24d" d="m45 9 3 8m8-1-5 6M40 16l1 7"/>',
    heal:'<path fill="#9da991" d="M9 25h46v30H9z"/><path fill="#6f876f" d="m5 27 27-21 27 21z"/><path fill="#e4dbc1" d="M21 21h22v26H21z"/><path fill="#aa4f42" d="M29 25h6v6h6v6h-6v6h-6v-6h-6v-6h6z"/><path fill="#d5ccad" d="M26 49h12v10H26z"/>',
    camp:'<path fill="#b99b64" d="M4 48 31 8l29 40z"/><path fill="#d2bc87" d="m31 8 6 40H4z"/><path fill="#493d29" d="m32 25-8 23h20z"/><path d="M31 5v18M3 49h58M10 44 5 56m48-12 7 12"/><path stroke="#dd9456" d="m46 57 9-6m-10 0 9 6"/>',
    chest:'<path fill="#8f5c36" d="M7 28h50v28H7z"/><path fill="#b58b4c" d="M7 29V18c0-16 50-16 50 0v11z"/><path fill="#d3b169" d="M12 9h5v47h-5zm35 0h5v47h-5z"/><path d="M7 30h50"/><path fill="#f0d391" d="M27 25h11v15H27z"/><circle fill="#60492d" cx="32" cy="32" r="2"/>',
    coin:'<ellipse fill="#9e7135" cx="33" cy="36" rx="24" ry="23"/><circle fill="#d6ae5a" cx="30" cy="29" r="23"/><circle stroke="#f2d989" cx="30" cy="29" r="17"/><path stroke="#f4dd9b" stroke-width="3" d="M37 20c-14-8-21 10-6 10 13 0 8 16-6 10m5-26v30"/>',
    shield:'<path fill="#c2ae78" d="m31 5 24 8-3 25c-3 9-12 18-21 22C20 54 10 45 8 36L6 13z"/><path fill="#527467" d="m31 11 18 6-3 19c-2 7-9 13-15 17-8-4-15-11-17-18l-2-18z"/><path stroke="#d3bc7d" stroke-width="4" d="M31 14v35M16 29h30"/>',
    move:'<path fill="#b8b89b" d="m10 54 8-22-7-6L24 9l8 6-8 13 9 5-12 18z"/><path fill="#8ca89a" d="M30 35h14V22H34l16-16 13 16H52v22H30z"/><path stroke="#e5c47c" stroke-dasharray="3 4" d="M10 60h44"/>',
    map:'<path fill="#d3bd88" d="m5 15 17-8 20 7 17-8v42l-17 8-20-7-17 8z"/><path fill="#9aaa80" d="m10 22 9-5 7 13 14-6 13 4v12l-13 7-17-8-13 7z"/><path d="M22 7v42m20-35v42"/><path stroke="#93654a" stroke-dasharray="3 4" d="m13 30 19 8 17-15"/><circle fill="#a54f3d" cx="49" cy="23" r="4"/>',
    book:'<path fill="#654d3b" d="M6 12c15-8 22-2 26 2 6-6 17-7 26-2v42c-10-4-20-3-26 2-8-5-17-6-26-2z"/><path fill="#d9c59a" d="M10 10c9-3 16-1 22 4 8-5 14-6 22-3v37c-9-2-15-1-22 4-8-5-14-6-22-3z"/><path d="M32 14v37m-17-29 11 2m12 0 11-3M15 31l11 2m12 0 11-3"/>',
    people:'<path fill="#9db08f" d="M4 52V39c0-12 24-12 24 0v13zm31 0V39c0-12 25-12 25 0v13z"/><circle fill="#dfbd89" cx="16" cy="21" r="10"/><circle fill="#e5c396" cx="47" cy="21" r="10"/><path fill="#bb9c63" d="M18 59V40c0-15 28-15 28 0v19z"/><circle fill="#ecd3a8" cx="32" cy="22" r="12"/>',
    flag:'<path fill="#aa4c3e" d="M15 7h39l-8 13 8 13H15z"/><path stroke="#d7bc7b" stroke-width="4" d="M13 5v54M5 59h18"/><path stroke="#e2ba73" d="m26 13 7 6-7 6"/>',
    pause:'<path fill="#d9c18a" d="M16 12h10v40H16zm22 0h10v40H38z"/>',
    music:'<path fill="#bca56c" d="M25 10v36a9 9 0 1 1-5-8V14l33-8v33a9 9 0 1 1-5-8V16z"/>',
    play:'<path fill="#d9c18a" d="m19 10 33 22-33 22z"/>',
    stop:'<path fill="#b8705b" d="M14 14h36v36H14z"/>',
    save:'<path fill="#6d8b79" d="M9 6h39l9 10v42H9z"/><path fill="#d5c39a" d="M18 6h26v19H18zm0 31h30v21H18z"/><path d="M37 10v10M24 44h17m-17 6h17"/>',
    gear:'<path fill="#aa9b77" d="m25 5 14 1 2 9 9 4 8-3 5 13-8 6-2 8 3 9-12 7-7-7-9-1-8 5-9-11 5-8-1-8-7-7 8-11 9 3z"/><circle fill="#273e38" cx="33" cy="32" r="13"/><circle stroke="#ddca91" cx="33" cy="32" r="7"/>',
    info:'<circle fill="#667e71" cx="32" cy="32" r="25"/><path stroke="#e5d5ac" stroke-width="5" d="M32 28v20m0-31v3"/>',
    sun:'<circle fill="#d8b66a" cx="32" cy="32" r="13"/><path stroke="#d8b66a" stroke-width="3" d="M32 3v9m0 40v9M3 32h9m40 0h9M11 11l7 7m28 28 7 7M11 53l7-7m28-28 7-7"/>',
    heart:'<path fill="#bc6958" d="M32 56 8 32C-4 12 22 0 32 18 43 0 68 13 55 33z"/><path stroke="#eed1a3" d="m14 29 9 1 5-10 6 22 6-14h11"/>',
    arrow:'<path fill="#d5bd7b" d="M5 25h30V12l25 20-25 20V39H5z"/>',
    back:'<path fill="#d5bd7b" d="M59 25H29V12L4 32l25 20V39h30z"/>',
    formation:'<path fill="#abc4a3" d="M8 8h12v12H8zm18 0h12v12H26zm18 0h12v12H44zM8 27h12v12H8zm18 0h12v12H26zm18 0h12v12H44zM8 46h12v12H8zm18 0h12v12H26zm18 0h12v12H44z"/>',
    bag:'<path fill="#aa8650" d="m21 5 22 1-5 13c33 28 24 42-7 42S-6 43 26 19z"/><path stroke="#e3ca8b" stroke-width="3" d="M23 18h16M24 24h14"/><path stroke="#6e522e" d="M20 38c11-13 19 3 9 6s-5 12 6 5m-4-17v21"/>',
    zoom:'<circle fill="#719287" cx="27" cy="26" r="17"/><path stroke="#dfc68e" stroke-width="7" d="m40 40 16 17"/><path stroke="#d7e2c6" d="M17 26h20m-10-10v20"/>',
    journal:'<path fill="#a77d4c" d="M12 6h39v53H12z"/><path fill="#d9c69a" d="M18 11h29v42H18z"/><path d="M23 21h18M23 29h18M23 37h14M8 17h9M8 29h9M8 41h9"/>',
  };
  const icon=(name,cls='')=>`<svg class="game-icon ${cls}" viewBox="0 0 64 64" fill="none" stroke="#403f30" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]||shapes.flag}</svg>`;
  function decorate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{if(!el.firstElementChild)el.innerHTML=icon(el.dataset.icon);});}
  window.HRUI={icon,decorate};
})();
