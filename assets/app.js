(function(){
  var PASSWORD = "1234";  /* 입장 비밀번호 */

  var gate=document.getElementById('gate'),
      pwInput=document.getElementById('pwInput'),
      pwConfirm=document.getElementById('pwConfirm'),errMsg=document.getElementById('errMsg'),
      gateCard=document.getElementById('gateCard'),app=document.getElementById('app');

  /* 관리자 모드: 주소에 ?admin=1 또는 #admin 이 있을 때만 편집/백업 노출 */
  var isAdmin = /[?&]admin=1\b/.test(location.search) || /admin/i.test(location.hash);
  if(isAdmin) app.classList.add('admin');

  /* 관리자 PIN — 여기만 바꾸세요 (입장 비밀번호와 다르게 설정) */
  var ADMIN_PIN = "0000";
  if(isAdmin){
    var adminLock=document.getElementById('adminLock'),
        adminTools=document.getElementById('adminTools'),
        adminPin=document.getElementById('adminPin'),
        adminUnlock=document.getElementById('adminUnlock'),
        adminErr=document.getElementById('adminErr');
    var aUnlocked=false; try{ aUnlocked=sessionStorage.getItem('danbi_admin')==='1'; }catch(e){}
    if(aUnlocked){ adminLock.style.display='none'; adminTools.style.display='flex'; }
    var tryAdmin=function(){
      if(adminPin.value===ADMIN_PIN){
        try{ sessionStorage.setItem('danbi_admin','1'); }catch(e){}
        adminLock.style.display='none'; adminTools.style.display='flex';
      }else{ adminErr.classList.add('show'); adminPin.value=''; adminPin.focus(); }
    };
    adminUnlock.addEventListener('click',tryAdmin);
    adminPin.addEventListener('keydown',function(e){
      if(e.key==='Enter') tryAdmin();
      if(adminErr.classList.contains('show')) adminErr.classList.remove('show');
    });
  }

  try{ if(sessionStorage.getItem('danbi_in')==='1'){ unlock(true); } else { setTimeout(function(){pwInput.focus();},650); } }catch(e){ setTimeout(function(){pwInput.focus();},650); }
  function check(){
    if(pwInput.value===PASSWORD){ try{sessionStorage.setItem('danbi_in','1');}catch(e){} unlock(false); }
    else{ errMsg.classList.add('show');gateCard.classList.add('shake');pwInput.value='';
      setTimeout(function(){gateCard.classList.remove('shake');},420);pwInput.focus(); }
  }
  pwConfirm.addEventListener('click',check);
  pwInput.addEventListener('keydown',function(e){
    if(e.key==='Enter')check();
    if(errMsg.classList.contains('show'))errMsg.classList.remove('show');
  });
  function unlock(instant){
    app.classList.add('show');
    if(instant){gate.style.display='none';}
    else{gate.classList.add('hide');setTimeout(function(){gate.style.display='none';},500);
      setTimeout(function(){document.getElementById('searchInput').focus();},560);}
  }

  /* ===== 편집 모드 (모든 카드) ===== */
  var editToggle=document.getElementById('editToggle'),
      backupBtn=document.getElementById('backupBtn'),
      editMode=false;
  function cards(){ return [].slice.call(document.querySelectorAll('[data-cat]')); }
  function editEls(card){ return [].slice.call(card.querySelectorAll('[data-edit]')); }

  /* 저장값 불러오기 */
  function applySaved(){
    var data;
    try{ data=JSON.parse(localStorage.getItem('danbi_menu')||'null'); }catch(e){ data=null; }
    if(!data) return;
    cards().forEach(function(card){
      var key=card.getAttribute('data-cat'), saved=data[key];
      if(!saved) return;
      editEls(card).forEach(function(el){
        var f=el.getAttribute('data-edit');
        if(saved[f]!=null) el.textContent=saved[f];
      });
    });
  }
  applySaved();

  editToggle.addEventListener('click',function(){
    editMode=!editMode;
    app.classList.toggle('editmode',editMode);
    cards().forEach(function(card){
      editEls(card).forEach(function(el){ el.contentEditable=editMode?'true':'false'; });
    });
    editToggle.innerHTML = editMode ? '✅ 완료' : '✏️ 편집';
    editToggle.classList.toggle('primary',editMode);
    if(!editMode){ saveAll(); toast('편집 내용 저장됨'); }
    else toast('카드를 눌러 글자를 수정하세요');
  });

  function collect(){
    var out={};
    cards().forEach(function(card){
      var key=card.getAttribute('data-cat'),obj={};
      editEls(card).forEach(function(el){ obj[el.getAttribute('data-edit')]=el.textContent.trim(); });
      out[key]=obj;
    });
    return out;
  }
  function saveAll(){ try{ localStorage.setItem('danbi_menu',JSON.stringify(collect())); }catch(e){} }

  /* 백업: JSON 클립보드 복사 */
  backupBtn.addEventListener('click',function(){
    if(editMode){ saveAll(); }
    var json=JSON.stringify(collect(),null,2);
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(json).then(function(){ toast('카드 내용이 복사됐어요. Claude에게 붙여넣어 주세요'); },
        function(){ fallbackCopy(json); });
    }else{ fallbackCopy(json); }
  });
  function fallbackCopy(text){
    var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');toast('카드 내용이 복사됐어요');}catch(e){window.prompt('아래 내용을 복사해 Claude에게 보내주세요',text);}
    document.body.removeChild(ta);
  }

  var toastEl=document.getElementById('toast'),toastTimer;
  function toast(msg){
    toastEl.textContent=msg;toastEl.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove('show');},2200);
  }

  /* ===== 단일 데이터: 검색·카테고리·챗봇이 모두 이 FAQ를 사용 ===== */
  /* 시트 컬럼 → cat(분류) / sub(소분류=칩) / q(문의) / ment(안내 멘트) / next(후속 조치) / tags(키워드=#해시태그) / date(수정일) */
  var FAQ = [];  /* 데이터는 technical-faq.json 에서 불러옵니다 */;

  /* ===== 유틸 ===== */
  function norm(s){ return (s||'').replace(/\s+/g,'').toLowerCase(); }
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function copyText(t, btn){
    t = (t==null) ? '' : String(t);
    function ok(){
      toast('복사됐어요');
      if(btn){
        if(!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
        btn.textContent='복사됨 ✓';
        btn.classList.add('copied');
        clearTimeout(btn._copyTimer);
        btn._copyTimer=setTimeout(function(){
          btn.textContent=btn.getAttribute('data-label')||'복사';
          btn.classList.remove('copied');
        },1300);
      }
    }
    function fallback(){
      try{
        var ta=document.createElement('textarea');
        ta.value=t;
        ta.setAttribute('readonly','');     /* iOS: readonly + contentEditable 조합이 안전 */
        ta.contentEditable='true';
        ta.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;outline:0;box-shadow:none;background:transparent;opacity:0;';
        document.body.appendChild(ta);
        var range=document.createRange();
        range.selectNodeContents(ta);
        var sel=window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        try{ ta.setSelectionRange(0, t.length); }catch(e){}
        ta.focus();
        var done=false;
        try{ done=document.execCommand('copy'); }catch(e){ done=false; }
        document.body.removeChild(ta);
        if(done){ ok(); }
        else { window.prompt('아래 내용을 길게 눌러 복사해 주세요', t); }
      }catch(e){
        try{ window.prompt('아래 내용을 길게 눌러 복사해 주세요', t); }catch(e2){}
      }
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(ok, fallback);
    } else {
      fallback();
    }
  }
  function legacyCopy(t){ copyText(t); }  /* 하위 호환용 */

  /* ===== FAQ 렌더링 ===== */
  var faqView=document.getElementById('faqView'),faqChips=document.getElementById('faqChips'),
      faqCount=document.getElementById('faqCount'),fdList=document.getElementById('fdList'),
      fdDetail=document.getElementById('fdDetail'),stubEl=document.getElementById('stub'),
      chatPanel=document.getElementById('chatPanel'),tipBox=document.getElementById('tipBox'),
      currentCat='전체',activeChip='전체',curItems=[],curSel=0,
      currentGuide='tech',catGridEl=document.getElementById('catGrid'),techCatGridHTML='';

  function rowHTML(f,i,showSub){
    /* Dense Pro Support View: 좌측 목록에서 문서타입/소분류/사진유무를 빠르게 파악 */
    var type=(f.docType||'절차형').trim();
    var hasImage=!!(f.refImage || ((f.steps||[]).some(function(s){return !!s.image;})));
    var tagCount=(f.tags||[]).length;
    var sub=f.sub||'기타';
    var typeClass=(type==='참고형')?' ref':' step';
    var imgMark=hasImage?'<span class="row-mini">이미지</span>':'';
    var tagMark=tagCount?'<span class="row-mini">태그 '+tagCount+'</span>':'';
    return '<button class="fd-row" data-i="'+i+'">'
      +'<span class="row-meta">'
        +'<span class="row-type'+typeClass+'">'+esc(type)+'</span>'
        +'<span class="row-sub">'+esc(showSub ? (f.cat||sub) : sub)+'</span>'
      +'</span>'
      +'<span class="fq">'+esc(f.q)+'</span>'
      +'<span class="row-foot">'+imgMark+tagMark+'</span>'
    +'</button>';
  }
  function fmtSteps(t){
    t=(t||'').replace(/\r/g,'').trim();
    if(!t) return '';
    t=t.replace(/\s*([\u2460-\u246E\u3260-\u3266])/g,'\n$1'); /* ①-⑮, ㉠-㉦ 앞에서 줄바꿈 */
    t=t.replace(/\s*→\s*/g,'\n→ ');                          /* 화살표 단계 분리 */
    var parts=t.split('\n').map(function(s){return s.trim();}).filter(Boolean);
    if(parts.length<=1) return '<div class="step">'+esc(t)+'</div>';
    return '<div class="steps">'+parts.map(function(p){
      var h=esc(p).replace(/^(→|[\u2460-\u246E]|[\u3260-\u3266])\s*/,'<b class="sn">$1</b> ');
      return '<div class="step">'+h+'</div>';
    }).join('')+'</div>';
  }
  function splitTextSteps(t){
    t=(t||'').replace(/\r/g,'').trim();
    if(!t) return [];
    /* ①, ②, → 기준으로 너무 긴 안내문을 STEP 카드로 나눔 */
    var prepared=t
      .replace(/\s*([\u2460-\u246E\u3260-\u3266])/g,'\n$1 ')
      .replace(/\s*→\s*/g,'\n→ ');
    var parts=prepared.split('\n').map(function(s){return s.trim();}).filter(Boolean);
    if(parts.length<=1) return [{step:1,content:t,image:''}];
    return parts.map(function(p,i){
      return {step:i+1,content:p.replace(/^([\u2460-\u246E\u3260-\u3266]|→)\s*/,'').trim(),image:''};
    });
  }
  function normalizedSteps(f){
    /* 추후 GUIDE 시트/JSON에서 steps 배열이 들어오면 그대로 출력 */
    if(f.steps && Object.prototype.toString.call(f.steps)==='[object Array]' && f.steps.length){
      return f.steps.map(function(s,i){
        return {
          step:s.step||s.no||s.order||(i+1),
          title:s.title||'',
          content:s.content||s.text||s.ment||'',
          image:s.image||s.img||s.imageUrl||'',
          caption:s.caption||''
        };
      });
    }
    return splitTextSteps(f.ment);
  }
  function stepCardsHTML(f){
    var type=(f.docType||f.type||'절차형').trim();
    var steps=normalizedSteps(f);

    /* 참고형: 대표 이미지를 크게, STEP 텍스트는 설명 문서처럼 출력 */
    if(type==='참고형'){
      var refImg=f.refImage||'';
      var ref=refImg
        ? '<section class="pro-section ref-mode">'
            +'<div class="pro-section-head"><span class="section-icon">🖼️</span><div><b>참고 이미지</b><small>상담 중 바로 확인할 대표 화면입니다.</small></div></div>'
            +'<div class="ref-image-box pro-ref-image">'
              +'<img src="'+esc(refImg)+'" alt="'+esc(f.q||'참고 이미지')+'">'
            +'</div>'
          +'</section>'
        : '';

      var text=(steps||[]).map(function(s){return s.content;}).filter(Boolean).join('\n');
      if(!text) text=f.ment||'내용을 입력해주세요.';

      return ref
        +'<section class="pro-section">'
          +'<div class="pro-section-head"><span class="section-icon">📝</span><div><b>설명</b><small>이미지를 기준으로 확인해야 할 핵심 내용입니다.</small></div><button class="copy-btn section-copy copy-explain" title="설명 복사">복사</button></div>'
          +'<div class="explain-box pro-explain">'
            +'<div class="explain-content">'+esc(text)+'</div>'
          +'</div>'
        +'</section>';
    }

    /* 절차형: STEP마다 문구와 사진을 한 카드 안에 붙여 상담 흐름을 유지 */
    if(!steps.length) return '';
    return '<section class="pro-section">'
      +'<div class="pro-section-head"><span class="section-icon">🛠️</span><div><b>조치 내역</b><small>상담사가 순서대로 따라갈 수 있는 처리 흐름입니다.</small></div><button class="copy-btn section-copy copy-action" title="조치 내역 복사">복사</button></div>'
      +'<div class="step-cards pro-step-cards">'
      +steps.map(function(s,i){
        var n=s.step||i+1;
        var img=s.image
          ? '<div class="step-image pro-step-image"><img src="'+esc(s.image)+'" alt="STEP '+esc(String(n))+' 이미지">'+(s.caption?'<div class="step-image-caption">'+esc(s.caption)+'</div>':'')+'</div>'
          : '';
        return '<div class="step-card pro-step-card">'
          +'<div class="step-top"><span class="step-badge">'+String(n).padStart(2,'0')+'</span>'
          +'<span class="step-title">'+esc(s.title||('STEP '+n))+'</span></div>'
          +'<div class="step-content">'+esc(s.content||'내용을 입력해주세요.')+'</div>'
          +img
        +'</div>';
      }).join('')
      +'</div></section>';
  }
  function detailHTML(f){
    var tags=(f.tags||[]).map(function(t){return '<span class="ht">#'+esc(t)+'</span>';}).join('');
    var type=(f.docType||'절차형').trim();
    var typeClass=(type==='참고형')?' ref':' step';
    var imageCount=(f.refImage?1:0)+((f.steps||[]).filter(function(s){return !!s.image;}).length);
    var stepCount=(f.steps||[]).length;
    return '<div class="detail-shell">'
      +'<div class="detail-top pro-detail-top"><div class="detail-title-wrap">'
        +'<div class="dhead">'
          +'<span class="dtag">'+esc(f.cat)+(f.sub?' · '+esc(f.sub):'')+'</span>'
          +'<span class="doc-pill'+typeClass+'">'+esc(type)+'</span>'
          +(stepCount?'<span class="doc-stat">'+stepCount+' steps</span>':'')
          +(imageCount?'<span class="doc-stat">'+imageCount+' images</span>':'')
        +'</div>'
        +'<div class="dtitle">'+esc(f.q)+'</div>'
      +'</div>'
      +'</div>'
      +'<section class="customer-question">'
        +'<div class="customer-label">💬 고객 문의</div>'
        +'<div class="customer-text">'+esc(f.says||f.q||'')+'</div>'
      +'</section>'
      +stepCardsHTML(f)
      +(f.next?'<section class="pro-section"><div class="pro-section-head"><span class="section-icon">↗️</span><div><b>추가 조치 / 이관 기준</b><small>1차 조치 이후 필요한 후속 처리입니다.</small></div></div><div class="guide-panel transfer pro-panel">'+fmtSteps(f.next)+'</div></section>':'')
      +(f.note?'<section class="pro-section"><div class="pro-section-head"><span class="section-icon">📌</span><div><b>비고</b><small>상담 시 함께 확인할 보조 정보입니다.</small></div></div><div class="guide-panel note pro-panel">'+esc(f.note)+'</div></section>':'')
      +(tags?'<div class="fhash pro-tags">'+tags+'</div>':'')
    +'</div>';
  }

  function selectRow(i){
    curSel=i;
    var rows=fdList.querySelectorAll('.fd-row'),hit=null;
    for(var k=0;k<rows.length;k++){
      var on=(+rows[k].getAttribute('data-i')===i);
      rows[k].classList.toggle('active',on);
      if(on) hit=rows[k];
    }
    var f=curItems[i];
    fdDetail.innerHTML = f ? detailHTML(f) : '<div class="fd-empty">왼쪽에서 항목을 선택하세요.</div>';
    if(hit&&hit.scrollIntoView) hit.scrollIntoView({block:'nearest'});
  }
  function renderItems(items,showCat){
    curItems=items;
    if(!items.length){
      fdList.innerHTML='';
      fdDetail.innerHTML='<div class="fd-empty">관련 답변을 못 찾았어요. 간략하게 다시 단어를 적어 시도해주세요.</div>';
      return;
    }
    /* 전체·검색은 기기(cat)로, 기기 선택뷰는 소분류(sub)로 묶음 */
    var groupKey=showCat?'cat':'sub';
    var order=[],bucket={};
    items.forEach(function(f,i){
      var g=(f[groupKey]||'기타');
      if(!bucket[g]){ bucket[g]=[]; order.push(g); }
      bucket[g].push(i);                     /* curItems 원본 인덱스 보존 */
    });
    var html='';
    order.forEach(function(g){
      var ids=bucket[g];
      html+='<div class="fd-group">'+esc(g)+'<span class="fd-gcount">'+ids.length+'</span></div>';
      html+=ids.map(function(i){ return rowHTML(items[i],i,showCat); }).join('');
    });
    fdList.innerHTML=html;
    selectRow(0);
  }
  function chipValues(name){
    var out=[],key=(name==='전체')?'cat':'sub';
    FAQ.forEach(function(f){ if(name!=='전체'&&f.cat!==name)return; var v=f[key]; if(v&&out.indexOf(v)<0)out.push(v); });
    return out;
  }
  function renderChips(name){
    var vals=['전체'].concat(chipValues(name));
    faqChips.innerHTML=vals.map(function(v){
      return '<button class="fchip'+(v===activeChip?' on':'')+'" data-chip="'+esc(v)+'">'+esc(v)+'</button>';
    }).join('');
  }
  function filteredItems(name){
    var list=FAQ.filter(function(f){return name==='전체'||f.cat===name;});
    if(activeChip!=='전체'){
      var key=(name==='전체')?'cat':'sub';
      list=list.filter(function(f){return f[key]===activeChip;});
    }
    return list;
  }
function renderCategory(name){
  currentCat=name;
  activeChip='전체';

  if(name==='점검현황'){
    window.open('pages/점검현황.html','_blank');
    return;
}

  if(name==='단비폰'){
      window.open('pages/danbiphone.html','_blank');
      return;
  }
    chatPanel.style.display='none';
    var has=(name==='전체')||FAQ.some(function(f){return f.cat===name;});
    if(!has){ faqView.style.display='none'; stubEl.style.display=''; 
      tipBox.innerHTML='💡 <span><b>'+esc(name)+'</b> — 콘텐츠를 채우면 여기에 표시됩니다.</span>'; return; }
    tipBox.innerHTML=(name==='전체')
      ? '💡 <span><b>전체</b> — 검색창에 키워드를 넣거나 칩으로 분류를 좁혀보세요.</span>'
      : '💡 <span><b>'+esc(name)+'</b> — 칩으로 소분류를 좁히거나 항목을 펼쳐 확인하세요.</span>';
    renderChips(name);
    var items=filteredItems(name);
    faqCount.innerHTML='총 <b>'+items.length+'</b>개';
    renderItems(items, name==='전체');
    stubEl.style.display='none'; faqView.style.display='block';
  }
  function runSearch(q){
    var nq=norm(q);
    var res=FAQ.filter(function(f){
      return norm(f.q).indexOf(nq)>=0||norm(f.ment).indexOf(nq)>=0||norm(f.next).indexOf(nq)>=0
        ||norm(f.says).indexOf(nq)>=0||norm(f.note).indexOf(nq)>=0
        ||(f.tags||[]).some(function(t){var nt=norm(t);return nt.indexOf(nq)>=0||(nq.length>=2&&nq.indexOf(nt)>=0);});
    });
    faqChips.innerHTML=''; activeChip='전체';
    faqCount.innerHTML='검색 “<b>'+esc(q)+'</b>” · '+res.length+'개';
    renderItems(res, true);
    stubEl.style.display='none'; chatPanel.style.display='none'; faqView.style.display='block';
  }

  /* 목록 행 클릭 → 상세 표시 */
  fdList.addEventListener('click',function(e){
    if(currentGuide==='general' || currentGuide==='globalSearch') return;
    var row=e.target.closest('.fd-row'); if(!row) return;
    selectRow(+row.getAttribute('data-i'));
  });
  /* 상세 영역: 해시태그 검색 / 복사 */
  /* ===== 사진 확대 보기 (라이트박스) ===== */
  var lightbox=null;
  function openLightbox(src,alt){
    if(!src) return;
    if(!lightbox){
      lightbox=document.createElement('div'); lightbox.id='lightbox';
      lightbox.innerHTML='<button id="lbClose" title="닫기" aria-label="닫기">✕</button><img alt="">';
      document.body.appendChild(lightbox);
      lightbox.addEventListener('click',function(e){
        if(e.target===lightbox || e.target.id==='lbClose') closeLightbox();
      });
    }
    var img=lightbox.querySelector('img');
    img.setAttribute('src',src); img.setAttribute('alt',alt||'');
    lightbox.classList.add('show');
  }
  function closeLightbox(){ if(lightbox) lightbox.classList.remove('show'); }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeLightbox(); });

  fdDetail.addEventListener('click',function(e){
    var im=e.target.closest('.step-image img, .ref-image-box img');
    if(im){ openLightbox(im.getAttribute('src'), im.getAttribute('alt')); return; }
    var ht=e.target.closest('.ht');
    if(ht){ var kw=ht.textContent.replace('#',''); applyQuery(kw); window.scrollTo({top:0,behavior:'smooth'}); return; }
    var f=curItems[curSel]; if(!f) return;
    var ff=(f && f.source && f.f) ? f.f : f;   /* 통합검색 결과는 {source,f} 래퍼라 풀어줌 */
    if(e.target.closest('.copy-general-reply')){
      copyText(ff.reply || ff.q || '', e.target.closest('.copy-btn'));
      return;
    }
    if(e.target.closest('.copy-explain, .copy-action')){
      var steps=normalizedSteps(ff);
      var body=(steps||[]).map(function(s,i){
        var n=s.step||i+1;
        return String(n).padStart(2,'0')+'. '+(s.content||'');
      }).filter(Boolean).join('\n');
      copyText(body || ff.ment || ff.q || '', e.target.closest('.copy-btn'));
      return;
    }
  });
  faqChips.addEventListener('click',function(e){
    var c=e.target.closest('.fchip'); if(!c) return;
    activeChip=c.getAttribute('data-chip');
    renderChips(currentCat);
    var items=filteredItems(currentCat);
    faqCount.innerHTML='총 <b>'+items.length+'</b>개';
    renderItems(items, currentCat==='전체');
  });

  /* ===== 카테고리 카드 선택 ===== */
  function selectCat(card){
    cards().forEach(function(x){x.classList.remove('active');});
    card.classList.add('active');
    renderCategory(card.getAttribute('data-cat'));
  }
  cards().forEach(function(card){
    card.addEventListener('click',function(e){
      if(editMode) return;
      if(e.target.isContentEditable) return;
      selectCat(card);
    });
  });

  /* ===== 일반상담 가이드 뼈대 ===== */
  var GENERAL_FAQ=[];
  var GENERAL_CATS=[
    {cat:'체험학습',icon:'🧸',desc:'무료체험 · 신청 · 재체험'},
    {cat:'유료학습',icon:'🎓',desc:'상품 · 비용 · 신청 · 변경'},
    {cat:'해지/환불',icon:'↩️',desc:'해지 · 위약금 · 청약철회'},
    {cat:'배송/회수',icon:'📦',desc:'배송 · 회수 · 반납 · 추가배송'},
    {cat:'결제/청구',icon:'💳',desc:'결제수단 · 미납 · 현금영수증'},
    {cat:'학습/교재',icon:'📚',desc:'교재 · 단계 · 화상수업 · 앱'},
    {cat:'시스템/이관',icon:'🖥️',desc:'공감센터 · 통합관리자 · 해피톡'},
    {cat:'응대원칙/Q&A',icon:'💬',desc:'응대기준 · 기본절차 · 상담 Q&A'}
  ];
  var GENERAL_PLACEHOLDER=[
    {cat:'체험학습',sub:'무료체험',q:'무료체험 신청 및 진행 절차 안내',says:'무료체험은 어떻게 신청하고 언제부터 시작되나요?',reply:'무료체험은 신청 경로와 회원 상태를 확인한 뒤 체험 가능 여부, 배송 일정, 로그인 기준 체험 기간을 안내합니다.',criteria:'연령 기준 / 기존 체험 이력 / 신청 경로 / 배송 상태 확인',process:'1. 회원 및 학생 정보 확인\\n2. 체험 가능 연령 확인\\n3. 기존 체험 이력 확인\\n4. 신청 경로 및 배송 상태 안내\\n5. 담당 선생님 상담 필요 시 이관',caution:'체험 기간은 배송 기준이 아니라 학습기 로그인 기준으로 안내합니다.',tags:['무료체험','체험신청','재체험','권장연령']},
    {cat:'유료학습',sub:'상품/비용',q:'유료학습 상품 종류 및 비용 안내',says:'정회원 상품은 어떤 종류가 있고 비용은 어떻게 되나요?',reply:'회원이 관심 있는 상품과 약정 기간을 확인한 뒤, 상품별 비용과 상담교사 안내 필요 여부를 구분해 안내합니다.',criteria:'상품 종류 / 약정 기간 / 단과·종합반 / 프로모션 적용 여부 확인',process:'1. 관심 상품 확인\\n2. 약정 기간 확인\\n3. 상품별 비용 기준 확인\\n4. 결제 또는 상담교사 연결 안내',caution:'할인·프로모션은 시점별로 달라질 수 있으므로 최종 금액은 회원별 조건 확인 후 안내합니다.',tags:['유료학습','정회원','상품','비용']},
    {cat:'해지/환불',sub:'해지',q:'유료학습 해지 및 환불 가능 여부 안내',says:'해지하면 환불이나 위약금이 어떻게 되나요?',reply:'이용 상품, 약정, 결제일, 사용 기간, 반납 여부를 확인한 뒤 해지 접수 가능 여부와 담당부서 상담 필요 사항을 안내합니다.',criteria:'결제일 7일 전 여부 / 약정 유형 / 이용 개월 수 / 미납 여부 / 반납 대상 확인',process:'1. 회원 상태 확인\\n2. 상품 및 약정 확인\\n3. 결제일 기준 확인\\n4. 해지상담 이관 또는 접수 안내\\n5. 위약금·환불 상세는 담당부서 상담 연결',caution:'위약금은 회원별 조건에 따라 달라지므로 단정 안내하지 않고 담당 상담을 통해 확인하도록 안내합니다.',tags:['해지','환불','위약금','청약철회']},
    {cat:'배송/회수',sub:'배송상태',q:'배송 상태 및 주소 변경 문의',says:'기기는 언제 도착하고 배송지를 바꿀 수 있나요?',reply:'배송 요청 상태와 송장 출력 여부를 확인한 뒤 배송 예정일, 주소 변경 가능 여부, 수취거부/재배송 필요 여부를 안내합니다.',criteria:'배송전 / 배송중 / 배송완료 / 운송장 출력 전후 확인',process:'1. 회원 배송 상태 확인\\n2. 송장 출력 여부 확인\\n3. 주소 변경 가능 여부 판단\\n4. 배송 또는 회수 절차 안내',caution:'운송장 출력 이후에는 시스템 주소 변경이 실제 배송에 반영되지 않을 수 있습니다.',tags:['배송','주소변경','송장','회수']},
    {cat:'결제/청구',sub:'결제수단',q:'결제수단 변경 및 미납 문의',says:'카드를 바꾸거나 미납금을 결제하려면 어떻게 해야 하나요?',reply:'회원의 결제수단, 미납 회차, 결제 실패 이력을 확인한 뒤 카드 변경, 재결제, 가상계좌 또는 담당부서 이관 기준을 안내합니다.',criteria:'정기결제 카드 / 미납 회차 / 결제 실패 사유 / 가상계좌 여부 확인',process:'1. 결제내역 확인\\n2. 결제수단 확인\\n3. 미납 회차 및 실패 사유 확인\\n4. 재결제 또는 카드 변경 안내\\n5. 필요 시 담당부서 이관',caution:'결제 금액과 납부 방식은 회원별 청구 상태 확인 후 안내합니다.',tags:['결제','청구','미납','카드변경']},
    {cat:'학습/교재',sub:'교재/수업',q:'정회원 교재 구성 및 화상수업 문의',says:'정회원 교재는 어떻게 오고 화상수업은 어떻게 진행되나요?',reply:'회원 상품과 학습 과목을 확인한 뒤 교재 구성, 정기배송 기준, 화상수업 운영 기준을 안내합니다.',criteria:'상품 종류 / 과목 / 정기배송 일정 / 화상수업 대상 여부 확인',process:'1. 회원 상품 확인\\n2. 과목 및 단계 확인\\n3. 교재 구성 안내\\n4. 화상수업 대상 여부 안내\\n5. 변경 요청 시 선생님 상담 이관',caution:'단계·회차 변경은 공감센터에서 직접 처리 권한이 없을 수 있어 담당교사 상담으로 연결합니다.',tags:['교재','화상수업','단계변경','학부모앱']},
    {cat:'시스템/이관',sub:'업무시스템',q:'공감센터/통합관리자 확인 및 상담 이관 방법',says:'상담 이력이나 배송/결제 정보는 어디서 확인하나요?',reply:'공감센터와 통합관리자에서 확인 가능한 정보와 상담예약, 해피콜, 이관 버튼 사용 기준을 안내합니다.',criteria:'회원정보 / 상담이력 / 배송내역 / 결제내역 / 이슈내역 확인',process:'1. 회원 정보 2가지 이상 확인\\n2. 공감센터 상담이력 확인\\n3. 통합관리자 기본정보 확인\\n4. 필요 업무에 맞게 상담요청·예약·이관 처리',caution:'일정 예약 후 상담하기 버튼을 누르면 메모가 저장되지 않을 수 있어 사전 복사 후 진행합니다.',tags:['공감센터','통합관리자','해피톡','상담이관']},
    {cat:'응대원칙/Q&A',sub:'응대기준',q:'고객 응대 원칙 및 상담 Q&A 확인',says:'강성 고객이나 예외 문의는 어떻게 응대해야 하나요?',reply:'고객 응대 원칙, 기본 상담 절차, 상담 Q&A를 기준으로 사과·확인·안내·이관 순서로 응대합니다.',criteria:'고객 불편 내용 / 귀책 여부 / 확인 가능한 이력 / 이관 필요 여부 판단',process:'1. 고객 불편에 먼저 공감\\n2. 회원 정보와 이력 확인\\n3. 가능한 조치 안내\\n4. 예외·강성·정책 문의는 팀장 또는 담당부서 이관',caution:'정책·금액·위약금 등 민감 사항은 단정 표현을 피하고 확인 후 안내합니다.',tags:['응대원칙','강성고객','상담QA','기본절차']}
  ];

  function generalCount(cat){
    return GENERAL_FAQ.filter(function(f){return f.cat===cat;}).length;
  }

  function renderGeneralCards(){
    if(!techCatGridHTML) techCatGridHTML=catGridEl.innerHTML;
    catGridEl.innerHTML=GENERAL_CATS.map(function(c){
      var cnt=generalCount(c.cat);
      return '<div class="cat general-cat" data-gcat="'+esc(c.cat)+'">'
        +'<div class="emoji">'+esc(c.icon)+'</div>'
        +'<div class="name">'+esc(c.cat)+'</div>'
        +'<div class="desc">'+esc(c.desc)+'</div>'
        +'<span class="cat-count" style="'+(cnt?'':'display:none')+'">'+(cnt||'')+'</span>'
      +'</div>';
    }).join('');
  }

  function restoreTechCards(){
    if(techCatGridHTML) catGridEl.innerHTML=techCatGridHTML;
    updateCategoryCounts();
  }

  function generalItems(cat){
    var data=GENERAL_FAQ.length?GENERAL_FAQ:GENERAL_PLACEHOLDER;
    return cat==='전체' ? data : data.filter(function(f){return f.cat===cat;});
  }

  function generalRowHTML(f,i){
    return '<button class="fd-row general-row" data-gi="'+i+'">'
      +'<span class="row-meta"><span class="row-type ref">일반상담</span><span class="row-sub">'+esc(f.sub||'기타')+'</span></span>'
      +'<span class="fq">'+esc(f.q)+'</span>'
      +'<span class="row-foot"><span class="row-mini">응대멘트</span><span class="row-mini">처리기준</span></span>'
    +'</button>';
  }

  function generalDetailHTML(f){
    var tags=(f.tags||[]).map(function(t){return '<span class="ht">#'+esc(t)+'</span>';}).join('');
    return '<div class="detail-shell general-detail">'
      +'<div class="detail-top pro-detail-top"><div class="detail-title-wrap">'
        +'<div class="dhead"><span class="dtag">'+esc(f.cat)+(f.sub?' · '+esc(f.sub):'')+'</span><span class="doc-pill ref">일반상담</span></div>'
        +'<div class="dtitle">'+esc(f.q)+'</div>'
      +'</div></div>'
      +'<section class="customer-question"><div class="customer-label">💬 고객 문의</div><div class="customer-text">'+esc(f.says||f.q||'')+'</div></section>'
      +'<section class="pro-section"><div class="pro-section-head"><span class="section-icon">🗣️</span><div><b>추천 응대 멘트</b><small>상담사가 바로 참고하거나 복사할 수 있는 안내 문구입니다.</small></div><button class="copy-btn section-copy copy-general-reply" title="응대 멘트 복사">복사</button></div><div class="general-answer-box">'+esc(f.reply||'일반상담 CSV 연결 후 응대 멘트가 표시됩니다.')+'</div></section>'
      +'<section class="general-info-grid">'
        +'<div class="general-info-card"><b>처리 기준</b><p>'+esc(f.criteria||'가능/불가/예외 기준을 입력합니다.')+'</p></div>'
        +'<div class="general-info-card"><b>진행 절차</b><p>'+esc(f.process||'1. 회원 확인\\n2. 조건 확인\\n3. 안내 또는 접수')+'</p></div>'
      +'</section>'
      +'<section class="pro-section"><div class="pro-section-head"><span class="section-icon">⚠️</span><div><b>주의사항</b><small>민원 방지, 이관 기준, 예외 조건을 정리합니다.</small></div></div><div class="guide-panel note pro-panel">'+esc(f.caution||'상담 전 회원별 조건을 반드시 확인합니다.')+'</div></section>'
      +(tags?'<div class="fhash pro-tags">'+tags+'</div>':'')
    +'</div>';
  }

  function renderGeneralItems(cat){
    var items=generalItems(cat);
    curItems=items;
    faqChips.innerHTML='';
    faqCount.innerHTML=(GENERAL_FAQ.length?'총 <b>'+items.length+'</b>개':'CSV 연결 전 미리보기 · <b>'+items.length+'</b>개');
    if(!items.length){
      fdList.innerHTML='';
      fdDetail.innerHTML='<div class="fd-empty">일반상담 CSV가 연결되면 자주 묻는 질문 리스트가 여기에 표시됩니다.</div>';
      return;
    }
    var html='';
    items.forEach(function(f,i){ html+=generalRowHTML(f,i); });
    fdList.innerHTML=html;
    fdDetail.innerHTML=generalDetailHTML(items[0]);
    curSel=0;
    var first=fdList.querySelector('.fd-row');
    if(first) first.classList.add('active');
  }


  function generalData(){
    return GENERAL_FAQ.length ? GENERAL_FAQ : GENERAL_PLACEHOLDER;
  }

  function techMatch(f,nq){
    return norm(f.q).indexOf(nq)>=0||norm(f.ment).indexOf(nq)>=0||norm(f.next).indexOf(nq)>=0
      ||norm(f.says).indexOf(nq)>=0||norm(f.note).indexOf(nq)>=0
      ||(f.tags||[]).some(function(t){var nt=norm(t);return nt.indexOf(nq)>=0||(nq.length>=2&&nq.indexOf(nt)>=0);});
  }

  function generalMatch(f,nq){
    return norm(f.q).indexOf(nq)>=0||norm(f.says).indexOf(nq)>=0||norm(f.reply).indexOf(nq)>=0
      ||norm(f.criteria).indexOf(nq)>=0||norm(f.process).indexOf(nq)>=0||norm(f.caution).indexOf(nq)>=0
      ||(f.tags||[]).some(function(t){var nt=norm(t);return nt.indexOf(nq)>=0||(nq.length>=2&&nq.indexOf(nt)>=0);});
  }

  function globalRowHTML(item,i){
    var f=item.f;
    var label=item.source==='tech'?'기술상담':'일반상담';
    var sub=f.sub||'기타';
    var count=(f.tags||[]).length;
    return '<button class="fd-row global-row" data-global-i="'+i+'">'
      +'<span class="row-meta"><span class="row-type '+(item.source==='tech'?'step':'ref')+'">'+label+'</span><span class="row-sub">'+esc(f.cat||'기타')+(sub?' · '+esc(sub):'')+'</span></span>'
      +'<span class="fq">'+esc(f.q||'제목 없음')+'</span>'
      +'<span class="row-foot">'+(count?'<span class="row-mini">태그 '+count+'</span>':'')+'</span>'
    +'</button>';
  }

  function runGlobalSearch(q){
    var nq=norm(q), all=[];
    FAQ.forEach(function(f){ if(techMatch(f,nq)) all.push({source:'tech',f:f}); });
    generalData().forEach(function(f){ if(generalMatch(f,nq)) all.push({source:'general',f:f}); });

    currentGuide='globalSearch';
    activeChip='전체';
    faqChips.innerHTML='';
    chatPanel.style.display='none';
    stubEl.style.display='none';
    faqView.style.display='block';
    faqCount.innerHTML='전체 검색 “<b>'+esc(q)+'</b>” · '+all.length+'개 <span style="color:#98A2B3;font-weight:500;">기술상담 '+all.filter(function(x){return x.source==='tech';}).length+' · 일반상담 '+all.filter(function(x){return x.source==='general';}).length+'</span>';

    curItems=all;
    if(!all.length){
      fdList.innerHTML='';
      fdDetail.innerHTML='<div class="fd-empty">관련 답변을 찾지 못했어요.<br>기술상담/일반상담 시트의 제목, 태그, 고객문의, 응대멘트를 확인해 주세요.</div>';
      return;
    }

    var tech=all.filter(function(x){return x.source==='tech';});
    var general=all.filter(function(x){return x.source==='general';});
    var html='';
    if(tech.length){
      html+='<div class="fd-group">기술상담<span class="fd-gcount">'+tech.length+'</span></div>';
      all.forEach(function(item,i){ if(item.source==='tech') html+=globalRowHTML(item,i); });
    }
    if(general.length){
      html+='<div class="fd-group">일반상담<span class="fd-gcount">'+general.length+'</span></div>';
      all.forEach(function(item,i){ if(item.source==='general') html+=globalRowHTML(item,i); });
    }
    fdList.innerHTML=html;
    curSel=0;
    fdDetail.innerHTML=all[0].source==='tech'?detailHTML(all[0].f):generalDetailHTML(all[0].f);
    var first=fdList.querySelector('.fd-row');
    if(first) first.classList.add('active');
  }

  function renderGeneralGuide(cat){
    currentGuide='general';
    currentCat=cat||'전체';
    activeChip='전체';
    chatPanel.style.display='none';
    stubEl.style.display='none';
    faqView.style.display='block';
    renderGeneralCards();
    tipBox.innerHTML=GENERAL_FAQ.length
      ? '💡 <span><b>일반상담 가이드</b> — 카테고리를 선택하거나 검색창으로 응대 멘트를 찾아보세요.</span>'
      : '💡 <span><b>일반상담 가이드</b> — 구글시트 CSV에서 일반상담 데이터를 불러옵니다.</span>';
    renderGeneralItems(currentCat);
  }

  function runGeneralSearch(q){
    var nq=norm(q);
    var data=GENERAL_FAQ.length?GENERAL_FAQ:GENERAL_PLACEHOLDER;
    var res=data.filter(function(f){
      return norm(f.q).indexOf(nq)>=0||norm(f.says).indexOf(nq)>=0||norm(f.reply).indexOf(nq)>=0
        ||norm(f.criteria).indexOf(nq)>=0||norm(f.process).indexOf(nq)>=0||norm(f.caution).indexOf(nq)>=0
        ||(f.tags||[]).some(function(t){return norm(t).indexOf(nq)>=0;});
    });
    currentGuide='general';
    faqChips.innerHTML='';
    faqCount.innerHTML='일반상담 검색 “<b>'+esc(q)+'</b>” · '+res.length+'개';
    curItems=res;
    if(!res.length){
      fdList.innerHTML='';
      fdDetail.innerHTML='<div class="fd-empty">관련 일반상담 항목을 찾지 못했어요. 다른 키워드로 검색해 주세요.</div>';
      return;
    }
    fdList.innerHTML=res.map(function(f,i){return generalRowHTML(f,i);}).join('');
    fdDetail.innerHTML=generalDetailHTML(res[0]);
    curSel=0;
    var first=fdList.querySelector('.fd-row');
    if(first) first.classList.add('active');
    faqView.style.display='block'; stubEl.style.display='none'; chatPanel.style.display='none';
  }

  /* ===== 상담 가이드 전환 카드 ===== */
  document.querySelectorAll('.guide-entry-card').forEach(function(card){
    card.addEventListener('click',function(){
      var guide=card.getAttribute('data-guide');
      document.querySelectorAll('.guide-entry-card').forEach(function(x){x.classList.remove('active');});
      card.classList.add('active');
      if(guide==='tech'){
        currentGuide='tech';
        restoreTechCards();
        renderCategory('전체');
        document.querySelector('.cat-head').scrollIntoView({block:'start',behavior:'smooth'});
      }else{
        renderGeneralGuide('전체');
        document.querySelector('.cat-head').scrollIntoView({block:'start',behavior:'smooth'});
      }
    });
  });

  catGridEl.addEventListener('click',function(e){
    var g=e.target.closest('.general-cat');
    if(g){
      renderGeneralGuide(g.getAttribute('data-gcat'));
      catGridEl.querySelectorAll('.general-cat').forEach(function(x){x.classList.remove('active');});
      g.classList.add('active');
      return;
    }
    var c=e.target.closest('.cat[data-cat]');
    if(c && currentGuide==='tech'){
      selectCat(c);
    }
  });

  fdList.addEventListener('click',function(e){
    if(currentGuide!=='general') return;
    var row=e.target.closest('.general-row'); if(!row) return;
    var i=+row.getAttribute('data-gi');
    curSel=i;
    fdList.querySelectorAll('.fd-row').forEach(function(x){x.classList.remove('active');});
    row.classList.add('active');
    fdDetail.innerHTML=generalDetailHTML(curItems[i]);
  });

  fdList.addEventListener('click',function(e){
    if(currentGuide!=='globalSearch') return;
    var row=e.target.closest('.global-row'); if(!row) return;
    var i=+row.getAttribute('data-global-i');
    var item=curItems[i];
    if(!item) return;
    curSel=i;
    fdList.querySelectorAll('.fd-row').forEach(function(x){x.classList.remove('active');});
    row.classList.add('active');
    fdDetail.innerHTML=item.source==='tech'?detailHTML(item.f):generalDetailHTML(item.f);
  });

  function openGlobalAi(){
    currentGuide='ai';
    faqView.style.display='none';
    stubEl.style.display='none';
    chatPanel.style.display='block';
    tipBox.innerHTML='💡 <span><b>AI 도움말</b> — 윙크가 기술상담과 일반상담 전체에서 가까운 추천 답변 키워드를 먼저 보여드려요.</span>';
    document.querySelectorAll('.guide-entry-card').forEach(function(x){x.classList.remove('active');});
    initChat();
    document.getElementById('chatPanel').scrollIntoView({block:'start',behavior:'smooth'});
  }

  var globalAiBtn=document.getElementById('globalAiBtn');
  if(globalAiBtn) globalAiBtn.addEventListener('click',openGlobalAi);


  /* ===== 상단 통합 검색 ===== */
  var searchInput=document.getElementById('searchInput'),searchInput2=document.getElementById('searchInput2');
  function applyQuery(q){
    q=(q||'').trim();
    if(searchInput.value!==q) searchInput.value=q;
    if(searchInput2.value!==q) searchInput2.value=q;
    if(q){
      runGlobalSearch(q);
    }else if(currentGuide==='general'){
      renderGeneralGuide(currentCat||'전체');
    }else if(currentGuide==='ai'){
      openGlobalAi();
    }else{
      currentGuide='tech';
      restoreTechCards();
      renderCategory(currentCat||'전체');
    }
  }
  searchInput.addEventListener('input',function(){ applyQuery(this.value); });
  searchInput2.addEventListener('input',function(){ applyQuery(this.value); });

  document.querySelectorAll('.hero-chips-v3 [data-query]').forEach(function(btn){
    btn.addEventListener('click',function(){
      applyQuery(this.getAttribute('data-query')||this.textContent);
      document.getElementById('faqView').scrollIntoView({block:'start',behavior:'smooth'});
    });
  });

  /* ===== AI도움말 챗봇 (같은 FAQ 사용) ===== */
  var SUGGEST=["와이파이 연결","지인추천","카드 변경","해지 문의","배송 조회","학부모앱 로그인"];
  var chatLog=document.getElementById('chatLog'),chatSuggest=document.getElementById('chatSuggest'),
      chatText=document.getElementById('chatText'),chatSend=document.getElementById('chatSend'),chatReady=false;
  var lastWho=null, MASCOT='assets/rabbit-3d-side.png';

  function nowTime(){
    var d=new Date(),h=d.getHours(),m=d.getMinutes(),ap=h<12?'오전':'오후',hh=h%12;
    if(hh===0)hh=12;
    return ap+' '+hh+':'+(m<10?'0'+m:m);
  }

  function avatarHTML(grouped){
    return '<div class="avatar">'+(grouped?'':'<img src="'+MASCOT+'" alt="윙크">')+'</div>';
  }

  function addMsg(text,who){
    var grouped=(lastWho===who);
    var row=document.createElement('div'); row.className='msg-row '+who+(grouped?' grouped':'');
    var h='';
    if(who==='bot') h+=avatarHTML(grouped);
    h+='<div class="bubble-wrap">';
    if(who==='bot'&&!grouped) h+='<div class="bname">윙크</div>';
    h+='<div class="brow"><div class="bubble"></div><span class="time">'+nowTime()+'</span></div></div>';
    row.innerHTML=h;
    row.querySelector('.bubble').textContent=text;
    chatLog.appendChild(row); chatLog.scrollTop=chatLog.scrollHeight;
    lastWho=who;
  }

  function matchScore(f,nq,tokens){
    var score=0;
    var fields=[
      {v:f.q,w:5},{v:f.says,w:4},{v:(f.tags||[]).join(' '),w:5},
      {v:f.ment,w:3},{v:f.next,w:2},{v:f.note,w:1},{v:f.cat,w:1},{v:f.sub,w:1}
    ];
    fields.forEach(function(field){
      var nv=norm(field.v);
      if(!nv) return;
      if(nv.indexOf(nq)>=0) score+=field.w;
      tokens.forEach(function(t){
        if(t.length>=2 && nv.indexOf(t)>=0) score+=Math.max(1,Math.round(field.w/2));
      });
    });
    return score;
  }

  function topMatches(q){
    var nq=norm(q);
    var tokens=(q||'').toLowerCase().split(/[\s,./|#]+/).map(norm).filter(function(t){return t.length>=2;});
    var ranked=[];
    FAQ.forEach(function(f){
      var s=matchScore(f,nq,tokens);
      if(s>0) ranked.push({source:'tech',f:f,score:s});
    });
    generalData().forEach(function(f){
      var s=0;
      [
        {v:f.q,w:5},{v:f.says,w:4},{v:(f.tags||[]).join(' '),w:5},
        {v:f.reply,w:4},{v:f.criteria,w:3},{v:f.process,w:3},{v:f.caution,w:2},{v:f.cat,w:1},{v:f.sub,w:1}
      ].forEach(function(field){
        var nv=norm(field.v);
        if(!nv) return;
        if(nv.indexOf(nq)>=0) s+=field.w;
        tokens.forEach(function(t){
          if(t.length>=2 && nv.indexOf(t)>=0) s+=Math.max(1,Math.round(field.w/2));
        });
      });
      if(s>0) ranked.push({source:'general',f:f,score:s});
    });
    ranked.sort(function(a,b){return b.score-a.score;});
    return ranked.slice(0,5);
  }

  function answerText(item){
    var source=item && item.source ? item.source : 'tech';
    var f=item && item.f ? item.f : item;
    if(source==='general'){
      return '📌 [일반상담 · '+(f.cat||'')+'] '+(f.q||'')+
        (f.says?'\n\n[고객 문의]\n'+f.says:'')+
        (f.reply?'\n\n[추천 응대 멘트]\n'+f.reply:'')+
        (f.criteria?'\n\n[처리 기준]\n'+f.criteria:'')+
        (f.process?'\n\n[진행 절차]\n'+f.process:'')+
        (f.caution?'\n\n[주의사항]\n'+f.caution:'');
    }
    var steps=normalizedSteps(f);
    var body=(steps||[]).map(function(s,i){
      var n=s.step||i+1;
      return String(n).padStart(2,'0')+'. '+(s.content||'');
    }).filter(Boolean).join('\n');
    if(!body) body=f.ment||'';
    return '📌 [기술상담 · '+(f.cat||'')+'] '+(f.q||'')+
      (f.says?'\n\n[고객 문의]\n'+f.says:'')+
      (body?'\n\n[추천 답변]\n'+body:'')+
      (f.next?'\n\n[추가 조치]\n'+f.next:'')+
      (f.note?'\n\n[비고]\n'+f.note:'');
  }

  function addRecommendationMsg(items,q){
    var grouped=(lastWho==='bot');
    var row=document.createElement('div'); row.className='msg-row bot ai-recommend-row'+(grouped?' grouped':'');
    var h=avatarHTML(grouped)
      +'<div class="bubble-wrap">';
    if(!grouped) h+='<div class="bname">윙크</div>';
    h+='<div class="brow"><div class="bubble ai-recommend-bubble">'
      +'<div class="rec-title">추천 답변 키워드를 찾았어요</div>'
      +'<div class="rec-desc">입력한 <b>'+esc(q)+'</b>와 가까운 기술상담/일반상담 항목이에요. 답변을 보려면 키워드를 선택해주세요.</div>'
      +'<div class="rec-list">';
    items.forEach(function(item,order){
      var f=item.f||item;
      var source=item.source||'tech';
      var idx=source==='general'?generalData().indexOf(f):FAQ.indexOf(f);
      var type=source==='general'?'일반상담':'기술상담';
      h+='<button type="button" class="answer-option" data-source="'+source+'" data-idx="'+idx+'">'
        +'<span class="answer-main">'+esc(f.q||'제목 없음')+'</span>'
        +'<span class="answer-sub">'+type+' · '+esc((f.cat||'')+(f.sub?' · '+f.sub:''))+'</span>'
      +'</button>';
    });
    h+='</div></div><span class="time">'+nowTime()+'</span></div></div>';
    row.innerHTML=h;
    chatLog.appendChild(row); chatLog.scrollTop=chatLog.scrollHeight;
    lastWho='bot';
  }

  function ask(q){
    q=(q||'').trim(); if(!q)return;
    addMsg(q,'user');
    var matches=topMatches(q);
    setTimeout(function(){
      if(matches.length){
        addRecommendationMsg(matches,q);
      }else{
        addMsg("가까운 추천 답변 키워드를 찾지 못했어요. 예: 와이파이, 지인추천, 카드 변경, 해지, 배송처럼 짧은 키워드로 다시 입력해 주세요.",'bot');
      }
    },180);
    chatText.value='';
  }

  function initChat(){
    chatText.focus(); if(chatReady)return; chatReady=true;
    addMsg("프로님 안녕하세요!\n실제 AI 생성 답변이 아니라, 메뉴얼에서 만들어진 추천 답변 키워드를 먼저 찾아드려요.",'bot');
    SUGGEST.forEach(function(s){
      var c=document.createElement('button'); c.className='chip'; c.textContent=s;
      c.addEventListener('click',function(){ask(s);}); chatSuggest.appendChild(c);
    });
    chatLog.addEventListener('click',function(e){
      var btn=e.target.closest('.answer-option');
      if(!btn) return;
      var source=btn.getAttribute('data-source')||'tech';
      var idx=+btn.getAttribute('data-idx');
      var f=source==='general'?generalData()[idx]:FAQ[idx];
      if(!f) return;
      addMsg('추천 답변 선택: '+(f.q||''),'user');
      setTimeout(function(){ addMsg(answerText({source:source,f:f}),'bot'); },140);
    });
    chatSend.addEventListener('click',function(){ask(chatText.value);});
    chatText.addEventListener('keydown',function(e){if(e.key==='Enter')ask(chatText.value);});
  }

  /* =====================================================================
     데이터 연결 설정
     ─────────────────────────────────────────────────────────────────────
     ▸ 구글시트 '웹에 게시 > CSV' 주소를 아래 SHEET_CSV_URL 에 붙여넣으세요.
       (정책 바뀌면 시트만 고치면 약 5분 내 자동 반영됩니다)
     ▸ 비워두면 data/technical-faq.json 으로 동작합니다.
     ▸ 시트가 안 열리면 자동으로 technical-faq.json 으로 대체(안전장치).
     ▸ STEP 사진: 시트 'STEPn사진' 칸에 파일명만 적으면 IMG_BASE 폴더에서 찾음.
     ===================================================================== */
  var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSEYbFjQgL9dYX-t3brc34goP1rdrgRMr7PJzbg8-04fTH0vE5t74VpLnlKdjGDkJ6M2vQ6mEn_pbXK/pub?gid=1815248879&single=true&output=csv";          /* 기술상담 CSV */
  var GENERAL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSEYbFjQgL9dYX-t3brc34goP1rdrgRMr7PJzbg8-04fTH0vE5t74VpLnlKdjGDkJ6M2vQ6mEn_pbXK/pub?gid=1858229244&single=true&output=csv";  /* 일반상담 CSV */
  var IMG_BASE      = "assets/guides/";      /* 깃허브 사진 폴더 */
  var FALLBACK_JSON = "data/technical-faq.backup.json";

  /* CSV 파서 (따옴표·줄바꿈 안전) */
  function parseCSV(text){
    var rows=[],row=[],cur="",q=false;
    for(var i=0;i<text.length;i++){var c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
      else { if(c==='"')q=true; else if(c===','){row.push(cur);cur="";}
             else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur="";}
             else if(c==='\r'){} else cur+=c; } }
    if(cur!==""||row.length){row.push(cur);rows.push(row);}
    return rows;
  }
  /* 사진 경로 정리: 파일명만 적으면 img/ 자동, 경로/URL 이면 그대로 */
  function resolveImg(v){
    v=(v||'').trim();
    if(!v) return '';

    // 외부 URL이면 그대로 사용
    if(/^(https?:)?\/\//i.test(v)) return v;

    // 이미 assets/ 또는 img/로 시작하면 그대로 사용
    if(/^(assets|img)\//i.test(v)) return v;

    // 그 외에는 assets/guides/를 앞에 붙임
    return IMG_BASE + v;
  }
  /* 시트 행 → FAQ 객체 (헤더 이름으로 매핑, 칼럼 순서 바뀌어도 안전) */
  function rowsToFAQ(rows){
    if(!rows||!rows.length) return [];
    var head=rows[0].map(function(h){return (h||'').replace(/\s+/g,'').trim();});
    function idx(){ for(var a=0;a<arguments.length;a++){var k=head.indexOf(arguments[a]); if(k>=0)return k;} return -1; }
    var iCat=idx('분류','cat'), iSub=idx('소분류','sub'), iQ=idx('제목','q','문의'),
        iType=idx('문서타입','type','docType'),
        iSay=idx('요약','고객문의','고객 문의','문의','고객말','says'),
        iRef=idx('참고사진','참고형사진','대표사진','refImage'),
        iNext=idx('추가조치','next'),
        iNote=idx('비고','note'), iTag=idx('검색태그','tags','태그');
    /* STEP / STEPn사진 칼럼 자동 탐지 */
    var stepCols=[];
    head.forEach(function(h,i){
      var m=h.match(/^STEP\s*(\d+)$/i); if(m){ var n=+m[1]; (stepCols[n]=stepCols[n]||{}).c=i; }
      var p=h.match(/^STEP\s*(\d+)\s*(사진|이미지|img|image)$/i); if(p){ var n2=+p[1]; (stepCols[n2]=stepCols[n2]||{}).img=i; }
    });
    var out=[];
    for(var r=1;r<rows.length;r++){
      var row=rows[r]; if(!row) continue;
      var g=function(k){ return (k>=0 && row[k]!=null) ? String(row[k]).trim() : ''; };
      var cat=g(iCat), q=g(iQ);
      if(!cat && !q) continue;                 /* 빈 줄 건너뜀 */
      var steps=[];
      for(var n=1;n<stepCols.length;n++){
        var sc=stepCols[n]; if(!sc) continue;
        var content=sc.c!=null?g(sc.c):'';
        var image  =sc.img!=null?resolveImg(g(sc.img)):'';
        if(content||image) steps.push({step:n,content:content,image:image});
      }
      var tagsRaw=g(iTag);
      var tags=tagsRaw?tagsRaw.split(/[|,]/).map(function(t){return t.trim();}).filter(Boolean):[];
      var f={
        cat:cat,
        sub:g(iSub),
        q:q,
        docType:g(iType)||'절차형',
        says:g(iSay),
        refImage:resolveImg(g(iRef)),
        next:g(iNext),
        note:g(iNote),
        tags:tags,
        steps:steps
      };
      f.ment=steps.map(function(s){return s.content;}).filter(Boolean).join('\n'); /* 복사·검색·AI 호환용 */
      out.push(f);
    }
    return out;
  }
  function rowsToGeneralFAQ(rows){
    if(!rows || rows.length<2) return [];
    var head=rows[0].map(function(h){return (h||'').trim();});
    function idx(){
      for(var a=0;a<arguments.length;a++){
        var n=arguments[a];
        var i=head.findIndex(function(h){return norm(h)===norm(n);});
        if(i>=0) return i;
      }
      return -1;
    }
    var iCat=idx('분류','cat'), iSub=idx('소분류','유형','sub'), iQ=idx('제목','문의','q'),
        iSay=idx('요약','고객문의','고객 문의','고객말','says'),
        iReply=idx('추천멘트','응대멘트','안내멘트','답변','reply'),
        iCriteria=idx('처리기준','기준','criteria'),
        iProcess=idx('진행절차','처리절차','절차','process'),
        iCaution=idx('주의사항','비고','note','caution'),
        iTags=idx('태그','키워드','tags');
    return rows.slice(1).map(function(r){
      function val(i){return i>=0?(r[i]||'').trim():'';}
      var tags=val(iTags).replace(/#/g,'').split(/[,\s]+/).map(function(x){return x.trim();}).filter(Boolean);
      return {
        cat:val(iCat)||'기타',
        sub:val(iSub)||'일반',
        q:val(iQ)||val(iSay)||'제목 없음',
        says:val(iSay),
        reply:val(iReply),
        criteria:val(iCriteria),
        process:val(iProcess),
        caution:val(iCaution),
        tags:tags
      };
    }).filter(function(f){return f.q&&f.q!=='제목 없음';});
  }

  function updateCategoryCounts(){
    var cards=document.querySelectorAll('.cat[data-cat]');
    cards.forEach(function(card){
      var name=card.getAttribute('data-cat');
      var count=FAQ.filter(function(f){return f.cat===name;}).length;
      var old=card.querySelector('.cat-count');
      if(!old){
        old=document.createElement('span');
        old.className='cat-count';
        card.appendChild(old);
      }
      old.textContent=count?count:'';
      old.style.display=count?'inline-flex':'none';
    });
  }
  function applyFAQ(arr){ FAQ.length=0; Array.prototype.push.apply(FAQ,arr); updateCategoryCounts(); renderCategory('전체'); }
  function loadError(msg){
    var fv=document.getElementById('faqView');
    if(fv) fv.innerHTML='<div style="padding:40px 16px;text-align:center;color:#98A2B3;font-size:14px;line-height:1.6;">'+msg+'</div>';
  }
  function loadJSON(){
    return fetch(FALLBACK_JSON+'?v='+Date.now())
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(arr){ applyFAQ(arr); });
  }
  function loadGeneralData(){
    if(!GENERAL_CSV_URL) return;
    fetch(GENERAL_CSV_URL+(GENERAL_CSV_URL.indexOf('?')<0?'?':'&')+'t='+Date.now())
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(t){
        GENERAL_FAQ.length=0;
        Array.prototype.push.apply(GENERAL_FAQ, rowsToGeneralFAQ(parseCSV(t)));
        if(currentGuide==='general') renderGeneralGuide(currentCat||'전체'); if(currentGuide==='globalSearch' && searchInput && searchInput.value) runGlobalSearch(searchInput.value);
      })
      .catch(function(){ console.warn('일반상담 CSV를 불러오지 못했습니다. CSV 게시 상태와 주소를 확인해 주세요.'); });
  }
  function loadData(){
    if(SHEET_CSV_URL){
      fetch(SHEET_CSV_URL+(SHEET_CSV_URL.indexOf('?')<0?'?':'&')+'t='+Date.now())
        .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
        .then(function(t){ var arr=rowsToFAQ(parseCSV(t)); if(!arr.length) throw new Error('empty'); applyFAQ(arr); })
        .catch(function(){
          loadJSON().catch(function(){
            loadError('시트를 불러오지 못했어요.<br>게시 상태와 CSV 주소를 확인해 주세요.');
          });
        });
    } else {
      loadJSON().catch(function(){
        loadError('데이터를 불러오지 못했어요.<br>파일을 직접 열지 말고 공유받은 주소로 접속해 주세요.');
      });
    }
    loadGeneralData();
  }
  loadData();



  /* 히어로 캐릭터 이미지에 체크무늬 배경이 포함된 경우 자동 제거 */
  function cleanHeroMascotCheckerboard(){
    var img=document.getElementById('heroMascotImg');
    if(!img) return;
    if(img.classList.contains('is-cleaned')) return;

    function run(){
      if(img.classList.contains('is-cleaned')) return;
      try{
        var w=img.naturalWidth, h=img.naturalHeight;
        if(!w || !h) return;

        var canvas=document.createElement('canvas');
        canvas.width=w;
        canvas.height=h;
        var ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0);
        var image=ctx.getImageData(0,0,w,h);
        var d=image.data;

        function isCheckerBgAt(p){
          var i=p*4;
          var r=d[i], g=d[i+1], b=d[i+2], a=d[i+3];
          if(a<18) return true;
          var max=Math.max(r,g,b), min=Math.min(r,g,b);
          var neutral=(max-min)<38;
          var bright=max>165;
          var notPink=!(r>210 && g<190 && b>190);
          return neutral && bright && notPink;
        }

        var seen=new Uint8Array(w*h);
        var q=[];
        var head=0;
        function push(x,y){
          if(x<0 || y<0 || x>=w || y>=h) return;
          var p=y*w+x;
          if(seen[p]) return;
          if(!isCheckerBgAt(p)) return;
          seen[p]=1;
          q.push(p);
        }

        for(var x=0;x<w;x++){ push(x,0); push(x,h-1); }
        for(var y=0;y<h;y++){ push(0,y); push(w-1,y); }

        while(head<q.length){
          var p=q[head++];
          var x=p%w;
          var y=(p/w)|0;
          push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
        }

        /* 경계가 딱딱해 보이지 않도록 1px 확장 */
        var soften=new Uint8Array(seen);
        for(var p=0;p<seen.length;p++){
          if(!seen[p]) continue;
          var x=p%w, y=(p/w)|0;
          for(var yy=-1; yy<=1; yy++){
            for(var xx=-1; xx<=1; xx++){
              var nx=x+xx, ny=y+yy;
              if(nx<0 || ny<0 || nx>=w || ny>=h) continue;
              var np=ny*w+nx;
              if(isCheckerBgAt(np)) soften[np]=1;
            }
          }
        }

        for(var p=0;p<soften.length;p++){
          if(soften[p]) d[p*4+3]=0;
        }

        ctx.putImageData(image,0,0);
        img.classList.add('is-cleaned');
        img.removeAttribute('crossorigin');
        img.src=canvas.toDataURL('image/png');
      }catch(e){
        console.warn('히어로 캐릭터 배경 제거 실패:', e);
      }
    }

    if(img.complete) run();
    else img.addEventListener('load',run,{once:true});
  }
  cleanHeroMascotCheckerboard();

  /* 스크롤이 히어로를 지나면 고정 검색바를 부드럽게 표시 (fixed라 떨림 없음) */
  var stickyBar=document.getElementById('stickyBar'),sbTick=false;
  function onScroll(){
    if(sbTick) return; sbTick=true;
    requestAnimationFrame(function(){
      if(window.scrollY>200) stickyBar.classList.add('show');
      else stickyBar.classList.remove('show');
      sbTick=false;
    });
  }
  window.addEventListener('scroll',onScroll,{passive:true});
})();